import hashlib
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from groq import Groq
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter()

# API key khusus halaman Perbandingan Antar OPD, sengaja dipisah dari
# GROQ_API_KEY (dipakai Beranda dan Proyeksi Pensiun) supaya kuota dan
# error-nya tidak saling mengganggu. Modelnya ikut GROQ_MODEL.
GROQ_API_KEY_OPD = os.getenv("GROQ_API_KEY_OPD")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
groq_client = Groq(api_key=GROQ_API_KEY_OPD) if GROQ_API_KEY_OPD else None

VALID_LEVELS = {"critical", "warning", "info"}

# ============================================================
# CACHE TABLE
# ============================================================
# Satu baris per OPD. "fingerprint" adalah hash dari data OPD itu saja
# (bukan seluruh OPD), jadi perubahan data di OPD lain tidak membuat
# cache OPD ini ikut dibuang. Tabel dibuat otomatis kalau belum ada.

_CACHE_TABLE_DDL = text(r"""
    CREATE TABLE IF NOT EXISTS ai_insights_opd_cache (
        opd_id INTEGER PRIMARY KEY,
        opd_nama TEXT,
        fingerprint TEXT NOT NULL,
        insights JSONB NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
""")


def _ensure_cache_table(db: Session) -> None:
    db.execute(_CACHE_TABLE_DDL)
    db.commit()


def _get_cached_row(db: Session, opd_id: int) -> dict | None:
    return (
        db.execute(
            text(
                "SELECT fingerprint, insights, generated_at "
                "FROM ai_insights_opd_cache WHERE opd_id = :opd_id"
            ),
            {"opd_id": opd_id},
        )
        .mappings()
        .first()
    )


# Naikkan nilai ini setiap prompt di _generate_insights diubah, supaya cache lama
# otomatis dianggap kedaluwarsa dan insight dibuat ulang dengan prompt baru.
PROMPT_VERSION = "v6"


def _fingerprint(context: dict) -> str:
    raw = PROMPT_VERSION + json.dumps(context, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ============================================================
# DATA OPD
# ============================================================


def _build_context(db: Session, opd_id: int) -> dict | None:
    # Import di dalam fungsi supaya modul ini ringan saat di-load.
    # Sumbernya sama persis dengan endpoint /api/perbandingan-opd,
    # jadi insight selalu sejalan dengan angka yang tampil di layar.
    from app.services.opd_service import compute_perbandingan_opd

    for row in compute_perbandingan_opd(db):
        if row["id"] == opd_id:
            return row
    return None


# ============================================================
# GENERATE
# ============================================================


def _call_llm(prompt: str) -> str:
    """Panggil Groq dan kembalikan teks mentah balasan model."""
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"Gagal menghubungi Groq: {str(e)}"
        )
    return (response.choices[0].message.content or "").strip()


KRITERIA_LABEL = {
    "usia": "Usia Pegawai",
    "bup": "Kepadatan Pensiun (12 Bulan)",
    "jenis_jabatan": "Ketergantungan Jabatan Struktural",
    "klaster": "Keragaman Klaster SDM",
    "generasi": "Komposisi Generasi Ideal",
}


def _prompt_context(row: dict) -> dict:
    """Susun data untuk prompt: label yang sama dengan di layar, plus hal-hal yang
    sebelumnya harus ditebak model (kriteria terendah/tertinggi, arti skor struktural)."""
    skor = {KRITERIA_LABEL.get(k, k): v for k, v in row["kontribusi_skor"].items()}
    terendah = min(skor.items(), key=lambda kv: kv[1])
    tertinggi = max(skor.items(), key=lambda kv: kv[1])
    gen = row["komposisi_generasi"]
    ideal = {"Baby Boom": 5, "Gen X": 10, "Milenial": 50, "Gen Z": 35}
    riil = {
        "Baby Boom": gen["baby_boom"],
        "Gen X": gen["gen_x"],
        "Milenial": gen["milenial"],
        "Gen Z": gen["gen_z"],
    }

    def rapikan(nama: str) -> str:
        # Nama jabatan struktural di data tertulis kapital semua (KEPALA BIDANG).
        return nama.title() if nama.isupper() else nama

    jabatan = {
        rentang: [{**j, "nama": rapikan(j["nama"])} for j in daftar]
        for rentang, daftar in row["jabatan_berisiko"].items()
    }
    struktural = [
        {"nama": j["nama"], "jumlah": j["jumlah"], "rentang_bulan": rentang}
        for rentang, daftar in jabatan.items()
        for j in daftar
        if j.get("badge") == "Str"
    ]
    # Satu jenis jabatan: "Sekretaris". Lebih dari satu jenis: semuanya pakai angka,
    # misalnya "2 Kepala Bidang dan 1 Kepala Dinas".
    potongan = [
        f"{j['jumlah']} {j['nama']}" if (len(struktural) > 1 or j["jumlah"] > 1) else j["nama"]
        for j in struktural
    ]
    if len(potongan) > 1:
        ringkasan_struktural = ", ".join(potongan[:-1]) + " dan " + potongan[-1]
    else:
        ringkasan_struktural = potongan[0] if potongan else None
    selisih = {k: round(riil[k] - ideal[k], 1) for k in ideal}
    berlebih = max(selisih.items(), key=lambda kv: kv[1])
    kurang = min(selisih.items(), key=lambda kv: kv[1])

    return {
        "nama_opd": row["nama"],
        "total_pegawai": row["total_asn"],
        "rata_rata_usia": row["rata_usia"],
        "skor_ketahanan_regenerasi": row["skor_komposit"],
        "kategori": row["kategori"],
        "pensiun_0_6_bulan": row["pensiun_0_6"],
        "pensiun_6_12_bulan": row["pensiun_6_12"],
        "pensiun_12_bulan_jumlah": row["pensiun_12_bulan"],
        "pensiun_12_bulan_persen": row["pensiun_12_bulan_pct"],
        "pemangku_jabatan_struktural_akan_pensiun_12_bulan": row["jumlah_struktural_kosong_12bln"],
        "skor_per_kriteria": skor,
        "kriteria_terendah": {"nama": terendah[0], "skor": terendah[1]},
        "kriteria_tertinggi": {"nama": tertinggi[0], "skor": tertinggi[1]},
        "komposisi_generasi_persen": riil,
        "komposisi_generasi_ideal_persen": ideal,
        # positif = kelebihan dari ideal, negatif = kekurangan (dalam poin persen)
        "selisih_dari_ideal_poin": selisih,
        "generasi_paling_berlebih": {"nama": berlebih[0], "selisih_poin": berlebih[1]},
        "generasi_paling_kurang": {"nama": kurang[0], "selisih_poin": kurang[1]},
        "jabatan_struktural_akan_pensiun": struktural,
        "ringkasan_struktural": ringkasan_struktural,
        "jabatan_berisiko": jabatan,
    }


def _generate_insights(context: dict) -> dict:
    data = json.dumps(_prompt_context(context), ensure_ascii=False, default=str)

    prompt = f"""Kamu adalah analis kepegawaian untuk BKD Provinsi Jawa Timur. Tulis konten
untuk bagian "Insight AI" pada detail satu OPD di halaman "Perbandingan Antar OPD"
dashboard ASN. Berikut data OPD tersebut per Agustus 2026 dalam format JSON:

{data}

Cara membaca data:
- "skor_ketahanan_regenerasi" dan semua nilai di "skor_per_kriteria" berskala 0-100,
  makin tinggi makin aman. Kategori skor: Kritis < 60, Waspada 60-74, Aman >= 75.
  "kriteria_terendah" dan "kriteria_tertinggi" sudah dihitung untukmu.
- Skor "Ketergantungan Jabatan Struktural" yang rendah berarti ada pemangku jabatan
  struktural yang akan pensiun dalam 12 bulan (jumlahnya di
  "pemangku_jabatan_struktural_akan_pensiun_12_bulan", namanya di
  "jabatan_struktural_akan_pensiun", frasa siap pakainya di "ringkasan_struktural").
  Jabatan itu belum kosong, hanya berisiko kosong.
  Tulis "pemangkunya akan pensiun" atau "berisiko kosong", jangan "kosong" tanpa
  "berisiko" dan jangan menulis bahwa OPD bergantung penuh pada jabatan struktural.
- "selisih_dari_ideal_poin" adalah selisih komposisi generasi riil terhadap ideal, positif
  berarti kelebihan dan negatif berarti kekurangan. "generasi_paling_berlebih" dan
  "generasi_paling_kurang" sudah dihitung untukmu.
- "jabatan_berisiko" berisi jabatan yang pemangkunya pensiun dalam 0-6 dan 6-12 bulan.
  Badge "Str" struktural (hanya bisa diisi PNS), "Fun" fungsional, "Pel" pelaksana.

Tulis dua bagian:

1. "headline": satu paragraf pendek (2-3 kalimat) berisi tindak lanjut prioritas untuk
   OPD ini. Sebut semua jabatan yang pensiun dalam 0-6 bulan, dan kalau ada jabatan
   struktural yang pemangkunya akan pensiun, sebut dengan frasa di "ringkasan_struktural"
   apa adanya (misalnya "2 Kepala Bidang dan 1 Kepala Dinas"). Pisahkan dengan jelas
   langkah untuk jabatan fungsional/pelaksana dan langkah untuk jabatan struktural.
2. "insights": tepat 3 insight, masing-masing fokus pada satu temuan berbeda:
   a. kriteria terendah, apa artinya bagi OPD ini, dan satu langkah yang masuk akal. Kalau
      kriteria terendahnya Ketergantungan Jabatan Struktural, sebut jabatannya lewat
      "ringkasan_struktural";
   b. kriteria tertinggi sebagai kekuatan OPD. Sebut apa yang ditunjukkan angkanya (misalnya
      porsi pegawai yang pensiun dalam 12 bulan relatif kecil) dan satu cara
      memanfaatkannya untuk menyiapkan suksesi. Jangan menyebut beban atau waktu sebagai
      "cukup", "ringan", "stabil", atau "aman";
   c. komposisi generasi dibanding ideal: sebut generasi yang paling berlebih dan generasi
      yang paling kurang beserta selisihnya (kalau selisih berlebih tidak positif, cukup
      yang kurang), lalu satu langkah.
   Gunakan level "critical" untuk temuan paling genting, "warning" untuk yang perlu
   diwaspadai, dan "info" untuk kekuatan atau catatan.

Aturan penulisan:
- Bahasa Indonesia formal tapi mengalir natural, kalimat utuh. Jelaskan makna angka bagi
  OPD ini, jangan sekadar mengulangnya.
- Hanya pakai angka dan nama jabatan yang ada di data. Jangan mengarang data dan jangan
  membandingkan dengan OPD lain, karena data OPD lain tidak diberikan.
- Jangan menulis nama kunci JSON (seperti skor_per_kriteria atau komposisi_generasi_persen).
  Pakai istilah biasa dan nama kriteria apa adanya.
- Angka desimal ditulis dengan koma dan persen tanpa spasi, misalnya 51,4 dan 17,2%.
- Jangan menyebut tenggat, jumlah, atau persentase yang tidak ada di data, misalnya
  "dalam tiga bulan".
- Kalau menyebut jabatan struktural yang akan pensiun, pakai "ringkasan_struktural".
  Jangan menulis "beberapa jabatan struktural" atau "jabatan struktural" saja.
- Jabatan struktural diisi lewat promosi PNS. Jabatan fungsional jenjang Madya dan Utama
  diisi lewat kenaikan jenjang atau pengembangan pegawai yang sudah ada, bukan rekrutmen
  dari luar. Rekrutmen hanya relevan untuk jenjang awal dan pelaksana, misalnya untuk
  memperbaiki komposisi generasi.
- Kalau "pemangku_jabatan_struktural_akan_pensiun_12_bulan" bernilai 0, jangan menyebut
  risiko jabatan struktural.
- Skor tinggi hanya menggambarkan kondisi data, bukan kualitas kebijakan. Jangan menulis
  bahwa OPD sudah mengelola pensiun, suksesi, atau regenerasi dengan baik, dan jangan
  menyebut kebijakan atau program yang sudah ada, karena datanya tidak tersedia.
- Kalau OPD berkategori Aman dan tidak ada risiko berarti, katakan apa adanya dengan
  singkat, jangan didramatisasi.
- Jangan menyimpulkan hal yang tidak ada di data, misalnya OPD akan kehilangan kemampuan
  operasional.
- Jangan menyebut "algoritma genetika". Sebut saja "skor ketahanan regenerasi".
- Hindari pembuka klise seperti "Penting untuk diperhatikan", "Perlu dicatat", atau
  "Dapat disimpulkan bahwa".
- Setiap insight terdiri dari dua kalimat pendek: kalimat pertama berisi temuan beserta
  angkanya, kalimat kedua berisi satu langkah untuk BKD. Jangan pakai titik koma. Variasikan
  kata kerja dan awal kalimat langkah (jangan selalu "BKD perlu/dapat/sebaiknya") dan
  jangan memakai pola "menunjukkan ..., sehingga ..." di setiap insight. Jangan mengulang
  jabatan atau angka yang sudah disebut di headline.
- Jangan pakai tanda pisah "–" atau "—" untuk menyambung anak kalimat. Gunakan kata
  sambung seperlunya (yang, namun, karena) atau pisahkan dengan titik.
Balas HANYA dalam format JSON object seperti ini, tanpa teks lain, tanpa markdown:
{{"headline": "...", "insights": [{{"level": "critical", "text": "..."}}, {{"level": "info", "text": "..."}}]}}
Level yang valid hanya: "critical", "warning", "info"."""

    raw_text = _call_llm(prompt)
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        result = {"headline": raw_text, "insights": []}

    # Jaga-jaga kalau model tidak taat skema.
    if not isinstance(result, dict):
        result = {"headline": "", "insights": []}
    result.setdefault("headline", "")

    cleaned = []
    for item in result.get("insights") or []:
        if isinstance(item, dict) and item.get("text"):
            level = item.get("level")
            cleaned.append(
                {
                    "level": level if level in VALID_LEVELS else "info",
                    "text": str(item["text"]),
                }
            )
    result["insights"] = cleaned

    return result


def _flatten(
    payload: dict,
    generated_at,
    *,
    cached: bool,
    stale: bool = False,
    stale_reason: str | None = None,
) -> dict:
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


# ============================================================
# ENDPOINT
# ============================================================


@router.get("/api/insights/opd/{opd_id}")
def opd_ai_insights(
    opd_id: int,
    force_refresh: bool = Query(
        False, description="Lewati cache dan generate ulang meski data belum berubah"
    ),
    db: Session = Depends(get_db),
):
    if not groq_client:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY_OPD belum diisi di .env",
        )

    _ensure_cache_table(db)

    context = _build_context(db, opd_id)
    if context is None:
        raise HTTPException(status_code=404, detail=f"OPD dengan id {opd_id} tidak ditemukan")

    # Fingerprint dihitung dari data yang sama yang dikirim ke model, jadi
    # begitu angka OPD ini berubah, hash-nya otomatis ikut berubah.
    fingerprint = _fingerprint(context)

    cached = None
    if not force_refresh:
        cached = _get_cached_row(db, opd_id)
        if cached and cached["fingerprint"] == fingerprint:
            return _flatten(cached["insights"], cached["generated_at"], cached=True)

    # Perlu generate baru (klik pertama, data berubah, atau force_refresh).
    # Kalau Groq gagal dan ada cache lama, tampilkan cache lama itu
    # (ditandai stale=True) daripada gagal total.
    try:
        insights = _generate_insights(context)
    except HTTPException as exc:
        stale_row = cached if cached is not None else _get_cached_row(db, opd_id)
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
            INSERT INTO ai_insights_opd_cache (opd_id, opd_nama, fingerprint, insights, generated_at)
            VALUES (:opd_id, :opd_nama, :fingerprint, CAST(:insights AS JSONB), :generated_at)
            ON CONFLICT (opd_id) DO UPDATE SET
                opd_nama = EXCLUDED.opd_nama,
                fingerprint = EXCLUDED.fingerprint,
                insights = EXCLUDED.insights,
                generated_at = EXCLUDED.generated_at
            """),
        {
            "opd_id": opd_id,
            "opd_nama": context.get("nama"),
            "fingerprint": fingerprint,
            "insights": json.dumps(insights, ensure_ascii=False),
            "generated_at": generated_at,
        },
    )
    db.commit()

    return _flatten(insights, generated_at, cached=False)
