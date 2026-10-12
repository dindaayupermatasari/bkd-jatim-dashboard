"""Uji alur pipeline secara offline: LLM dan pencarian dokumen ditiru, statistik memakai SQLite.

    python tests/test_pipeline.py [path/ke/pegawai_normalized.csv]
"""
import json
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

sys.path.append(str(Path(__file__).resolve().parents[1]))
from rag import llm, pipeline, prompts, retriever, stats  # noqa: E402

path = sys.argv[1] if len(sys.argv) > 1 else "data/pegawai_normalized.csv"
df = pd.read_csv(path, low_memory=False)
df["tmt_bup_invalid"] = df["tmt_bup_invalid"].astype(bool)
df["tahun_bup"] = pd.to_datetime(df["tmt_bup"]).where(~df["tmt_bup_invalid"]).dt.year
cols = ["sumber", "status_kepegawaian", "jenis_kelamin", "usia", "tahun_bup", "agama", "pendidikan",
        "klaster", "pangkat", "gol", "jenis_jabatan", "eselon", "nama_jabatan", "opd_induk", "opd_unit", "masa_kerja"]
engine = create_engine("sqlite://")
df[cols].to_sql(stats.VIEW, engine, index=False)
stats._engine = engine
stats.load_catalog(engine, force=True)

ok = True


def check(name, cond, info=""):
    global ok
    ok &= bool(cond)
    print(("OK   " if cond else "GAGAL"), name, "" if cond else info)


# ---- LLM & retriever tiruan ----
state = {"planner_calls": 0, "answer_ctx": None, "search_calls": []}
SCRIPT = {}  # pertanyaan -> daftar balasan perencana (berurutan)


def fake_chat(messages, *, json_mode=False, **kw):
    if json_mode:
        q = messages[-1]["content"]
        # cari pertanyaan asli: pesan user terakhir yang diawali 'Pertanyaan:'
        qs = [m["content"] for m in messages if m["role"] == "user" and m["content"].startswith("Pertanyaan:")]
        replies = SCRIPT[qs[-1]]
        state["planner_calls"] += 1
        return replies.pop(0)
    state["answer_ctx"] = messages[-1]["content"]
    return "JAWABAN-TIRUAN"


def fake_search(query, k=6, filter=None):
    state["search_calls"].append((query, filter))
    if filter:
        return []  # paksa jalur 'ulangi tanpa filter'
    return [{"key": "glosarium:bup", "content": "BUP adalah batas usia pensiun.", "metadata": {}, "similarity": 0.8}]


llm.chat, retriever.search = fake_chat, fake_search

# A. statistik: balasan pertama salah (OPD tidak ada) -> diperbaiki -> angka benar masuk konteks
good = {"queries": [{"metric": "count", "group_by": ["sumber"], "filters": [
    {"column": "opd_induk", "op": "eq", "value": "DINAS PENDIDIKAN"},
    {"column": "klaster", "op": "eq", "value": "JF GURU"},
    {"column": "sumber", "op": "in", "value": ["pppk_full", "pppk_pw"]}]}], "search": None, "search_filter": None}
bad = json.loads(json.dumps(good))
bad["queries"][0]["filters"][0]["value"] = "Dikbud"
SCRIPT["Pertanyaan: Berapa guru PPPK di Dinas Pendidikan?"] = [json.dumps(bad), json.dumps(good)]
r = pipeline.answer("Berapa guru PPPK di Dinas Pendidikan?")
want = df[(df.opd_induk == "DINAS PENDIDIKAN") & (df.klaster == "JF GURU") & df.sumber.isin(["pppk_full", "pppk_pw"])]
for s, n in want.sumber.value_counts().items():
    fmt = f"{n:,}".replace(",", ".")
    check(f"A. angka {s} = {fmt} ada di konteks", f"{s}: {fmt}" in r["context"], r["context"])
check("A. perencana dipanggil 2x (perbaikan)", state["planner_calls"] == 2, state["planner_calls"])
check("A. jawaban dikembalikan", r["answer"] == "JAWABAN-TIRUAN")

# B. dokumen: filter tidak menemukan apa-apa -> diulang tanpa filter
SCRIPT["Pertanyaan: Apa itu BUP?"] = [json.dumps({"queries": [], "search": "pengertian BUP", "search_filter": {"type": "glosarium", "xx": "buang"}})]
state["search_calls"].clear()
r = pipeline.answer("Apa itu BUP?")
check("B. dua kali cari (dengan lalu tanpa filter)", len(state["search_calls"]) == 2, state["search_calls"])
check("B. kunci filter tak dikenal dibuang", state["search_calls"][0][1] == {"type": "glosarium"}, state["search_calls"])
check("B. dokumen masuk konteks", "glosarium:bup" in r["context"])

# C. sapaan: tanpa konteks
SCRIPT["Pertanyaan: halo"] = [json.dumps({"queries": [], "search": None, "search_filter": None})]
r = pipeline.answer("halo")
check("C. konteks kosong", r["context"] == "(tidak ada konteks)", r["context"])

# D. perencana mengembalikan sampah dua kali -> jatuh ke pencarian dokumen dengan pertanyaan asli
SCRIPT["Pertanyaan: pertanyaan aneh"] = ["bukan json", "masih bukan json"]
state["search_calls"].clear()
r = pipeline.answer("pertanyaan aneh")
check("D. fallback pencarian memakai pertanyaan asli", state["search_calls"] and state["search_calls"][0][0] == "pertanyaan aneh", state["search_calls"])

# E. JSON dibungkus pagar kode + riwayat dipakai
SCRIPT["Pertanyaan: kalau yang PNS?"] = ["```json\n" + json.dumps(good) + "\n```"]
r = pipeline.answer("kalau yang PNS?", [{"role": "user", "content": "x" * 900}, {"role": "assistant", "content": "y"}])
check("E. JSON berpagar kode terbaca", "[Perhitungan]" in r["context"], r["context"])

# F. prompt perencana memuat nilai OPD asli dan contoh JSON
sp = prompts.planner_system()
check("F. prompt memuat DINAS PENDIDIKAN dan JF GURU", "DINAS PENDIDIKAN" in sp and "JF GURU" in sp)
print("      panjang prompt perencana:", len(sp), "karakter (±", len(sp) // 4, "token)")

# G. ringkas: format angka
check("G. format angka", pipeline._fmt(17705) == "17.705" and pipeline._fmt(34.5) == "34,50", (pipeline._fmt(17705), pipeline._fmt(34.5)))


# H. konteks memuat baris TOTAL dan tidak membawa dokumen bila perencana tidak meminta pencarian
pens = {"queries": [{"metric": "count", "group_by": ["sumber"], "filters": [{"column": "tahun_bup", "op": "eq", "value": 2027}]}], "search": None, "search_filter": None}
SCRIPT["Pertanyaan: Berapa proyeksi pensiun 2027?"] = [json.dumps(pens)]
state["search_calls"].clear()
r = pipeline.answer("Berapa proyeksi pensiun 2027?")
tot = f"{int((df.tahun_bup == 2027).sum()):,}".replace(",", ".")
check("H. konteks memuat TOTAL", f"TOTAL semua kelompok di atas: {tot}" in r["context"], r["context"])
check("H. label pensiun/BUP di konteks", "yang pensiun (mencapai BUP)" in r["context"], r["context"])
check("H. tanpa pencarian dokumen", not state["search_calls"] and "[Dokumen" not in r["context"])

print("\nSEMUA LULUS" if ok else "\nADA YANG GAGAL")
sys.exit(0 if ok else 1)
