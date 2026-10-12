from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(tags=["Proyeksi Pensiun BUP"])


# ============================================================
# 5b. PROYEKSI PENSIUN BUP — DETAIL (halaman Proyeksi Pensiun)
# ============================================================
# Endpoint ini menyuplai semua kebutuhan halaman ProyeksiPensiunBUP.tsx:
# KPI, chart per-OPD 2026-2035, tile per tahun, dan tabel breakdown OPD
# dengan proyeksi tertinggi (berbasis volume DAN persentase), lengkap
# dengan klaster jabatan dominan yang pensiun, kategori OPD, dan
# breakdown cabang/wilayah (khusus OPD yang punya struktur cabang,
# terutama Dinas Pendidikan). Semua dihitung dari data live.
#
# Tabel breakdown OPD (opd_breakdown) TIDAK dipatok ke angka tetap.
# Default: semua OPD berstatus "Kritis" (>=20% pegawai pensiun) atau
# "Waspada" (>=10%) ikut ditampilkan, ditambal ke minimal
# PENSIUN_BUP_DEFAULT_MIN_OPD kalau jumlahnya terlalu sedikit. Pakai
# ?show_all=true untuk semua OPD yang lolos ambang PENSIUN_BUP_MIN_PEGAWAI_OPD,
# atau ?limit=N untuk memaksa N OPD teratas berdasarkan %.
#
# CATATAN PENTING soal kolom `opd`:
# - Di tabel `pns`, kolom opd hanya berisi nama OPD induk
#   (mis. "DINAS PENDIDIKAN").
# - Di tabel `pppk_full` dan `pppk_pw`, kolom opd berisi PATH HIERARKIS
#   penuh dipisah " - ", turun sampai level sekolah/UPT/cabang, mis.
#   "DINAS PENDIDIKAN - CABANG DINAS PENDIDIKAN WILAYAH BLITAR - UPT
#   SATUAN PENDIDIKAN - KABUPATEN BLITAR - SMAN 1 GARUM".
#   Kalau di-GROUP BY opd mentah-mentah (seperti versi sebelumnya),
#   hampir 44rb pegawai PPPK Full+PPPK PW (>separuh total ASN) akan
#   terpecah jadi ribuan bucket unik per sekolah/UPT dan nyaris tidak
#   pernah muncul di ranking OPD tertinggi. Karena itu di bawah ini
#   kita selalu ekstrak dua level:
#     opd_induk  = segmen pertama (nama OPD, untuk agregasi utama)
#     opd_cabang = nama wilayah/cabang jika segmen kedua berpola
#                  "CABANG DINAS ... WILAYAH X" / "... KABUPATEN X"

PENSIUN_BUP_TAHUN_AWAL = 2026
PENSIUN_BUP_TAHUN_AKHIR = 2035
PENSIUN_BUP_TAHUN_KUMULATIF_AKHIR = 2030  # jendela "5 tahun ke depan"
PENSIUN_BUP_MIN_PEGAWAI_OPD = 30  # ambang minimal supaya %-nya tidak bising

_OPD_INDUK_SQL = "TRIM(split_part(opd, ' - ', 1))"
_OPD_CABANG_SQL = r"""
    CASE
        WHEN split_part(opd, ' - ', 2) LIKE 'CABANG DINAS%' THEN
            COALESCE(
                NULLIF(TRIM(substring(split_part(opd, ' - ', 2) from 'WILAYAH\s+(.+)$')), ''),
                NULLIF(TRIM(substring(split_part(opd, ' - ', 2) from 'KABUPATEN\s+(.+)$')), '')
            )
        ELSE NULL
    END
"""


def _kategori_opd(nama_opd: str) -> str:
    n = (nama_opd or "").upper()
    if "RSUD" in n or n.startswith("RS ") or " RS " in f" {n} ":
        return "RSUD / Kesehatan"
    if any(k in n for k in ["SEKRETARIAT", "INSPEKTORAT", "BADAN"]):
        return "Sekretariat / Badan"
    return "Dinas"


PENSIUN_BUP_DEFAULT_MIN_OPD = (
    6  # kalau OPD Kritis+Waspada kurang dari ini, tambal dari ranking %
)


@router.get("/api/dashboard/pensiun-bup")
def dashboard_pensiun_bup(
    status: str | None = None,  # None=semua, "PNS", "PPPK", "PPPK PW"
    show_all: bool = False,  # True = tampilkan semua OPD yang lolos ambang pegawai
    limit: int | None = None,  # batasi jumlah OPD di breakdown (override default)
    db: Session = Depends(get_db),
):
    # --- Query utama: pensiun per opd_induk x opd_cabang x klaster x tahun ---
    query = text(f"""
        WITH semua_asn AS (
            SELECT
                {_OPD_INDUK_SQL} AS opd_induk,
                {_OPD_CABANG_SQL} AS opd_cabang,
                klaster,
                'PNS' AS jenis,
                safe_to_date(tmt_bup) AS tanggal_bup
            FROM pns
            WHERE opd IS NOT NULL AND tmt_bup IS NOT NULL

            UNION ALL

            SELECT
                {_OPD_INDUK_SQL} AS opd_induk,
                {_OPD_CABANG_SQL} AS opd_cabang,
                klaster,
                'PPPK' AS jenis,
                safe_to_date(bup) AS tanggal_bup
            FROM pppk_full
            WHERE opd IS NOT NULL AND bup IS NOT NULL

            UNION ALL

            SELECT
                {_OPD_INDUK_SQL} AS opd_induk,
                {_OPD_CABANG_SQL} AS opd_cabang,
                klaster,
                'PPPK PW' AS jenis,
                safe_to_date(tmt_bup) AS tanggal_bup
            FROM pppk_pw
            WHERE opd IS NOT NULL AND tmt_bup IS NOT NULL
        ),

        pensiun AS (
            SELECT opd_induk, opd_cabang, klaster, jenis,
                   EXTRACT(YEAR FROM tanggal_bup)::int AS year
            FROM semua_asn
            WHERE opd_induk <> ''
              AND tanggal_bup IS NOT NULL
              AND EXTRACT(YEAR FROM tanggal_bup) BETWEEN :tahun_awal AND :tahun_akhir
              AND (:status IS NULL OR jenis = :status)
        )

        SELECT opd_induk, opd_cabang, klaster, year, COUNT(*) AS total
        FROM pensiun
        GROUP BY opd_induk, opd_cabang, klaster, year
        ORDER BY opd_induk, year
    """)

    rows = (
        db.execute(
            query,
            {
                "tahun_awal": PENSIUN_BUP_TAHUN_AWAL,
                "tahun_akhir": PENSIUN_BUP_TAHUN_AKHIR,
                "status": status,
            },
        )
        .mappings()
        .all()
    )

    if not rows:
        return {
            "kpi": None,
            "lonjakan": None,
            "chart": [],
            "year_tiles": [],
            "opd_breakdown": [],
            "opd_top_volume": [],
            "opd_top_persen": [],
        }

    # --- Query total pegawai per OPD induk (semua status, tanpa filter tahun) ---
    # dipakai sebagai penyebut untuk menghitung %-pegawai yang pensiun.
    total_pegawai_query = text(f"""
        WITH semua AS (
            SELECT {_OPD_INDUK_SQL} AS opd_induk FROM pns WHERE opd IS NOT NULL
            UNION ALL
            SELECT {_OPD_INDUK_SQL} AS opd_induk FROM pppk_full WHERE opd IS NOT NULL
            UNION ALL
            SELECT {_OPD_INDUK_SQL} AS opd_induk FROM pppk_pw WHERE opd IS NOT NULL
        )
        SELECT opd_induk, COUNT(*) AS total
        FROM semua
        WHERE opd_induk <> ''
        GROUP BY opd_induk
    """)
    total_pegawai_per_opd = {
        r["opd_induk"]: r["total"]
        for r in db.execute(total_pegawai_query).mappings().all()
    }

    # --- Susun ulang jadi struktur nested ---
    per_opd_year: dict[str, dict[int, int]] = {}
    per_opd_cabang: dict[str, dict[str, int]] = {}
    per_opd_klaster_kumulatif: dict[str, dict[str, int]] = {}

    tahun_kumulatif = list(
        range(PENSIUN_BUP_TAHUN_AWAL, PENSIUN_BUP_TAHUN_KUMULATIF_AKHIR + 1)
    )

    for r in rows:
        opd = r["opd_induk"]
        per_opd_year.setdefault(opd, {})
        per_opd_year[opd][r["year"]] = per_opd_year[opd].get(r["year"], 0) + r["total"]

        if r["opd_cabang"]:
            per_opd_cabang.setdefault(opd, {})
            per_opd_cabang[opd][r["opd_cabang"]] = (
                per_opd_cabang[opd].get(r["opd_cabang"], 0) + r["total"]
            )

        if r["klaster"] and r["year"] in tahun_kumulatif:
            per_opd_klaster_kumulatif.setdefault(opd, {})
            per_opd_klaster_kumulatif[opd][r["klaster"]] = (
                per_opd_klaster_kumulatif[opd].get(r["klaster"], 0) + r["total"]
            )

    tahun_range = list(range(PENSIUN_BUP_TAHUN_AWAL, PENSIUN_BUP_TAHUN_AKHIR + 1))

    def total_opd_tahun(opd: str, y: int) -> int:
        return per_opd_year.get(opd, {}).get(y, 0)

    # Total per OPD selama jendela kumulatif
    total_kumulatif_per_opd = {
        opd: sum(total_opd_tahun(opd, y) for y in tahun_kumulatif)
        for opd in per_opd_year
    }

    # Ranking berbasis VOLUME (dipakai untuk chart, biar OPD besar tetap kebaca)
    opd_terurut_volume = sorted(
        total_kumulatif_per_opd.items(), key=lambda kv: kv[1], reverse=True
    )
    top5_opd = [opd for opd, _ in opd_terurut_volume[:5]]

    # Ranking berbasis PERSENTASE pegawai OPD yang pensiun (lebih adil untuk
    # OPD kecil), dengan ambang minimal jumlah pegawai supaya %-nya tidak bising.
    def persen_opd(opd: str) -> float:
        total_pegawai = total_pegawai_per_opd.get(opd, 0)
        if not total_pegawai:
            return 0.0
        return round(total_kumulatif_per_opd[opd] * 100.0 / total_pegawai, 1)

    opd_layak_persen = [
        opd
        for opd in total_kumulatif_per_opd
        if total_pegawai_per_opd.get(opd, 0) >= PENSIUN_BUP_MIN_PEGAWAI_OPD
    ]
    opd_terurut_persen = sorted(
        opd_layak_persen, key=lambda opd: persen_opd(opd), reverse=True
    )

    # --- Pilih OPD mana yang masuk tabel breakdown ---
    # Default: SEMUA OPD berstatus "Kritis" (>=20%) atau "Waspada" (>=10%),
    # bukan angka tetap — supaya OPD berisiko tidak pernah tersembunyi hanya
    # karena kalah ranking dari OPD lain. Kalau ternyata OPD kritis/waspada
    # kurang dari PENSIUN_BUP_DEFAULT_MIN_OPD, ditambal dari ranking %
    # tertinggi biar tabelnya tidak kosong/terlalu pendek.
    # `show_all=true`  -> semua OPD yang lolos ambang PENSIUN_BUP_MIN_PEGAWAI_OPD.
    # `limit=N`        -> paksa N OPD teratas (override kriteria di atas).
    if show_all:
        opd_terpilih = opd_terurut_persen
    elif limit is not None:
        opd_terpilih = opd_terurut_persen[: max(limit, 0)]
    else:
        kritis_waspada = [opd for opd in opd_terurut_persen if persen_opd(opd) >= 10]
        opd_terpilih = (
            kritis_waspada
            if len(kritis_waspada) >= PENSIUN_BUP_DEFAULT_MIN_OPD
            else opd_terurut_persen[:PENSIUN_BUP_DEFAULT_MIN_OPD]
        )

    opd_breakdown_terpilih = opd_terpilih or [o for o, _ in opd_terurut_volume[:6]]

    # --- 1. Data chart 2026-2035: 5 OPD volume teratas, masing-masing garis sendiri ---
    chart = []
    for y in tahun_range:
        entry = {"year": str(y)}
        for idx, opd in enumerate(top5_opd):
            entry[f"opd{idx + 1}"] = total_opd_tahun(opd, y)
        chart.append(entry)

    chart_series_labels = {f"opd{idx + 1}": nama for idx, nama in enumerate(top5_opd)}

    # --- 2. Tile per tahun (2026-2030), total semua OPD ---
    year_tiles = [
        {
            "year": str(y),
            "total": sum(total_opd_tahun(opd, y) for opd in per_opd_year),
        }
        for y in tahun_kumulatif
    ]

    # --- 3. Tabel breakdown OPD, diurutkan berdasarkan % pegawai yang pensiun ---
    # Urgensi kini berbasis persentase riil, bukan cuma ranking volume:
    # >=20% = Kritis, 10-20% = Waspada, <10% = Aman.
    opd_breakdown = []
    for opd in opd_breakdown_terpilih:
        per_tahun = [total_opd_tahun(opd, y) for y in tahun_kumulatif]
        pct = persen_opd(opd)

        if pct >= 20:
            urgensi = "Kritis"
        elif pct >= 10:
            urgensi = "Waspada"
        else:
            urgensi = "Aman"

        klaster_counts = per_opd_klaster_kumulatif.get(opd, {})
        klaster_dominan = (
            max(klaster_counts.items(), key=lambda kv: kv[1])[0]
            if klaster_counts
            else None
        )

        cabang_counts = per_opd_cabang.get(opd, {})
        top_cabang = None
        if cabang_counts:
            nama_cabang, jml_cabang = max(cabang_counts.items(), key=lambda kv: kv[1])
            top_cabang = {"nama": nama_cabang, "total": jml_cabang}

        opd_breakdown.append(
            {
                "opd": opd,
                "kategori": _kategori_opd(opd),
                "years": [str(y) for y in tahun_kumulatif],
                "y": per_tahun,
                "total": sum(per_tahun),
                "total_pegawai_opd": total_pegawai_per_opd.get(opd, 0),
                "persen_opd": pct,
                "klaster_dominan": klaster_dominan,
                "top_cabang": top_cabang,
                "urgensi": urgensi,
            }
        )

    # --- 3b. Breakdown cabang/wilayah untuk OPD nomor 1 (biasanya Dinas
    # Pendidikan) — supaya kelihatan wilayah mana yang paling butuh formasi ---
    cabang_breakdown = None
    if opd_breakdown:
        opd_teratas = opd_breakdown[0]["opd"]
        cabang_counts = per_opd_cabang.get(opd_teratas, {})
        if cabang_counts:
            top_cabang_list = sorted(
                cabang_counts.items(), key=lambda kv: kv[1], reverse=True
            )[:10]
            cabang_breakdown = {
                "opd": opd_teratas,
                "cabang": [
                    {"nama": nama, "total": total} for nama, total in top_cabang_list
                ],
            }

    # --- 3c. Perbandingan peringkat: top 5 volume vs top 5 persentase ---
    # Dipakai untuk insight "OPD besar (volume) belum tentu OPD genting (%)".
    # Sengaja dua daftar terpisah, bukan satu tabel gabungan, supaya kelihatan
    # jelas kalau OPD volume tertinggi (biasanya Dinas Pendidikan) seringkali
    # tidak muncul sama sekali di daftar persentase tertinggi, dan sebaliknya.
    opd_top_volume = [
        {"opd": opd, "total": total} for opd, total in opd_terurut_volume[:5]
    ]
    opd_top_persen = [
        {
            "opd": opd,
            "persen_opd": persen_opd(opd),
            "total_pegawai_opd": total_pegawai_per_opd.get(opd, 0),
        }
        for opd in opd_terurut_persen[:5]
    ]

    # --- 4. KPI ringkas ---
    pensiun_tahun_ini = sum(
        total_opd_tahun(opd, PENSIUN_BUP_TAHUN_AWAL) for opd in per_opd_year
    )
    kumulatif_5_tahun = sum(year_tiles[i]["total"] for i in range(len(year_tiles)))
    opd_tertinggi_volume_nama, opd_tertinggi_volume_total = (
        opd_terurut_volume[0] if opd_terurut_volume else (None, 0)
    )
    opd_tertinggi_persen_nama = opd_terurut_persen[0] if opd_terurut_persen else None

    kpi = {
        "pensiun_tahun_ini": {
            "tahun": PENSIUN_BUP_TAHUN_AWAL,
            "total": pensiun_tahun_ini,
        },
        "kumulatif_5_tahun": {
            "dari_tahun": PENSIUN_BUP_TAHUN_AWAL,
            "sampai_tahun": PENSIUN_BUP_TAHUN_KUMULATIF_AKHIR,
            "total": kumulatif_5_tahun,
        },
        "opd_tertinggi": {
            # tetap disediakan untuk kompatibilitas — nama OPD dgn volume terbesar
            "nama": opd_tertinggi_volume_nama,
            "total_5_tahun": opd_tertinggi_volume_total,
        },
        "opd_tertinggi_persen": {
            "nama": opd_tertinggi_persen_nama,
            "persen": (
                persen_opd(opd_tertinggi_persen_nama)
                if opd_tertinggi_persen_nama
                else 0
            ),
        },
    }

    # --- 5. Lonjakan YoY terbesar (persen), dalam rentang tahun_range ---
    lonjakan = None
    lonjakan_pct_max = None
    for i in range(1, len(chart)):
        tahun_sebelum = tahun_range[i - 1]
        tahun_ini = tahun_range[i]
        total_sebelum = sum(total_opd_tahun(opd, tahun_sebelum) for opd in per_opd_year)
        total_ini = sum(total_opd_tahun(opd, tahun_ini) for opd in per_opd_year)

        if total_sebelum <= 0:
            continue

        pct = round(((total_ini - total_sebelum) / total_sebelum) * 100, 1)
        if lonjakan_pct_max is None or pct > lonjakan_pct_max:
            lonjakan_pct_max = pct
            lonjakan = {
                "dari_tahun": tahun_sebelum,
                "ke_tahun": tahun_ini,
                "pct": pct,
            }

    return {
        "kpi": kpi,
        "lonjakan": lonjakan,
        "filter_status": status,
        "chart": chart,
        "chart_series_labels": chart_series_labels,
        "year_tiles": year_tiles,
        "opd_breakdown": opd_breakdown,
        "cabang_breakdown": cabang_breakdown,
        "opd_top_volume": opd_top_volume,
        "opd_top_persen": opd_top_persen,
    }
