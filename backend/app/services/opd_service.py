"""
opd_service.py
Logic untuk fitur "Perbandingan Antar OPD" SIAP-ASN.
Dipanggil dari app/routers/opd.py sebagai: compute_perbandingan_opd(db: Session)

=====================================================================
UPDATE (revisi berdasarkan masukan mentor BKD)
=====================================================================
Ditambah kriteria ke-5: KOMPOSISI GENERASI. Mentor bilang komposisi
generasi ideal untuk organisasi saat ini: BabyBoom 5%, GenX 10%,
Milenial 50%, GenZ 35%. Skor ini ngukur seberapa jauh komposisi generasi
riil di 1 OPD dari target ideal itu (makin jauh, makin rendah skornya).
Klasifikasi generasi berdasar usia sama persis kayak yang dipakai Dinda
di app/routers/dashboard.py (dashboard_generasi): usia>=61 BabyBoom,
>=45 GenX, >=29 Milenial, sisanya GenZ.

CATATAN JUJUR (baca sebelum klaim "sudah sesuai masukan mentor" ke
siapa pun): masukan mentor ada ~8 poin, baru poin #7 (komposisi generasi)
ini yang diimplementasi, karena datanya udah ada (kolom usia). Poin #6
(klaster = prioritas sektor Pendidikan/Kesehatan sebagai layanan dasar)
dan #9 (jabatan "utama" per OPD lebih prioritas drpd sekadar persentase)
BELUM diimplementasi - keduanya butuh data tambahan yang gak ada di 3
dataset awal (daftar jabatan utama per OPD, definisi resmi sektor
prioritas). Ini masih known limitation, bukan sudah selesai.

=====================================================================
TEMUAN PENTING (jangan hapus catatan ini tanpa validasi ulang ke data)
=====================================================================
Kolom `opd` di 3 tabel ISI-NYA BUKAN nama OPD induk (56 dinas/badan Jatim),
tapi PATH LENGKAP unit kerja sampai level Seksi/UPT/Sub Bagian. Fix:
grouping pakai UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))).

Asumsi jenis_jabatan = "Struktural"/"Fungsional"/"Pelaksana" SUDAH
DIVALIDASI ke data asli (SELECT DISTINCT jenis_jabatan di pns & pppk_full),
cocok 100%. PPPK (pppk_full) terkonfirmasi TIDAK PERNAH punya
jenis_jabatan='Struktural' - sejalan dengan konfirmasi mentor bahwa PPPK
di Pemprov Jatim belum bisa menduduki jabatan struktural.

=====================================================================
KEPUTUSAN DESAIN LAIN (baca sebelum ubah logic ini)
=====================================================================
1. SKALA SKOR: tinggi = AMAN, rendah = KRITIS. Konsisten sama badge
   Kritis/Waspada/Aman di frontend.

2. BOBOT 5 KRITERIA (WEIGHTS di bawah) masih ANGKA DEFAULT SEMENTARA,
   belum divalidasi formal ke BKD. Sengaja dibikin gampang diubah
   (parameter `weights`) karena ini yang nantinya jadi input fitur
   Simulator Optimasi Bobot Kriteria.

3. Skor "Klaster SDM" masih PROKSI KASAR redundansi (klaster <=3 orang =
   rawan), BELUM mencerminkan "prioritas sektor" yang dimaksud mentor.

4. "Pensiun ≤12 bulan" dihitung dari REFERENCE_DATE (Agustus 2026).
"""

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

REFERENCE_DATE = date(2026, 8, 31)

# Komposisi generasi ideal menurut mentor BKD (dalam persen, total 100)
IDEAL_GENERASI = {
    "baby_boom": 5,
    "gen_x": 10,
    "milenial": 50,
    "gen_z": 35,
}

WEIGHTS = {
    "usia": 30,
    "bup": 25,
    "jenis_jabatan": 20,
    "klaster": 10,
    "generasi": 15,
}


def _kategori(skor: float) -> str:
    if skor < 60:
        return "Kritis"
    if skor < 75:
        return "Waspada"
    return "Aman"


# Query gabungan 3 sumber, di-GROUP BY opd_induk (segmen pertama sebelum
# " - "), BUKAN kolom opd mentah yang isinya path unit kerja lengkap.
# Ditambah breakdown per generasi (klasifikasi sama kayak dashboard.py).
_AGGREGATE_SQL_V2 = """
    WITH semua_asn AS (
        SELECT
            UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk,
            umur::numeric AS usia,
            tmt_bup::date AS tanggal_bup,
            jenis_jabatan,
            klaster,
            nama_jabatan AS jabatan
        FROM pns
        WHERE opd IS NOT NULL

        UNION ALL

        SELECT
            UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk,
            usia::numeric AS usia,
            bup::date AS tanggal_bup,
            jenis_jabatan,
            klaster,
            jabatan
        FROM pppk_full
        WHERE opd IS NOT NULL

        UNION ALL

        SELECT
            UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk,
            usia::numeric AS usia,
            tmt_bup::date AS tanggal_bup,
            jenis_jabatan,
            klaster,
            nama_jabatan AS jabatan
        FROM pppk_pw
        WHERE opd IS NOT NULL
    ),

    klaster_per_opd AS (
        SELECT
            opd_induk,
            klaster,
            COUNT(*) AS jumlah_orang
        FROM semua_asn
        WHERE opd_induk <> ''
        GROUP BY opd_induk, klaster
    ),

    klaster_summary AS (
        SELECT
            opd_induk,
            COUNT(*) AS jumlah_klaster,
            COUNT(*) FILTER (WHERE jumlah_orang <= 3) AS klaster_rawan
        FROM klaster_per_opd
        GROUP BY opd_induk
    )

    SELECT
        s.opd_induk AS opd,
        COUNT(*) AS total_asn,
        ROUND(AVG(s.usia), 1) AS rata_usia,

        COUNT(*) FILTER (WHERE s.usia > 50) AS jumlah_usia_diatas_50,

        COUNT(*) FILTER (
            WHERE s.tanggal_bup IS NOT NULL
              AND s.tanggal_bup BETWEEN :ref_date AND :ref_date + INTERVAL '6 months'
        ) AS pensiun_0_6,

        COUNT(*) FILTER (
            WHERE s.tanggal_bup IS NOT NULL
              AND s.tanggal_bup > :ref_date + INTERVAL '6 months'
              AND s.tanggal_bup <= :ref_date + INTERVAL '12 months'
        ) AS pensiun_6_12,

        COUNT(*) FILTER (WHERE s.jenis_jabatan = 'Struktural') AS total_struktural,
        COUNT(*) FILTER (
            WHERE s.jenis_jabatan = 'Struktural'
              AND s.tanggal_bup IS NOT NULL
              AND s.tanggal_bup <= :ref_date + INTERVAL '12 months'
        ) AS struktural_pensiun_12bln,

        COUNT(*) FILTER (WHERE s.jenis_jabatan IN ('Fungsional', 'Pelaksana')) AS total_fungsional,
        COUNT(*) FILTER (
            WHERE s.jenis_jabatan IN ('Fungsional', 'Pelaksana')
              AND s.tanggal_bup IS NOT NULL
              AND s.tanggal_bup <= :ref_date + INTERVAL '12 months'
        ) AS fungsional_pensiun_12bln,

        MAX(ks.jumlah_klaster) AS jumlah_klaster,
        MAX(ks.klaster_rawan) AS klaster_rawan,

        -- Breakdown generasi (sama persis klasifikasi dashboard.py Dinda)
        COUNT(*) FILTER (WHERE s.usia >= 61) AS jumlah_baby_boom,
        COUNT(*) FILTER (WHERE s.usia >= 45 AND s.usia < 61) AS jumlah_gen_x,
        COUNT(*) FILTER (WHERE s.usia >= 29 AND s.usia < 45) AS jumlah_milenial,
        COUNT(*) FILTER (WHERE s.usia < 29) AS jumlah_gen_z

    FROM semua_asn s
    JOIN klaster_summary ks ON ks.opd_induk = s.opd_induk
    WHERE s.opd_induk <> ''
    GROUP BY s.opd_induk
"""

# Jabatan berisiko per rentang waktu, JUGA di-group by opd_induk.
_JABATAN_BERISIKO_SQL = """
    WITH semua_asn AS (
        SELECT UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk, tmt_bup::date AS tanggal_bup,
               jenis_jabatan, nama_jabatan AS jabatan
        FROM pns WHERE opd IS NOT NULL

        UNION ALL

        SELECT UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk, bup::date AS tanggal_bup,
               jenis_jabatan, jabatan
        FROM pppk_full WHERE opd IS NOT NULL

        UNION ALL

        SELECT UPPER(TRIM(SPLIT_PART(opd, ' - ', 1))) AS opd_induk, tmt_bup::date AS tanggal_bup,
               jenis_jabatan, nama_jabatan AS jabatan
        FROM pppk_pw WHERE opd IS NOT NULL
    )
    SELECT
        opd_induk AS opd,
        jabatan,
        jenis_jabatan,
        CASE
            WHEN tanggal_bup <= :ref_date + INTERVAL '6 months' THEN '0-6'
            ELSE '6-12'
        END AS rentang,
        COUNT(*) AS jumlah
    FROM semua_asn
    WHERE tanggal_bup IS NOT NULL
      AND tanggal_bup BETWEEN :ref_date AND :ref_date + INTERVAL '12 months'
      AND opd_induk <> ''
    GROUP BY opd_induk, jabatan, jenis_jabatan, rentang
    ORDER BY opd_induk, rentang, jumlah DESC
"""

BADGE_MAP = {
    "Struktural": "Str",
    "Fungsional": "Fun",
    "Pelaksana": "Pel",
}


def _generasi_score(row, total: int) -> float:
    """Skor deviasi dari komposisi generasi ideal (mentor BKD): BabyBoom
    5%, GenX 10%, Milenial 50%, GenZ 35%. Makin jauh komposisi riil dari
    target ideal, makin rendah skornya. Deviasi dihitung sebagai total
    selisih absolut per generasi dibagi 2 (karena total selisih 2 arah
    selalu digandakan), sehingga range deviasi 0-100."""
    if not total:
        return 100.0
    actual = {
        "baby_boom": _pct(row["jumlah_baby_boom"], total),
        "gen_x": _pct(row["jumlah_gen_x"], total),
        "milenial": _pct(row["jumlah_milenial"], total),
        "gen_z": _pct(row["jumlah_gen_z"], total),
    }
    deviasi = sum(abs(actual[k] - IDEAL_GENERASI[k]) for k in IDEAL_GENERASI) / 2
    return max(0.0, round(100 - deviasi, 1))


def _pct(n, total):
    return round((n / total) * 100, 1) if total else 0.0


# Daftar kriteria & urutan kolom yang dipakai bareng sama optimasi_service.py
# (Simulator Optimasi Bobot Kriteria). PENTING: kalau nambah/ubah kriteria di
# sini, WEIGHTS di atas dan KRITERIA di optimasi_service.py HARUS disamakan
# urutannya, karena optimizer baca sub-skor lewat key "{nama}_score" persis
# seperti yang di-return _hitung_sub_skor() di bawah.
KRITERIA_URUTAN = ["usia", "bup", "jenis_jabatan", "klaster", "generasi"]


def _hitung_sub_skor(db: Session) -> list[dict]:
    """Hitung SEMUA sub-skor mentah per OPD (usia_score, bup_score, dst),
    TANPA menerapkan bobot dan TANPA query jabatan_berisiko (yang lebih
    berat & gak dibutuhkan optimizer). Dipakai oleh:
    - compute_perbandingan_opd() di bawah, buat endpoint utama
    - optimasi_service.py, buat evaluasi fitness GA/PSO/SA tanpa perlu
      query DB berulang kali di dalam loop optimasi (lihat catatan di
      optimasi_service.py: query dipanggil SEKALI di luar loop).
    """
    rows = db.execute(text(_AGGREGATE_SQL_V2), {"ref_date": REFERENCE_DATE}).mappings().all()

    hasil = []
    for row in rows:
        total = row["total_asn"] or 0
        pensiun_12 = (row["pensiun_0_6"] or 0) + (row["pensiun_6_12"] or 0)

        usia_score = max(0, 100 - _pct(row["jumlah_usia_diatas_50"], total))
        bup_score = max(0, 100 - _pct(pensiun_12, total) * 3)

        struk_total = row["total_struktural"] or 0
        struk_pensiun = row["struktural_pensiun_12bln"] or 0
        jenis_jabatan_score = max(0, 100 - _pct(struk_pensiun, struk_total) * 2) if struk_total else 100.0

        klaster_total = row["jumlah_klaster"] or 0
        klaster_rawan = row["klaster_rawan"] or 0
        klaster_score = max(0, 100 - _pct(klaster_rawan, klaster_total)) if klaster_total else 100.0

        generasi_score = _generasi_score(row, total)

        fung_total = row["total_fungsional"] or 0
        fung_pensiun = row["fungsional_pensiun_12bln"] or 0
        skor_struktural = round(max(0, 100 - _pct(struk_pensiun, struk_total) * 2), 1) if struk_total else 100.0
        skor_fungsional = round(max(0, 100 - _pct(fung_pensiun, fung_total) * 2), 1) if fung_total else 100.0

        hasil.append({
            "opd": row["opd"],
            "total_asn": total,
            "rata_usia": float(row["rata_usia"] or 0),
            "pensiun_0_6": row["pensiun_0_6"] or 0,
            "pensiun_6_12": row["pensiun_6_12"] or 0,
            "pensiun_12_bulan": pensiun_12,

            "usia_score": round(usia_score, 1),
            "bup_score": round(bup_score, 1),
            "jenis_jabatan_score": round(jenis_jabatan_score, 1),
            "klaster_score": round(klaster_score, 1),
            "generasi_score": round(generasi_score, 1),

            "skor_struktural": skor_struktural,
            "skor_fungsional": skor_fungsional,
            "jumlah_struktural_kosong_12bln": struk_pensiun,

            "komposisi_generasi": {
                "baby_boom": _pct(row["jumlah_baby_boom"], total),
                "gen_x": _pct(row["jumlah_gen_x"], total),
                "milenial": _pct(row["jumlah_milenial"], total),
                "gen_z": _pct(row["jumlah_gen_z"], total),
            },
        })

    return hasil


def compute_perbandingan_opd(db: Session, weights: dict | None = None) -> list[dict]:
    w = weights or WEIGHTS

    sub_skor = _hitung_sub_skor(db)

    jabatan_rows = db.execute(text(_JABATAN_BERISIKO_SQL), {"ref_date": REFERENCE_DATE}).mappings().all()
    jabatan_by_opd: dict[str, dict[str, list]] = {}
    for jr in jabatan_rows:
        jabatan_by_opd.setdefault(jr["opd"], {"0-6": [], "6-12": []})
        jabatan_by_opd[jr["opd"]][jr["rentang"]].append({
            "badge": BADGE_MAP.get(jr["jenis_jabatan"], "Lainnya"),
            "nama": jr["jabatan"],
            "jumlah": jr["jumlah"],
        })

    result = []
    for s in sub_skor:
        skor_komposit = round(
            (s["usia_score"] * w["usia"] + s["bup_score"] * w["bup"] +
             s["jenis_jabatan_score"] * w["jenis_jabatan"] + s["klaster_score"] * w["klaster"] +
             s["generasi_score"] * w["generasi"]) / 100,
            1,
        )

        opd_name = s["opd"]
        jabatan_detail = jabatan_by_opd.get(opd_name, {"0-6": [], "6-12": []})

        result.append({
            "nama": opd_name,
            "total_asn": s["total_asn"],
            "rata_usia": s["rata_usia"],
            "pensiun_0_6": s["pensiun_0_6"],
            "pensiun_6_12": s["pensiun_6_12"],
            "pensiun_12_bulan": s["pensiun_12_bulan"],
            "pensiun_12_bulan_pct": _pct(s["pensiun_12_bulan"], s["total_asn"]),

            "skor_komposit": skor_komposit,
            "kategori": _kategori(skor_komposit),

            "skor_struktural": s["skor_struktural"],
            "kategori_struktural": _kategori(s["skor_struktural"]),
            "jumlah_struktural_kosong_12bln": s["jumlah_struktural_kosong_12bln"],

            "skor_fungsional": s["skor_fungsional"],
            "kategori_fungsional": _kategori(s["skor_fungsional"]),

            # Business rule: OPD dianggap "perlu perhatian" (prioritas) kalau
            # skor komposit-nya Kritis, ATAU risiko strukturalnya Kritis -
            # walau komposit keseluruhan masih Aman/Waspada. Ini karena
            # jabatan struktural gak bisa ditutup PPPK, jadi kritis di sisi
            # struktural selalu darurat gak peduli skor gabungan lainnya.
            "perlu_perhatian": _kategori(skor_komposit) == "Kritis" or _kategori(s["skor_struktural"]) == "Kritis",

            "kontribusi_skor": {
                "usia": s["usia_score"],
                "bup": s["bup_score"],
                "jenis_jabatan": s["jenis_jabatan_score"],
                "klaster": s["klaster_score"],
                "generasi": s["generasi_score"],
            },

            "komposisi_generasi": s["komposisi_generasi"],

            "jabatan_berisiko": jabatan_detail,
        })

    result.sort(key=lambda r: r["skor_komposit"])
    for i, r in enumerate(result):
        r["id"] = i + 1

    return result