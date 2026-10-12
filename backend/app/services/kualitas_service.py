"""
kualitas_service.py
Logic untuk fitur "Kualitas Data" SIAP-ASN.
Dipanggil dari app/routers/kualitas.py sebagai: compute_kualitas_data(db: Session)

Sumber data: Supabase Postgres, 3 tabel (pns, pppk_full, pppk_pw) yang
sudah melalui preprocessing (lihat dataset/preprocess.ipynb) sehingga:
- kolom teks (opd, pendidikan, nama_jabatan/jabatan, status_kepegawaian, tmt_cp)
  sudah bersih dari suffix "null"/whitespace kotor
- kolom tanggal prediksi pensiun (tmt_bup / bup) sudah diklasifikasi:
    * valid  -> tanggal asli, flag invalid = false
    * format rusak (00:00:00 / #N/A / 0000-00-00 di raw Excel) -> di-set NULL,
      flag invalid = true
    * genuinely kosong dari awal -> NULL, flag invalid = false

=====================================================================
ASUMSI SKEMA (tolong cek & sesuaikan bagian SOURCES kalau beda!):
=====================================================================
- Tabel: pns, pppk_full, pppk_pw
- Kolom sama di ketiganya: opd, pendidikan, klaster, status_kepegawaian,
  jenis_kelamin, tmt_cp (semua text/varchar)
- Kolom tanggal prediksi pensiun (date/timestamp):
    pns.tmt_bup | pppk_full.bup | pppk_pw.tmt_bup
- Kolom flag format rusak (boolean):
    pns.tmt_bup_invalid | pppk_full.bup_invalid | pppk_pw.tmt_bup_invalid
- Kolom nama jabatan (text):
    pns.nama_jabatan | pppk_full.jabatan | pppk_pw.nama_jabatan
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

# Field UI (5 field "diganti" sesuai keputusan sebelumnya + 1 field sisa)
# key -> nama kolom per tabel. "nomor_sk_terakhir" ditangani terpisah karena
# tipe datanya date, bukan text, dan punya flag invalid.
SOURCES = [
    {
        "key": "pns",
        "table": "pns",
        "label": "Data PNS",
        "text_cols": {
            "tingkat_pendidikan": "pendidikan",
            "unit_kerja_detail": "opd",
            "jabatan_fungsional": "nama_jabatan",
        },
        "date_col": "tmt_bup",
        "invalid_flag_col": "tmt_bup_invalid",
    },
    {
        "key": "pppk_full",
        "table": "pppk_full",
        "label": "PPPK Penuh Waktu",
        "text_cols": {
            "tingkat_pendidikan": "pendidikan",
            "unit_kerja_detail": "opd",
            "jabatan_fungsional": "jabatan",
        },
        "date_col": "bup",
        "invalid_flag_col": "bup_invalid",
    },
    {
        "key": "pppk_pw",
        "table": "pppk_pw",
        "label": "PPPK Paruh Waktu",
        "text_cols": {
            "tingkat_pendidikan": "pendidikan",
            "unit_kerja_detail": "opd",
            "jabatan_fungsional": "nama_jabatan",
        },
        "date_col": "tmt_bup",
        "invalid_flag_col": "tmt_bup_invalid",
    },
]

# CATATAN: "Tanggal Lahir" (sempat di-map ke tmt_cp) dan "TMT Jabatan"
# (sempat di-map ke status_kepegawaian) SUDAH DIHAPUS dari sini.
# tmt_cp itu kode periode CPNS, bukan tanggal lahir - dataset memang
# tidak punya kolom tanggal lahir sama sekali. status_kepegawaian
# hampir selalu terisi konstan (PNS/CPNS/PPPK/PPPK PW), jadi checknya
# gak merepresentasikan anomali apapun. Field yang tersisa di bawah ini
# semuanya genuinely ngecek kolom yang benar-benar ada & bisa kosong.

FIELD_LABELS = {
    "tingkat_pendidikan": "Tingkat Pendidikan",
    "nomor_sk_terakhir": "TMT BUP (Prediksi Pensiun)",  # kolomnya tmt_bup/bup, bukan nomor SK
    "unit_kerja_detail": "OPD / Unit Kerja",
    "jabatan_fungsional": "Nama Jabatan",
}
# urutan ini yang dipakai di tabel Anomali
FIELD_ORDER = [
    "tingkat_pendidikan", "nomor_sk_terakhir",
    "unit_kerja_detail", "jabatan_fungsional",
]

# aksi rekomendasi per field, dipakai buat kartu "Prioritas Perbaikan Data".
# CATATAN: teks ini masih placeholder generik - logic rekomendasi yang
# lebih pintar/kontekstual rencananya digarap di fitur Asisten AI (Dinda).
FIELD_ACTIONS = {
    "Tingkat Pendidikan": "Upload ijazah digital ke modul verifikasi dokumen",
    "TMT BUP (Prediksi Pensiun)": "Sinkronisasi dengan SAPK BKN untuk data yang kosong/format tidak valid",
    "OPD / Unit Kerja": "Konfirmasi langsung ke OPD terkait melalui portal validasi mandiri",
    "Nama Jabatan": "Rekonsiliasi data jabatan dengan sistem SIMPEG masing-masing OPD",
}


# Threshold status (sudah divalidasi sebelumnya)
def _status(pct: float) -> str:
    if pct > 4:
        return "Kritis"
    if pct > 2:
        return "Waspada"
    return "Aman"


def _empty_text_clause(col: str) -> str:
    """Kondisi SQL 'kosong' untuk kolom teks: NULL, string kosong, atau
    literal 'null'/'none'/'nan' (case-insensitive, sudah di-trim)."""
    return (
        f"({col} IS NULL OR TRIM({col}::text) = '' "
        f"OR LOWER(TRIM({col}::text)) IN ('null','none','nan'))"
    )


def _row_completeness_sql(src: dict) -> str:
    """Baris dianggap 'lengkap' kalau SEMUA field kunci terisi
    (row-level completeness, dipakai untuk skor KPI utama)."""
    tc = src["text_cols"]
    conds = [f"NOT {_empty_text_clause(col)}" for col in tc.values()]
    conds.append(f"{src['date_col']} IS NOT NULL")
    where_lengkap = " AND ".join(conds)
    return f"""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE {where_lengkap}) AS lengkap
        FROM {src['table']}
    """


def _field_counts_sql(src: dict) -> str:
    """Hitung jumlah kosong PER FIELD (field-level completeness),
    dipakai untuk tabel Anomali & Data Tidak Lengkap."""
    tc = src["text_cols"]
    selects = [
        f"COUNT(*) FILTER (WHERE {_empty_text_clause(col)}) AS {field}_kosong"
        for field, col in tc.items()
    ]
    # nomor_sk_terakhir: kosong = NULL (baik genuinely missing maupun bekas format rusak)
    selects.append(f"COUNT(*) FILTER (WHERE {src['date_col']} IS NULL) AS nomor_sk_terakhir_kosong")
    # breakdown: dari yang NULL itu, berapa yang sebenarnya "format rusak" (bukan genuinely kosong)
    selects.append(f"COUNT(*) FILTER (WHERE {src['invalid_flag_col']} = true) AS nomor_sk_terakhir_invalid")
    selects.append("COUNT(*) AS total")
    return "SELECT " + ", ".join(selects) + f" FROM {src['table']}"


def compute_kualitas_data(db: Session) -> dict:
    kpi = []
    bup_breakdown = []
    field_totals = {f: {"kosong": 0, "total": 0} for f in FIELD_ORDER}
    field_totals["nomor_sk_terakhir"]["invalid_format"] = 0

    for src in SOURCES:
        row = db.execute(text(_row_completeness_sql(src))).mappings().first()
        total, lengkap = row["total"] or 0, row["lengkap"] or 0
        skor = round((lengkap / total) * 100, 1) if total else 0.0
        kpi.append({
            "key": src["key"],
            "sumber": src["label"],
            "skor": skor,
            "lengkap": lengkap,
            "total": total,
        })

        frow = db.execute(text(_field_counts_sql(src))).mappings().first()

        # breakdown TMT BUP per sumber - ini temuan utama proyek ini
        # (PPPK Paruh Waktu jauh lebih parah dari PNS/PPPK Penuh Waktu),
        # jangan sampai hilang gara-gara diagregat jadi 1 angka doang.
        kosong_src = frow["nomor_sk_terakhir_kosong"] or 0
        invalid_src = frow["nomor_sk_terakhir_invalid"] or 0
        bup_breakdown.append({
            "key": src["key"],
            "sumber": src["label"],
            "valid": total - kosong_src,
            "genuinely_kosong": kosong_src - invalid_src,
            "invalid_format": invalid_src,
            "total": total,
        })

        for field in src["text_cols"]:
            field_totals[field]["kosong"] += frow[f"{field}_kosong"] or 0
            field_totals[field]["total"] += total
        field_totals["nomor_sk_terakhir"]["kosong"] += frow["nomor_sk_terakhir_kosong"] or 0
        field_totals["nomor_sk_terakhir"]["total"] += total
        field_totals["nomor_sk_terakhir"]["invalid_format"] += frow["nomor_sk_terakhir_invalid"] or 0

    anomali = []
    for field in FIELD_ORDER:
        d = field_totals[field]
        pct = round((d["kosong"] / d["total"]) * 100, 2) if d["total"] else 0.0
        row = {
            "field": FIELD_LABELS[field],
            "kosong": d["kosong"],
            "total": d["total"],
            "pct": pct,
            "status": _status(pct),
        }
        if field == "nomor_sk_terakhir":
            row["invalid_format"] = d["invalid_format"]
            row["genuinely_kosong"] = d["kosong"] - d["invalid_format"]
        anomali.append(row)

    # urutkan dari yang paling bermasalah - biar field "0% aman" gak
    # menuh-menuhin baris atas tabel tanpa alasan
    anomali.sort(key=lambda r: r["pct"], reverse=True)

    # prioritas: HANYA field yang genuinely punya masalah (pct > 0).
    # jangan padding dengan field yang udah 0% cuma buat genepin jumlah 4.
    prioritas = [
        {
            "field": r["field"],
            "pct": r["pct"],
            "urgent": r["status"] == "Kritis",
            "action": FIELD_ACTIONS.get(r["field"], ""),
        }
        for r in anomali if r["pct"] > 0
    ][:4]

    return {
        "periode": "Agustus 2026",
        "kpi": kpi,
        "anomali": anomali,
        "prioritas": prioritas,
        "bup_breakdown": bup_breakdown,
    }
