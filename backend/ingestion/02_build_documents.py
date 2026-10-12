"""
Bangun dokumen ringkasan (bahan RAG) dari data/pegawai_normalized.csv.

Bukan chunking per token: data berupa tabel, jadi tiap dokumen = satu ringkasan
statistik untuk satu entitas (OPD, jabatan, klaster, keseluruhan) + glosarium.
Output: data/documents.jsonl  (satu dokumen per baris: key, content, metadata)

    python ingestion/02_build_documents.py
"""
import argparse
import json
from pathlib import Path

import pandas as pd

PERIODE = "Agustus 2026"
BUP_YEARS = range(2026, 2031)
LABEL = {"pns": "PNS", "pppk_full": "PPPK (full time)", "pppk_pw": "PPPK Paruh Waktu"}


# ---------- helper format ----------
def n(x) -> str:
    return f"{int(x):,}".replace(",", ".")


def pct(a, b) -> str:
    return f"{a / b * 100:.1f}".replace(".", ",") + "%"


def dist(s: pd.Series, top: int | None = None) -> str:
    vc = s.dropna().value_counts()
    total = vc.sum()
    if total == 0:
        return "tidak ada data"
    if top:
        vc = vc.head(top)
    return ", ".join(f"{k} {n(v)} ({pct(v, total)})" for k, v in vc.items())


def sex_text(g: pd.DataFrame) -> str:
    c = g["jenis_kelamin"].value_counts()
    return f"laki-laki {n(c.get('L', 0))}, perempuan {n(c.get('P', 0))}"


def usia_text(g: pd.DataFrame) -> str:
    u = g["usia"].dropna()
    if u.empty:
        return "usia tidak tersedia"
    return (f"rata-rata usia {f'{u.mean():.1f}'.replace('.', ',')} tahun "
            f"(median {int(u.median())}, termuda {int(u.min())}, tertua {int(u.max())})")


def bup_text(g: pd.DataFrame) -> str:
    tgl = pd.to_datetime(g["tmt_bup"].where(~g["tmt_bup_invalid"]), errors="coerce")
    c = tgl.dt.year.value_counts()
    parts = ", ".join(f"{y}: {n(c.get(y, 0))}" for y in BUP_YEARS)
    return f"Jumlah pegawai yang mencapai batas usia pensiun (BUP) per tahun, {parts}."


def status_split(g: pd.DataFrame) -> str:
    c = g["sumber"].value_counts()
    return ", ".join(f"{LABEL[s]} {n(c[s])}" for s in LABEL if s in c)


def rec(key: str, content: str, **meta) -> dict:
    return {"key": key, "content": content.strip(), "metadata": meta}


# ---------- pembangun dokumen ----------
def docs_opd_per_status(df):
    for (sumber, opd), g in df.groupby(["sumber", "opd_induk"]):
        lines = [
            f"Ringkasan {LABEL[sumber]} di {opd} (data {PERIODE}).",
            f"Total {n(len(g))} pegawai: {sex_text(g)}. {usia_text(g).capitalize()}.",
            f"Pendidikan: {dist(g['pendidikan'])}.",
            f"Agama: {dist(g['agama'])}.",
            f"Klaster jabatan: {dist(g['klaster'])}.",
            f"Golongan: {dist(g['gol'])}." if g["gol"].notna().any() else "",
            f"Pangkat terbanyak: {dist(g['pangkat'], 5)}." if g["pangkat"].notna().any() else "",
            f"Pegawai berjabatan eselon: {n(g['eselon'].notna().sum())}." if sumber == "pns" else "",
            f"Jabatan terbanyak: {dist(g['nama_jabatan'], 8)}.",
            bup_text(g),
        ]
        yield rec(f"ringkasan_opd:{sumber}:{opd}", "\n".join(x for x in lines if x),
                  type="ringkasan_opd", sumber=sumber, opd_induk=opd)


def docs_opd_gabungan(df):
    for opd, g in df.groupby("opd_induk"):
        lines = [
            f"Gambaran umum kepegawaian {opd} (data {PERIODE}).",
            f"Total {n(len(g))} pegawai: {status_split(g)}.",
            f"Komposisi: {sex_text(g)}. {usia_text(g).capitalize()}.",
            f"Pendidikan: {dist(g['pendidikan'], 6)}.",
            f"Jabatan terbanyak: {dist(g['nama_jabatan'], 8)}.",
            bup_text(g),
        ]
        yield rec(f"ringkasan_opd:semua:{opd}", "\n".join(lines),
                  type="ringkasan_opd", sumber="semua", opd_induk=opd)


def docs_jabatan(df):
    for jab, g in df.groupby("nama_jabatan"):
        lines = [
            f"Jabatan {jab} (data {PERIODE}).",
            f"Total {n(len(g))} pegawai: {status_split(g)}.",
            f"{sex_text(g).capitalize()}. {usia_text(g).capitalize()}.",
            f"Pendidikan: {dist(g['pendidikan'], 5)}.",
            f"Klaster: {dist(g['klaster'])}.",
            f"OPD dengan pegawai terbanyak pada jabatan ini: {dist(g['opd_induk'], 5)}.",
            bup_text(g),
        ]
        yield rec(f"ringkasan_jabatan:{jab}", "\n".join(lines),
                  type="ringkasan_jabatan", nama_jabatan=jab)


def docs_klaster(df):
    for (sumber, kl), g in df.groupby(["sumber", "klaster"]):
        lines = [
            f"Ringkasan klaster {kl} pada {LABEL[sumber]} (data {PERIODE}).",
            f"Total {n(len(g))} pegawai: {sex_text(g)}. {usia_text(g).capitalize()}.",
            f"Pendidikan: {dist(g['pendidikan'], 6)}.",
            f"OPD dengan pegawai terbanyak: {dist(g['opd_induk'], 6)}.",
            f"Jabatan terbanyak: {dist(g['nama_jabatan'], 6)}.",
            bup_text(g),
        ]
        yield rec(f"ringkasan_klaster:{sumber}:{kl}", "\n".join(lines),
                  type="ringkasan_klaster", sumber=sumber, klaster=kl)


def docs_keseluruhan(df):
    groups = [("semua", "seluruh pegawai (PNS, PPPK, dan PPPK Paruh Waktu)", df)]
    groups += [(s, LABEL[s], df[df["sumber"] == s]) for s in LABEL]
    for sumber, nama, g in groups:
        lines = [
            f"Ringkasan keseluruhan {nama} Pemerintah Provinsi Jawa Timur (data {PERIODE}).",
            f"Total {n(len(g))} pegawai" + (f": {status_split(g)}." if sumber == "semua" else "."),
            f"Komposisi: {sex_text(g)}. {usia_text(g).capitalize()}.",
            f"Pendidikan: {dist(g['pendidikan'])}.",
            f"Agama: {dist(g['agama'])}.",
            f"Klaster: {dist(g['klaster'])}.",
            f"Jumlah OPD induk: {g['opd_induk'].nunique()}. OPD dengan pegawai terbanyak: {dist(g['opd_induk'], 10)}.",
            bup_text(g),
        ]
        yield rec(f"ringkasan_umum:{sumber}", "\n".join(lines),
                  type="ringkasan_umum", sumber=sumber)


def docs_glosarium(df):
    klaster = "; ".join(
        f"{LABEL[s]}: {', '.join(sorted(df[df['sumber'] == s]['klaster'].dropna().unique()))}"
        for s in LABEL)
    items = {
        "cakupan_data": (
            f"Data ini merupakan data kepegawaian Pemprov Jawa Timur posisi {PERIODE}, terdiri dari tiga kelompok: "
            "PNS, PPPK (full time), dan PPPK Paruh Waktu. Data bersifat anonim (tanpa nama dan NIP), sehingga "
            "chatbot hanya dapat menjawab pertanyaan statistik dan gambaran umum, bukan mencari pegawai tertentu."),
        "bup": (
            "BUP adalah batas usia pensiun. Kolom tmt_bup berisi tanggal mulai terhitung pensiun hasil perhitungan. "
            "Pada sebagian baris tanggal BUP tidak dapat dihitung atau janggal; baris tersebut tetap dihitung sebagai "
            "pegawai tetapi tidak dimasukkan ke statistik pensiun, sehingga jumlah pensiun bisa sedikit lebih rendah dari kenyataan."),
        "tmt_cp": (
            "tmt_cp adalah kode periode terhitung mulai tanggal calon pegawai. Pada PNS berformat tahun-bulan "
            "(contoh 202504 berarti April 2025). Pada PPPK berformat tahun diikuti kode dua digit (contoh 202421)."),
        "golongan": (
            "Golongan PNS memakai skala I sampai IV dengan pangkat seperti II/c atau III/a. Golongan PPPK memakai "
            "angka romawi dengan skala berbeda (di data: I, V, VII, IX, X, XI), sehingga golongan PNS dan PPPK "
            "tidak dapat dibandingkan langsung. PPPK Paruh Waktu tidak memiliki data golongan."),
        "eselon_masa_kerja": (
            "Kolom pangkat, eselon, dan masa kerja hanya tersedia untuk PNS. Pegawai tanpa eselon adalah pegawai non-struktural."),
        "klaster": f"Klaster jabatan yang ada di data: {klaster}.",
        "opd": (
            "OPD induk adalah perangkat daerah utama (dinas, badan, RSUD, sekretariat, dan sebagainya). Pada data PPPK, "
            "unit kerja yang lebih rinci (bidang, UPT, cabang dinas, sekolah) tercatat sebagai opd_unit."),
    }
    for k, v in items.items():
        yield rec(f"glosarium:{k}", v, type="glosarium", topik=k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="data/pegawai_normalized.csv")
    ap.add_argument("--out", default="data/documents.jsonl")
    args = ap.parse_args()

    df = pd.read_csv(args.inp, low_memory=False)
    df["tmt_bup_invalid"] = df["tmt_bup_invalid"].astype(bool)

    docs = []
    for fn in (docs_keseluruhan, docs_opd_gabungan, docs_opd_per_status,
               docs_klaster, docs_jabatan, docs_glosarium):
        docs.extend(fn(df))

    keys = [d["key"] for d in docs]
    assert len(keys) == len(set(keys)), "key dokumen duplikat"

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")

    s = pd.Series([d["metadata"]["type"] for d in docs]).value_counts()
    lens = pd.Series([len(d["content"]) for d in docs])
    print(f"{len(docs)} dokumen ditulis ke {args.out}")
    print(s.to_string())
    print(f"panjang karakter: min {lens.min()}, median {int(lens.median())}, max {lens.max()}")


if __name__ == "__main__":
    main()
