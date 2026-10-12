"""Coba pencarian RAG dari terminal.

    python tests/try_retrieval.py "apa itu BUP"
    python tests/try_retrieval.py "pegawai dinas kesehatan" --filter '{"sumber":"pns"}'
    python tests/try_retrieval.py            # jalankan beberapa pertanyaan contoh
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from rag.retriever import search  # noqa: E402

SAMPLES = [
    "apa itu BUP?",
    "gambaran umum pegawai Dinas Kesehatan",
    "ringkasan jabatan perawat",
    "pegawai PPPK paruh waktu klaster guru",
    "perbedaan golongan PNS dan PPPK",
]


def show(q: str, k: int, flt: dict | None):
    print(f"\n=== {q}" + (f"  (filter {flt})" if flt else ""))
    for r in search(q, k=k, filter=flt):
        first = r["content"].splitlines()[0][:90]
        print(f"  {r['similarity']:.3f}  {r['key'][:60]:60s}  {first}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("query", nargs="?")
    ap.add_argument("-k", type=int, default=5)
    ap.add_argument("--filter", type=json.loads, default=None)
    a = ap.parse_args()
    for q in ([a.query] if a.query else SAMPLES):
        show(q, a.k, a.filter)
