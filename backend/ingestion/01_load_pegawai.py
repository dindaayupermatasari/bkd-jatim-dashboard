"""
Normalisasi tiga sumber (pns, pppk_full, pppk_pw) menjadi satu tabel `pegawai`.

Default: dry-run (hanya validasi + tulis data/pegawai_normalized.csv).
Tambah --load untuk mengisi tabel di Supabase (butuh DATABASE_URL di .env).

    python ingestion/01_load_pegawai.py --csv-dir data/csv
    python ingestion/01_load_pegawai.py --csv-dir data/csv --load
"""

import argparse
import os
import re
from collections import Counter
from pathlib import Path

import pandas as pd

CUTOFF_BUP = "2026-01-01"

FINAL_COLS = [
    "sumber",
    "src_id",
    "status_kepegawaian",
    "tmt_cp",
    "jenis_kelamin",
    "usia",
    "usia_detail",
    "tmt_bup",
    "tmt_bup_invalid",
    "agama",
    "pendidikan",
    "klaster",
    "pangkat",
    "gol",
    "jenis_jabatan",
    "eselon",
    "nama_jabatan",
    "opd",
    "opd_induk",
    "opd_unit",
    "masa_kerja",
]

# Typo yang ditemukan di data sumber ('l' kecil menggantikan 'I')
TYPO_FIXES = [(re.compile(r"\blnformasi\b", re.I), "Informasi")]


def clean_text(s: pd.Series) -> pd.Series:
    s = s.astype("string").str.replace(r"\s+", " ", regex=True).str.strip()
    return s.replace({"": pd.NA, "null": pd.NA, "NULL": pd.NA})


def fix_typos(s: pd.Series) -> pd.Series:
    for pat, repl in TYPO_FIXES:
        s = s.str.replace(pat, repl, regex=True)
    return s


def split_opd(opd: pd.Series):
    parts = opd.str.split(" - ", n=1, expand=True)
    induk = parts[0].str.strip()
    unit = (
        parts[1].str.strip()
        if 1 in parts.columns
        else pd.Series(pd.NA, index=opd.index)
    )
    return induk, unit


def load_pns(path: Path) -> pd.DataFrame:
    d = pd.read_csv(path, dtype={"tmt_cp": "string"})
    out = pd.DataFrame(
        {
            "sumber": "pns",
            "src_id": d["id"],
            "status_kepegawaian": d["status_kepegawaian"],
            "tmt_cp": d["tmt_cp"],
            "jenis_kelamin": d["jenis_kelamin"],
            "usia": d["umur"],  # di PNS, 'umur' = angka
            "usia_detail": d["umur_detail"],
            "tmt_bup": d["tmt_bup"],
            "tmt_bup_invalid": d["tmt_bup_invalid"],
            "agama": d["agama"],
            "pendidikan": d["pendidikan"],
            "klaster": d["klaster"],
            "pangkat": d["pangkat"],
            "gol": d["gol"],
            "jenis_jabatan": d["jenis_jabatan"],
            "eselon": d["eselon"],
            "nama_jabatan": d["nama_jabatan"],
            "opd": d["opd"],
            "masa_kerja": d["masa_kerja"],
        }
    )
    return out


def load_pppk_full(path: Path) -> pd.DataFrame:
    d = pd.read_csv(path, dtype={"tmt_cp": "string"})
    return pd.DataFrame(
        {
            "sumber": "pppk_full",
            "src_id": d["id"],
            "status_kepegawaian": d["status_kepegawaian"],
            "tmt_cp": d["tmt_cp"],
            "jenis_kelamin": d["jenis_kelamin"],
            "usia": d["usia"],  # di PPPK, 'usia' = angka
            "usia_detail": d["umur"],  # dan 'umur' = teks
            "tmt_bup": d["bup"],
            "tmt_bup_invalid": d["bup_invalid"],
            "agama": d["agama"],
            "pendidikan": d["pendidikan"],
            "klaster": d["klaster"],
            "gol": d["gol"],
            "jenis_jabatan": d["jenis_jabatan"],
            "nama_jabatan": d["jabatan"],
            "opd": d["opd"],
        }
    )


def load_pppk_pw(path: Path) -> pd.DataFrame:
    d = pd.read_csv(path, dtype={"tmt_cp": "string"})
    return pd.DataFrame(
        {
            "sumber": "pppk_pw",
            "src_id": d["id"],
            "status_kepegawaian": d["status_kepegawaian"],
            "tmt_cp": d["tmt_cp"],
            "jenis_kelamin": d["jenis_kelamin"],
            "usia": d["usia"],
            "usia_detail": d["umur"],
            "tmt_bup": d["tmt_bup"],
            "tmt_bup_invalid": d["tmt_bup_invalid"],
            "agama": d["agama"],
            "pendidikan": d["pendidikan"],
            "klaster": d["klaster"],
            "jenis_jabatan": d["jenis_jabatan"],
            "nama_jabatan": d["nama_jabatan"],
            "opd": d["opd"],
        }
    )


def canonical_jabatan(df: pd.DataFrame) -> pd.Series:
    """PPPK PW semua huruf kapital, tabel lain Title Case.
    Samakan ke bentuk campuran yang paling sering muncul di data."""
    names = df["nama_jabatan"]
    mixed = names[names.notna() & (names != names.str.upper())]
    best = {}
    for key, grp in mixed.groupby(mixed.str.casefold()):
        best[key] = Counter(grp).most_common(1)[0][0]
    mapped = names.str.casefold().map(best)
    # fallback: jabatan yang hanya ada dalam huruf kapital -> Title Case
    fallback = names.where(names != names.str.upper(), names.str.title())
    return mapped.fillna(fallback)


def build(csv_dir: Path) -> pd.DataFrame:
    df = pd.concat(
        [
            load_pns(csv_dir / "pns_rows.csv"),
            load_pppk_full(csv_dir / "pppk_full_rows.csv"),
            load_pppk_pw(csv_dir / "pppk_pw_rows.csv"),
        ],
        ignore_index=True,
    )

    text_cols = [
        "status_kepegawaian",
        "jenis_kelamin",
        "usia_detail",
        "agama",
        "pendidikan",
        "klaster",
        "pangkat",
        "gol",
        "jenis_jabatan",
        "eselon",
        "nama_jabatan",
        "opd",
    ]
    for c in text_cols:
        df[c] = clean_text(df[c])

    df["nama_jabatan"] = fix_typos(df["nama_jabatan"])
    df["nama_jabatan"] = canonical_jabatan(df)

    df["opd_induk"], df["opd_unit"] = split_opd(df["opd"])
    # Satu baris sumber menulis 'Dinas Pendidikan' (huruf kecil); samakan ke huruf kapital
    df["opd_induk"] = df["opd_induk"].str.upper()
    bup = pd.to_datetime(df["tmt_bup"], errors="coerce")
    df["tmt_bup_invalid"] = df["tmt_bup_invalid"].fillna(False).astype(bool)
    # BUP sebelum tahun data (2026) = hampir pasti salah input tanggal lahir. Tanggal Jan-Jul 2026 tetap sah (dihitung dashboard)
    janggal = (bup < pd.Timestamp(CUTOFF_BUP)) & ~df["tmt_bup_invalid"]
    df.loc[janggal, "tmt_bup_invalid"] = True
    print(f"Menandai {int(janggal.sum())} baris dengan BUP janggal sebagai invalid")
    df["tmt_bup"] = bup.dt.date
    for c in ["usia", "masa_kerja", "src_id"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

    return df[FINAL_COLS]


def report(df: pd.DataFrame, csv_dir: Path) -> None:
    expected = {
        "pns": "pns_rows.csv",
        "pppk_full": "pppk_full_rows.csv",
        "pppk_pw": "pppk_pw_rows.csv",
    }
    print("== Jumlah baris per sumber (hasil vs file asli)")
    for s, f in expected.items():
        n_src = sum(1 for _ in open(csv_dir / f, encoding="utf-8")) - 1
        n_out = int((df["sumber"] == s).sum())
        print(
            f"  {s:10s} {n_out:6d} / {n_src:6d}  {'OK' if n_out == n_src else 'BEDA'}"
        )
    print("\n== OPD induk unik per sumber")
    print(df.groupby("sumber")["opd_induk"].nunique().to_string())
    print("\n== Kolom null (jumlah)")
    nulls = df.isna().sum()
    print(nulls[nulls > 0].to_string())
    print(f"\n== nama_jabatan unik setelah normalisasi: {df['nama_jabatan'].nunique()}")


def load_to_db(df: pd.DataFrame) -> None:
    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text

    load_dotenv()
    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.begin() as con:
        con.execute(text("truncate table pegawai restart identity"))
        df.to_sql(
            "pegawai",
            con,
            if_exists="append",
            index=False,
            method="multi",
            chunksize=2000,
        )
    print(f"Terisi {len(df)} baris ke tabel pegawai.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", default="data/csv")
    ap.add_argument("--out", default="data/pegawai_normalized.csv")
    ap.add_argument("--load", action="store_true", help="isi tabel pegawai di Supabase")
    args = ap.parse_args()

    csv_dir = Path(args.csv_dir)
    df = build(csv_dir)
    report(df, csv_dir)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"\nDitulis: {args.out}")

    if args.load:
        load_to_db(df)
