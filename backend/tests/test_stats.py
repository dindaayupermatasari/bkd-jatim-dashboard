"""Uji jalur statistik terhadap data lokal (SQLite) dan bandingkan dengan pandas.

    python tests/test_stats.py                         # memakai data/pegawai_normalized.csv
    python tests/test_stats.py path/ke/pegawai_normalized.csv
"""
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

sys.path.append(str(Path(__file__).resolve().parents[1]))
from rag import stats  # noqa: E402

path = sys.argv[1] if len(sys.argv) > 1 else "data/pegawai_normalized.csv"
df = pd.read_csv(path, low_memory=False)
df["tmt_bup_invalid"] = df["tmt_bup_invalid"].astype(bool)
tgl = pd.to_datetime(df["tmt_bup"]).where(~df["tmt_bup_invalid"])
df["tahun_bup"] = tgl.dt.year
view = df[["sumber", "status_kepegawaian", "jenis_kelamin", "usia", "tahun_bup", "agama",
           "pendidikan", "klaster", "pangkat", "gol", "jenis_jabatan", "eselon",
           "nama_jabatan", "opd_induk", "opd_unit", "masa_kerja"]]

engine = create_engine("sqlite://")
view.to_sql(stats.VIEW, engine, index=False)
stats.load_catalog(engine, force=True)

ok = True


def check(name, got, want):
    global ok
    good = got == want
    ok &= good
    print(("OK   " if good else "GAGAL"), name, "" if good else f"\n   got={got}\n  want={want}")


def one(spec):
    return stats.run_query(spec, engine)


# 1. hitung total per sumber
r = one({"group_by": ["sumber"]})
check("total per sumber", {x["sumber"]: x["nilai"] for x in r["rows"]}, df["sumber"].value_counts().to_dict())

# 2. filter OPD (huruf kecil, harus dikoreksi ke nilai asli) + sumber
r = one({"filters": [{"column": "opd_induk", "value": "dinas pendidikan"},
                     {"column": "sumber", "value": "pppk_full"}], "group_by": ["klaster"]})
w = df[(df.opd_induk == "DINAS PENDIDIKAN") & (df.sumber == "pppk_full")]["klaster"].value_counts().to_dict()
check("klaster PPPK full di Dinas Pendidikan", {x["klaster"]: x["nilai"] for x in r["rows"]}, w)

# 3. pensiun per tahun (BUP invalid tidak ikut)
r = one({"filters": [{"column": "tahun_bup", "op": "between", "value": [2026, 2028]}], "group_by": ["tahun_bup"]})
w = df[df.tahun_bup.between(2026, 2028)]["tahun_bup"].astype(int).value_counts().sort_index().to_dict()
check("pensiun 2026-2028", {x["tahun_bup"]: x["nilai"] for x in r["rows"]}, w)

# 4. rata-rata usia PNS per pendidikan (nilai "S1" harus jadi "S-1")
r = one({"metric": "avg", "metric_column": "usia", "group_by": ["pendidikan"],
         "filters": [{"column": "sumber", "value": "pns"}, {"column": "pendidikan", "op": "in", "value": ["S1", "S2"]}]})
w = df[(df.sumber == "pns") & df.pendidikan.isin(["S-1", "S-2"])].groupby("pendidikan")["usia"].mean().round(2).to_dict()
check("rata-rata usia PNS S-1/S-2", {x["pendidikan"]: x["nilai"] for x in r["rows"]}, w)

# 5. pencarian jabatan dengan 'contains'
r = one({"filters": [{"column": "nama_jabatan", "op": "contains", "value": "perawat"}]})
check("jabatan mengandung perawat", r["rows"][0]["nilai"],
      int(df.nama_jabatan.str.lower().str.contains("perawat", na=False).sum()))

# 6. tanpa group_by -> satu baris total
r = one({})
check("total keseluruhan", r["rows"][0]["nilai"], len(df))

# 7. input salah harus ditolak dengan pesan yang jelas
for bad, label in [({"filters": [{"column": "nip", "value": "1"}]}, "kolom tak dikenal"),
                   ({"group_by": ["opd"]}, "group_by tak diizinkan"),
                   ({"filters": [{"column": "opd_induk", "value": "Pendidikan Tinggi"}]}, "nilai tak ada"),
                   ({"filters": [{"column": "usia", "op": "gte", "value": "abc"}]}, "angka salah"),
                   ({"metric": "sum"}, "metric salah"),
                   ({"filters": [{"column": "sumber; drop table pegawai", "value": "x"}]}, "injeksi lewat nama kolom")]:
    try:
        one(bad)
        check(f"tolak: {label}", "diterima", "ditolak")
    except stats.StatsError as e:
        check(f"tolak: {label}", True, True)
        print("      pesan:", e)


# 8. proyeksi pensiun: label eksplisit + total dihitung backend
r = one({"group_by": ["sumber"], "filters": [{"column": "tahun_bup", "op": "eq", "value": 2027}]})
check("pensiun 2027: deskripsi menyebut pensiun dan BUP",
      "pensiun" in r["description"] and "BUP" in r["description"], True)
check("pensiun 2027: total = jumlah baris", r["total"], int((df.tahun_bup == 2027).sum()))
r = one({"group_by": ["klaster"], "limit": 2})
check("total tidak diberikan bila hasil terpotong", (r["truncated"], r["total"]), (True, None))
r = one({"metric": "avg", "metric_column": "usia", "group_by": ["sumber"]})
check("total tidak diberikan untuk metrik non-count", r["total"], None)

print("\nSEMUA LULUS" if ok else "\nADA YANG GAGAL")
sys.exit(0 if ok else 1)
