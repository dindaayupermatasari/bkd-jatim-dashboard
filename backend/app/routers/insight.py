import hashlib
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from groq import Groq

from app.database import get_db

router = APIRouter()

AI_INSIGHT = os.getenv("AI_INSIGHT")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
groq_client = Groq(api_key=AI_INSIGHT) if AI_INSIGHT else None


def _call_llm(prompt: str) -> str:
    """Panggil Groq dan kembalikan teks mentah balasan model."""
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.4,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi Groq: {str(e)}")
    return (response.choices[0].message.content or "").strip()


# ============================================================
# CACHE TABLE
# ============================================================
# Cache 1 baris (id selalu 1). "fingerprint" adalah hash dari data
# dashboard yang dipakai untuk generate insight. Selama fingerprint
# tidak berubah (artinya data ASN belum berubah), endpoint cukup
# membaca baris ini dari database, tanpa memanggil Groq lagi.

_CACHE_TABLE_DDL = text(r"""
    CREATE TABLE IF NOT EXISTS ai_insights_cache (
        id INTEGER PRIMARY KEY DEFAULT 1,
        fingerprint TEXT NOT NULL,
        insights JSONB NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ai_insights_cache_single_row CHECK (id = 1)
    )
""")
# Catatan: kolom "insights" sekarang menyimpan objek {"headline": ..., "insights": [...]}
# (sebelumnya array insight saja). Tidak perlu migrasi/ALTER TABLE karena
# kolomnya sudah JSONB — cukup bentuk isinya yang berubah.


def _ensure_cache_table(db: Session) -> None:
    db.execute(_CACHE_TABLE_DDL)
    db.commit()


def _build_context(db: Session) -> dict:
    # Import di dalam fungsi supaya modul router ini ringan saat di-load.
    # (tidak ada circular import lagi sejak dashboard dipisah dari main.py).
    from app.routers.dashboard import dashboard_all

    data = dashboard_all(db)

    # Semua bagian yang tampil di halaman Beranda (kartu ringkasan +
    # tiap grafik), bukan cuma sebagian, supaya insight yang dihasilkan
    # benar-benar merujuk ke apa yang dilihat pengguna di layar.
    return {
        "summary": data["summary"],
        "status_kepegawaian": data["status"],
        "generasi": data["generasi"],
        "generasi_per_status": data["generasi_by_status"],
        "proyeksi_pensiun_per_tahun": data["pensiun"],
        "top_opd": data["top_opd"],
        "risiko_kekosongan_eselon": data["eselon_risk"],
        # opd_risk bisa puluhan baris; 10 teratas (risiko tertinggi)
        # sudah cukup mewakili tanpa membuat prompt kebesaran.
        "opd_risiko_tertinggi": data["opd_risk"][:10],
    }


def _fingerprint(context: dict) -> str:
    raw = json.dumps(context, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_cached_row(db: Session) -> dict | None:
    return (
        db.execute(
            text(
                "SELECT fingerprint, insights, generated_at "
                "FROM ai_insights_cache WHERE id = 1"
            )
        )
        .mappings()
        .first()
    )


# ============================================================
# CACHE TABLE — Proyeksi Pensiun (BUP)
# ============================================================
# Beda dari cache Beranda: insight di halaman ini berubah tergantung
# filter status (SEMUA/PNS/PPPK/PPPK PW), jadi cache-nya keyed per status
# ("status_key"), bukan satu baris tetap seperti ai_insights_cache.

_PENSIUN_CACHE_TABLE_DDL = text(r"""
    CREATE TABLE IF NOT EXISTS ai_insights_pensiun_cache (
        status_key TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        insights JSONB NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
""")


def _ensure_pensiun_cache_table(db: Session) -> None:
    db.execute(_PENSIUN_CACHE_TABLE_DDL)
    db.commit()


def _pensiun_status_key(status: str | None) -> str:
    return status if status else "SEMUA"


def _get_cached_pensiun_row(db: Session, status_key: str) -> dict | None:
    return (
        db.execute(
            text(
                "SELECT fingerprint, insights, generated_at "
                "FROM ai_insights_pensiun_cache WHERE status_key = :status_key"
            ),
            {"status_key": status_key},
        )
        .mappings()
        .first()
    )


def _build_pensiun_context(status: str | None, db: Session) -> dict:
    # Import di dalam fungsi supaya modul router ini ringan saat di-load.
    # (tidak ada circular import lagi sejak dashboard dipisah dari main.py).
    from app.routers.pensiun_bup import dashboard_pensiun_bup

    data = dashboard_pensiun_bup(status=status, db=db)

    return {
        "filter_status": status or "SEMUA",
        "kpi": data["kpi"],
        "lonjakan": data["lonjakan"],
        # opd_breakdown sudah difilter ke OPD Kritis/Waspada (atau ditambal
        # sampai minimal PENSIUN_BUP_DEFAULT_MIN_OPD) di endpoint aslinya,
        # jadi biasanya sudah cukup ringkas untuk dikirim seluruhnya. Tetap
        # dibatasi 15 baris teratas untuk jaga-jaga.
        "opd_breakdown": data["opd_breakdown"][:15],
        "cabang_breakdown": data["cabang_breakdown"],
        # Dua ranking terpisah (volume vs persentase) supaya AI bisa
        # menyebut eksplisit kalau OPD volume terbesar belum tentu OPD
        # paling berisiko secara persentase, dan sebaliknya.
        "opd_top_volume": data["opd_top_volume"],
        "opd_top_persen": data["opd_top_persen"],
    }


def _generate_pensiun_insights(context: dict, status: str | None) -> dict:
    status_label = status or "seluruh ASN (PNS, PPPK, dan PPPK Paruh Waktu)"

    prompt = f"""Kamu adalah analis kepegawaian untuk BKD Provinsi Jawa Timur, menulis
konten untuk kartu "Rekomendasi & Insight Utama" di halaman "Proyeksi Pensiun (BUP)"
dashboard ASN. Data di bawah ini sudah difilter untuk status kepegawaian: {status_label}.
Berikut datanya dalam format JSON — KPI ringkas, lonjakan tahun-ke-tahun terbesar,
tabel breakdown OPD paling genting (diurutkan berdasarkan persentase pegawai yang
pensiun terhadap total pegawai OPD tersebut, bukan volume), sebaran cabang/wilayah
untuk OPD teratas (kalau ada), serta dua ranking terpisah OPD berdasarkan volume
absolut dan berdasarkan persentase:

{json.dumps(context, ensure_ascii=False, default=str)}

Tulis dua bagian:

1. "headline": satu paragraf pendek (2-4 kalimat) berisi rekomendasi utama —
   OPD dengan urgensi tertinggi (field "urgensi": "Kritis" diprioritaskan di atas
   "Waspada"), sifat risikonya (guru, tenaga kesehatan, atau struktural, dilihat
   dari "klaster_dominan" dan "kategori"), dan langkah prioritas yang disarankan.
2. "insights": 3-5 insight tentang gelombang pensiun dan risiko regenerasi.

Aturan penulisan untuk semua teks:
- Bahasa Indonesia formal, kalimat utuh dan jelas — bukan sekadar menyebut ulang angka mentah.
- Angka ribuan pakai format Indonesia (titik sebagai pemisah, contoh: 7.584).
- Sebut nama OPD secara eksplisit dari data "opd_breakdown", jangan generik ("beberapa OPD").
- Kalau "opd_top_volume" dan "opd_top_persen" menunjukkan OPD nomor satu yang berbeda,
  jelaskan eksplisit bedanya (OPD terbanyak secara jumlah orang vs OPD paling genting
  secara persentase dari kekuatan pegawainya sendiri) — jangan campur dua angka ini
  tanpa keterangan cakupan, supaya tidak terlihat kontradiksi dengan KPI di halaman.
- Kalau "lonjakan" ada dan pct-nya besar, sebutkan sebagai sinyal yang perlu diverifikasi
  (pola demografis klaster usia vs kemungkinan anomali data), bukan fakta pasti.
- Kalau "cabang_breakdown" ada, sebutkan cabang/wilayah dengan jumlah tertinggi sebagai
  prioritas alokasi formasi, bukan dipukul rata se-provinsi.
- "insights" maksimal 2 kalimat masing-masing, setiap insight fokus pada satu temuan berbeda
  (jangan mengulang angka yang sama di insight lain), dan utamakan yang actionable bagi BKD.
- Jangan pakai tanda pisah "–"/"—" untuk menyambung anak kalimat (mis. "...ke depan — perlu...").
  Gunakan kata sambung biasa (sehingga, yang, namun, karena, dst.) atau koma supaya kalimatnya
  mengalir sebagai satu kalimat utuh, bukan potongan-potongan yang disambung tanda baca.
Balas HANYA dalam format JSON object seperti ini, tanpa teks lain, tanpa markdown:
{{"headline": "...", "insights": [{{"level": "critical", "text": "..."}}, {{"level": "warning", "text": "..."}}]}}
Level yang valid hanya: "critical", "warning", "info"."""

    raw_text = _call_llm(prompt)
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        result = {"headline": raw_text, "insights": []}

    if not isinstance(result, dict):
        result = {"headline": "", "insights": []}
    result.setdefault("headline", "")
    result.setdefault("insights", [])

    return result


def _flatten(
    payload: dict,
    generated_at,
    *,
    cached: bool,
    stale: bool = False,
    stale_reason: str | None = None,
) -> dict:
    # "payload" berbentuk {"headline": str, "insights": [...]} (baik yang baru
    # digenerate maupun yang dibaca dari kolom JSONB ai_insights_cache).
    # Diratakan di sini supaya response API-nya flat — headline dan insights
    # jadi field terpisah di top-level, bukan nested — sesuai bentuk yang
    # dibaca frontend (AiInsightsResponse).
    result = {
        "headline": payload.get("headline", ""),
        "insights": payload.get("insights", []),
        "generated_at": generated_at,
        "cached": cached,
        "stale": stale,
    }
    if stale_reason is not None:
        result["stale_reason"] = stale_reason
    return result


def _generate_insights(context: dict) -> dict:
    prompt = f"""Kamu adalah analis kepegawaian untuk BKD Provinsi Jawa Timur, menulis
konten untuk kartu "Rekomendasi & Insight Utama" di dashboard ASN. Berikut seluruh
data dashboard terbaru per Agustus 2026 — ringkasan, status kepegawaian, komposisi
generasi (total maupun per status kepegawaian), proyeksi pensiun, sebaran per OPD,
dan risiko kekosongan jabatan struktural — dalam format JSON:

{json.dumps(context, ensure_ascii=False, default=str)}

Tulis dua bagian:

1. "headline": satu paragraf pendek (2-4 kalimat) berisi rekomendasi utama —
   OPD atau jabatan dengan risiko regenerasi tertinggi dan langkah prioritas
   yang disarankan.
2. "insights": 3-5 insight tentang risiko regenerasi, gelombang pensiun, dan
   kekosongan jabatan struktural.

Aturan penulisan untuk semua teks:
- Bahasa Indonesia formal, kalimat utuh dan jelas — bukan sekadar menyebut ulang angka mentah.
- Angka ribuan pakai format Indonesia (titik sebagai pemisah, contoh: 7.584).
- Jangan menyebut istilah "algoritma genetika"/"genetic algorithm" untuk skor risiko OPD — itu
  skor komposit tertimbang (kombinasi proporsi pegawai senior dan rata-rata usia), sebut saja
  "skor komposit risiko regenerasi".
- Kalau menyebut angka dari "generasi_per_status", sebutkan eksplisit status kepegawaiannya
  (mis. "PNS", "PPPK Penuh Waktu", "PPPK Paruh Waktu"). Kalau dari "generasi" (total), sebutkan
  eksplisit bahwa itu gabungan seluruh ASN — jangan campur dua angka ini tanpa keterangan cakupan,
  supaya tidak terlihat kontradiksi dengan grafik lain di halaman yang cakupannya beda.
- "insights" maksimal 2 kalimat masing-masing, setiap insight fokus pada satu temuan berbeda
  (jangan mengulang angka yang sama di insight lain), dan utamakan yang actionable bagi BKD.
- Jangan pakai tanda pisah "–"/"—" untuk menyambung anak kalimat (mis. "...ke depan — perlu...").
  Gunakan kata sambung biasa (sehingga, yang, namun, karena, dst.) atau koma supaya kalimatnya
  mengalir sebagai satu kalimat utuh, bukan potongan-potongan yang disambung tanda baca.
Balas HANYA dalam format JSON object seperti ini, tanpa teks lain, tanpa markdown:
{{"headline": "...", "insights": [{{"level": "critical", "text": "..."}}, {{"level": "warning", "text": "..."}}]}}
Level yang valid hanya: "critical", "warning", "info"."""

    raw_text = _call_llm(prompt)
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        result = {"headline": raw_text, "insights": []}

    # Jaga-jaga kalau model tidak taat skema (mis. field hilang).
    if not isinstance(result, dict):
        result = {"headline": "", "insights": []}
    result.setdefault("headline", "")
    result.setdefault("insights", [])

    return result


@router.get("/api/insights/pensiun-bup")
def pensiun_bup_ai_insights(
    status: str | None = Query(
        None,
        description="None=semua, 'PNS', 'PPPK', 'PPPK PW' — sama seperti filter di halaman",
    ),
    force_refresh: bool = Query(
        False, description="Lewati cache dan generate ulang meski data belum berubah"
    ),
    db: Session = Depends(get_db),
):
    if not groq_client:
        raise HTTPException(
            status_code=503,
            detail="AI_INSIGHT belum diisi di .env",
        )

    _ensure_pensiun_cache_table(db)

    status_key = _pensiun_status_key(status)
    context = _build_pensiun_context(status, db)

    if context["kpi"] is None:
        # Tidak ada data pensiun untuk filter status ini (mis. data belum
        # lengkap) — tidak ada yang perlu dianalisis, jangan panggil Groq.
        return _flatten(
            {"headline": "", "insights": []}, datetime.now(timezone.utc), cached=False
        )

    fingerprint = _fingerprint(context)

    cached = None
    if not force_refresh:
        cached = _get_cached_pensiun_row(db, status_key)

        if cached and cached["fingerprint"] == fingerprint:
            return _flatten(cached["insights"], cached["generated_at"], cached=True)

    try:
        insights = _generate_pensiun_insights(context, status)
    except HTTPException as exc:
        stale_row = (
            cached if cached is not None else _get_cached_pensiun_row(db, status_key)
        )
        if stale_row:
            return _flatten(
                stale_row["insights"],
                stale_row["generated_at"],
                cached=True,
                stale=True,
                stale_reason=exc.detail,
            )
        raise

    generated_at = datetime.now(timezone.utc)

    db.execute(
        text("""
            INSERT INTO ai_insights_pensiun_cache (status_key, fingerprint, insights, generated_at)
            VALUES (:status_key, :fingerprint, CAST(:insights AS JSONB), :generated_at)
            ON CONFLICT (status_key) DO UPDATE SET
                fingerprint = EXCLUDED.fingerprint,
                insights = EXCLUDED.insights,
                generated_at = EXCLUDED.generated_at
            """),
        {
            "status_key": status_key,
            "fingerprint": fingerprint,
            "insights": json.dumps(insights, ensure_ascii=False),
            "generated_at": generated_at,
        },
    )
    db.commit()

    return _flatten(insights, generated_at, cached=False)


@router.get("/api/insights")
def dashboard_ai_insights(
    force_refresh: bool = Query(
        False, description="Lewati cache dan generate ulang meski data belum berubah"
    ),
    db: Session = Depends(get_db),
):
    if not groq_client:
        raise HTTPException(
            status_code=503,
            detail="AI_INSIGHT belum diisi di .env",
        )

    _ensure_cache_table(db)

    # Fingerprint dihitung dari data yang sama yang dikirim ke model,
    # jadi begitu ada ASN baru/berubah, hash-nya otomatis ikut berubah.
    context = _build_context(db)
    fingerprint = _fingerprint(context)

    cached = None
    if not force_refresh:
        cached = _get_cached_row(db)

        if cached and cached["fingerprint"] == fingerprint:
            return _flatten(cached["insights"], cached["generated_at"], cached=True)

    # Perlu generate baru (data berubah, belum pernah ada cache, atau
    # force_refresh). Kalau Groq gagal (mis. rate limit atau
    # overload) dan ada cache lama di database, tampilkan cache lama itu
    # dulu (ditandai stale=True) daripada langsung gagal total ke
    # frontend dan jatuh ke insight rule-based.
    try:
        insights = _generate_insights(context)
    except HTTPException as exc:
        # cached belum tentu sudah di-query di atas (mis. saat force_refresh),
        # jadi ambil di sini kalau belum ada.
        stale_row = cached if cached is not None else _get_cached_row(db)
        if stale_row:
            return _flatten(
                stale_row["insights"],
                stale_row["generated_at"],
                cached=True,
                stale=True,
                stale_reason=exc.detail,
            )
        raise

    generated_at = datetime.now(timezone.utc)

    db.execute(
        text("""
            INSERT INTO ai_insights_cache (id, fingerprint, insights, generated_at)
            VALUES (1, :fingerprint, CAST(:insights AS JSONB), :generated_at)
            ON CONFLICT (id) DO UPDATE SET
                fingerprint = EXCLUDED.fingerprint,
                insights = EXCLUDED.insights,
                generated_at = EXCLUDED.generated_at
            """),
        {
            "fingerprint": fingerprint,
            "insights": json.dumps(insights, ensure_ascii=False),
            "generated_at": generated_at,
        },
    )
    db.commit()

    return _flatten(insights, generated_at, cached=False)
