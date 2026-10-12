from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import REFERENCE_DATE
from app.database import get_db
from app.routers.pensiun_bup import dashboard_pensiun_bup

router = APIRouter(tags=["Dashboard"])


# ============================================================
# 1. SUMMARY DASHBOARD
# ============================================================


@router.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (
            SELECT umur::numeric AS usia, safe_to_date(tmt_bup) AS tanggal_bup
            FROM pns

            UNION ALL

            SELECT usia::numeric AS usia, safe_to_date(bup) AS tanggal_bup
            FROM pppk_full

            UNION ALL

            SELECT usia::numeric AS usia, safe_to_date(tmt_bup) AS tanggal_bup
            FROM pppk_pw
        )

        SELECT
            (SELECT COUNT(*) FROM pns) AS total_pns,
            (SELECT COUNT(*) FROM pppk_full) AS total_pppk_full,
            (SELECT COUNT(*) FROM pppk_pw) AS total_pppk_pw,
            (SELECT COUNT(*) FROM semua_asn) AS total_asn,
            (SELECT COUNT(DISTINCT opd) FROM (
                SELECT opd FROM pns WHERE opd IS NOT NULL
                UNION
                SELECT opd FROM pppk_full WHERE opd IS NOT NULL
                UNION
                SELECT opd FROM pppk_pw WHERE opd IS NOT NULL
            ) x) AS total_opd,
            (SELECT ROUND(AVG(usia), 1) FROM semua_asn WHERE usia IS NOT NULL) AS avg_usia,
            (SELECT COUNT(*) FROM semua_asn
                WHERE tanggal_bup IS NOT NULL
                  AND tanggal_bup BETWEEN :ref_date AND :ref_date + INTERVAL '3 years'
            ) AS akan_pensiun_3_tahun
    """)

    result = db.execute(query, {"ref_date": REFERENCE_DATE}).mappings().first()

    total_asn = result["total_asn"] or 0
    total_pns = result["total_pns"] or 0
    total_pppk_full = result["total_pppk_full"] or 0
    total_pppk_pw = result["total_pppk_pw"] or 0

    def pct(n):
        return round((n * 100.0 / total_asn), 1) if total_asn else 0

    return {
        "total_asn": total_asn,
        "total_opd": result["total_opd"] or 0,
        "avg_usia": float(result["avg_usia"] or 0),
        "akan_pensiun_3_tahun": result["akan_pensiun_3_tahun"] or 0,
        "pns": {"total": total_pns, "pct": pct(total_pns)},
        "pppk_full": {"total": total_pppk_full, "pct": pct(total_pppk_full)},
        "pppk_pw": {"total": total_pppk_pw, "pct": pct(total_pppk_pw)},
    }


# ============================================================
# 2. STATUS KEPEGAWAIAN
# ============================================================


@router.get("/api/dashboard/status")
def dashboard_status(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                id,
                status_kepegawaian
            FROM pns

            UNION ALL

            SELECT
                id,
                status_kepegawaian
            FROM pppk_full

            UNION ALL

            SELECT
                id,
                status_kepegawaian
            FROM pppk_pw
        ),

        total AS (
            SELECT COUNT(*) AS total
            FROM semua_asn
        )

        SELECT
            status_kepegawaian AS name,
            COUNT(*) AS value,
            ROUND(
                COUNT(*) * 100.0 /
                NULLIF((SELECT total FROM total), 0),
                1
            ) AS pct
        FROM semua_asn
        GROUP BY status_kepegawaian
        ORDER BY value DESC
    """)

    rows = db.execute(query).mappings().all()

    return [
        {
            "name": row["name"],
            "value": row["value"],
            "pct": float(row["pct"] or 0),
        }
        for row in rows
    ]


# ============================================================
# 3. KOMPOSISI GENERASI
# ============================================================


@router.get("/api/dashboard/generasi")
def dashboard_generasi(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT usia_data AS usia, status_kepegawaian
            FROM (
                SELECT
                    umur AS usia_data,
                    status_kepegawaian
                FROM pns

                UNION ALL

                SELECT
                    usia AS usia_data,
                    status_kepegawaian
                FROM pppk_full

                UNION ALL

                SELECT
                    usia AS usia_data,
                    status_kepegawaian
                FROM pppk_pw
            ) x
            WHERE usia_data IS NOT NULL
        ),

        klasifikasi AS (
            SELECT
                status_kepegawaian,
                CASE
                    WHEN usia >= 61 THEN 'BabyBoom'
                    WHEN usia >= 45 THEN 'GenX'
                    WHEN usia >= 29 THEN 'Milenial'
                    ELSE 'GenZ'
                END AS generasi
            FROM semua_asn
        )

        SELECT
            generasi,
            COUNT(*) AS value
        FROM klasifikasi
        GROUP BY generasi
        ORDER BY
            CASE generasi
                WHEN 'BabyBoom' THEN 1
                WHEN 'GenX' THEN 2
                WHEN 'Milenial' THEN 3
                WHEN 'GenZ' THEN 4
            END
    """)

    rows = db.execute(query).mappings().all()

    return [
        {
            "name": row["generasi"],
            "value": row["value"],
        }
        for row in rows
    ]


# ============================================================
# 4. GENERASI BERDASARKAN STATUS
# ============================================================


@router.get("/api/dashboard/generasi-by-status")
def dashboard_generasi_by_status(
    db: Session = Depends(get_db),
):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                status_kepegawaian,
                umur AS usia
            FROM pns

            UNION ALL

            SELECT
                status_kepegawaian,
                usia
            FROM pppk_full

            UNION ALL

            SELECT
                status_kepegawaian,
                usia
            FROM pppk_pw
        ),

        klasifikasi AS (
            SELECT
                status_kepegawaian,

                CASE
                    WHEN usia >= 61 THEN 'BabyBoom'
                    WHEN usia >= 45 THEN 'GenX'
                    WHEN usia >= 29 THEN 'Milenial'
                    ELSE 'GenZ'
                END AS generasi

            FROM semua_asn
            WHERE usia IS NOT NULL
        )

        SELECT
            status_kepegawaian AS status,

            COUNT(*) FILTER (
                WHERE generasi = 'BabyBoom'
            ) AS "BabyBoom",

            COUNT(*) FILTER (
                WHERE generasi = 'GenX'
            ) AS "GenX",

            COUNT(*) FILTER (
                WHERE generasi = 'Milenial'
            ) AS "Milenial",

            COUNT(*) FILTER (
                WHERE generasi = 'GenZ'
            ) AS "GenZ"

        FROM klasifikasi
        GROUP BY status_kepegawaian
        ORDER BY status_kepegawaian
    """)

    rows = db.execute(query).mappings().all()

    return [
        {
            "status": row["status"],
            "BabyBoom": row["BabyBoom"],
            "GenX": row["GenX"],
            "Milenial": row["Milenial"],
            "GenZ": row["GenZ"],
        }
        for row in rows
    ]


# ============================================================
# 5. PROYEKSI PENSIUN
# ============================================================


@router.get("/api/dashboard/pensiun")
def dashboard_pensiun(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                safe_to_date(tmt_bup) AS tanggal_bup
            FROM pns
            WHERE tmt_bup IS NOT NULL

            UNION ALL

            SELECT
                safe_to_date(bup) AS tanggal_bup
            FROM pppk_full
            WHERE bup IS NOT NULL

            UNION ALL

            SELECT
                safe_to_date(tmt_bup) AS tanggal_bup
            FROM pppk_pw
            WHERE tmt_bup IS NOT NULL
        )

        SELECT
            EXTRACT(YEAR FROM tanggal_bup)::int AS year,
            COUNT(*) AS total
        FROM semua_asn
        WHERE tanggal_bup IS NOT NULL
          AND EXTRACT(YEAR FROM tanggal_bup)
              BETWEEN 2026 AND 2031
        GROUP BY EXTRACT(YEAR FROM tanggal_bup)
        ORDER BY year
    """)

    rows = db.execute(query).mappings().all()

    return [
        {
            "year": str(row["year"]),
            "total": row["total"],
        }
        for row in rows
    ]


# ============================================================
# 6. TOP 10 OPD
# ============================================================


@router.get("/api/dashboard/top-opd")
def dashboard_top_opd(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                TRIM(opd) AS opd
            FROM pns
            WHERE opd IS NOT NULL

            UNION ALL

            SELECT
                TRIM(opd) AS opd
            FROM pppk_full
            WHERE opd IS NOT NULL

            UNION ALL

            SELECT
                TRIM(opd) AS opd
            FROM pppk_pw
            WHERE opd IS NOT NULL
        )

        SELECT
            opd,
            COUNT(*) AS total
        FROM semua_asn
        WHERE opd <> ''
        GROUP BY opd
        ORDER BY total DESC
        LIMIT 10
    """)

    rows = db.execute(query).mappings().all()

    return [
        {
            "opd": row["opd"],
            "total": row["total"],
        }
        for row in rows
    ]


# ============================================================
# 7. RISIKO ESELON
# ============================================================


@router.get("/api/dashboard/eselon-risk")
def dashboard_eselon_risk(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                eselon,
                safe_to_date(tmt_bup) AS tanggal_bup
            FROM pns
            WHERE eselon IS NOT NULL
              AND tmt_bup IS NOT NULL
        )

        SELECT
            eselon,
            COUNT(*) AS jumlah
        FROM semua_asn
        WHERE tanggal_bup <= (
            DATE '2026-08-31' + INTERVAL '2 years'
        )
        GROUP BY eselon
        ORDER BY jumlah DESC
    """)

    rows = db.execute(query).mappings().all()

    label_map = {
        "I": "JPT Madya",
        "II": "JPT Pratama",
        "III": "Administrator",
        "IV": "Pengawas",
    }

    return [
        {
            "eselon": f"Eselon {row['eselon']}",
            "jumlah": row["jumlah"],
            "label": label_map.get(
                str(row["eselon"]),
                "Lainnya",
            ),
        }
        for row in rows
    ]


# ============================================================
# 8. DATA OPD + RISIKO
# ============================================================


@router.get("/api/dashboard/opd-risk")
def dashboard_opd_risk(db: Session = Depends(get_db)):

    query = text(r"""
        WITH semua_asn AS (

            SELECT
                TRIM(opd) AS opd,
                umur::numeric AS usia,
                pendidikan
            FROM pns
            WHERE opd IS NOT NULL

            UNION ALL

            SELECT
                TRIM(opd) AS opd,
                usia::numeric AS usia,
                pendidikan
            FROM pppk_full
            WHERE opd IS NOT NULL

            UNION ALL

            SELECT
                TRIM(opd) AS opd,
                usia::numeric AS usia,
                pendidikan
            FROM pppk_pw
            WHERE opd IS NOT NULL
        )

        SELECT
            opd,
            COUNT(*) AS total,
            ROUND(AVG(usia), 1) AS rata_usia,

            ROUND(
                COUNT(*) FILTER (
                    WHERE usia > 50
                ) * 100.0 /
                NULLIF(COUNT(*), 0),
                1
            ) AS pct_tua,

            -- NOTE: asumsi nilai kolom pendidikan diawali 'S1'/'S2'/'S3'.
            -- Sesuaikan pola ini jika format datamu berbeda.
            ROUND(
                COUNT(*) FILTER (
                    WHERE pendidikan ~* '^S[1-3]'
                ) * 100.0 /
                NULLIF(COUNT(*), 0),
                1
            ) AS pct_s1

        FROM semua_asn

        WHERE opd <> ''

        GROUP BY opd

        ORDER BY pct_tua DESC, rata_usia DESC
        LIMIT 56
    """)

    rows = db.execute(query).mappings().all()

    result = []

    for index, row in enumerate(rows):

        total = row["total"]
        rata_usia = float(row["rata_usia"] or 0)
        pct_tua = float(row["pct_tua"] or 0)
        pct_s1 = float(row["pct_s1"] or 0)

        # Skor risiko sederhana berbasis usia.
        # 70% proporsi usia >50 + 30% usia rata-rata.
        skor = (pct_tua * 0.7) + ((rata_usia / 60) * 100 * 0.3)

        skor = min(round(skor, 1), 100)

        if skor >= 60:
            kategori = "Tinggi"
        elif skor >= 40:
            kategori = "Sedang"
        else:
            kategori = "Rendah"

        result.append(
            {
                "id": index + 1,
                "nama": row["opd"],
                "total": total,
                "rataUsia": rata_usia,
                "pctTua": pct_tua,
                "pctS1": pct_s1,
                "skor": skor,
                "kategori": kategori,
                "detail": (
                    f"Rata-rata usia {rata_usia} tahun, "
                    f"dengan {pct_tua}% pegawai berusia di atas 50 tahun."
                ),
            }
        )

    return result


# ============================================================
# 9. DATA PEGAWAI
# ============================================================


@router.get("/api/pegawai")
def get_pegawai(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):

    # Batasi supaya API tidak mengirim puluhan ribu row sekaligus.
    limit = min(max(limit, 1), 1000)
    offset = max(offset, 0)

    query = text(r"""
        SELECT
            id,
            'PNS' AS status_kepegawaian,
            jenis_kelamin,
            umur,
            umur_detail,
            tmt_bup,
            pendidikan,
            klaster,
            pangkat,
            gol,
            jenis_jabatan,
            eselon,
            nama_jabatan,
            opd,
            masa_kerja
        FROM pns

        UNION ALL

        SELECT
            id,
            'PPPK' AS status_kepegawaian,
            jenis_kelamin,
            usia AS umur,
            umur AS umur_detail,
            bup AS tmt_bup,
            pendidikan,
            klaster,
            NULL AS pangkat,
            gol,
            jenis_jabatan,
            NULL AS eselon,
            jabatan AS nama_jabatan,
            opd,
            NULL AS masa_kerja
        FROM pppk_full

        UNION ALL

        SELECT
            id,
            'PPPK PW' AS status_kepegawaian,
            jenis_kelamin,
            usia AS umur,
            umur AS umur_detail,
            tmt_bup,
            pendidikan,
            klaster,
            NULL AS pangkat,
            NULL AS gol,
            jenis_jabatan,
            NULL AS eselon,
            nama_jabatan,
            opd,
            NULL AS masa_kerja
        FROM pppk_pw

        ORDER BY id

        LIMIT :limit
        OFFSET :offset
    """)

    rows = (
        db.execute(
            query,
            {
                "limit": limit,
                "offset": offset,
            },
        )
        .mappings()
        .all()
    )

    return [dict(row) for row in rows]


# ============================================================
# 10. DATA DASHBOARD SEKALIGUS
# ============================================================


@router.get("/api/dashboard")
def dashboard_all(db: Session = Depends(get_db)):

    return {
        "summary": dashboard_summary(db),
        "status": dashboard_status(db),
        "generasi": dashboard_generasi(db),
        "generasi_by_status": dashboard_generasi_by_status(db),
        "pensiun": dashboard_pensiun(db),
        "pensiun_bup": dashboard_pensiun_bup(status=None, db=db),
        "top_opd": dashboard_top_opd(db),
        "eselon_risk": dashboard_eselon_risk(db),
        "opd_risk": dashboard_opd_risk(db),
    }
