"""
Embed data/documents.jsonl dengan Gemini dan simpan ke tabel `documents` (pgvector).

Aman dijalankan ulang: dokumen yang isinya tidak berubah dilewati, dan tiap batch
langsung disimpan sehingga bisa dilanjutkan kalau terputus (mis. kena batas kuota).

    python ingestion/03_embed_documents.py --dry-run   # cek file saja, tanpa API/DB
    python ingestion/03_embed_documents.py             # embed + simpan
    python ingestion/03_embed_documents.py --prune     # hapus juga dokumen yang sudah tidak ada di file
"""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))  # agar `import rag` jalan

from rag.config import EMBED_DIM  # noqa: E402  (juga memuat .env)

UPSERT = """
insert into documents (key, content, content_hash, metadata, embedding)
values (:key, :content, :hash, cast(:metadata as jsonb), cast(:embedding as vector))
on conflict (key) do update set
  content = excluded.content,
  content_hash = excluded.content_hash,
  metadata = excluded.metadata,
  embedding = excluded.embedding
"""


def sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


def load_docs(path: Path) -> list[dict]:
    docs = [json.loads(line) for line in open(path, encoding="utf-8") if line.strip()]
    keys = [d["key"] for d in docs]
    assert len(keys) == len(set(keys)), "key dokumen duplikat"
    return docs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", default="data/documents.jsonl")
    ap.add_argument("--batch-size", type=int, default=20)
    ap.add_argument("--pause", type=float, default=2.0, help="jeda antar batch (detik)")
    ap.add_argument("--prune", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    docs = load_docs(Path(args.docs))
    chars = sum(len(d["content"]) for d in docs)
    print(f"{len(docs)} dokumen, ±{chars // 4:,} token (perkiraan)")
    if args.dry_run:
        return

    from sqlalchemy import create_engine, text
    from rag.embedder import embed_documents

    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as con:
        existing = dict(con.execute(text("select key, content_hash from documents")).all())

    todo = [d for d in docs if existing.get(d["key"]) != sha(d["content"])]
    print(f"{len(todo)} dokumen perlu di-embed, {len(docs) - len(todo)} dilewati (tidak berubah)")

    bs = args.batch_size
    for i in range(0, len(todo), bs):
        batch = todo[i:i + bs]
        vecs = embed_documents([d["content"] for d in batch])
        rows = [{
            "key": d["key"], "content": d["content"], "hash": sha(d["content"]),
            "metadata": json.dumps(d["metadata"], ensure_ascii=False),
            "embedding": vec_literal(v),
        } for d, v in zip(batch, vecs)]
        with engine.begin() as con:
            con.execute(text(UPSERT), rows)
        print(f"  {min(i + bs, len(todo))}/{len(todo)} tersimpan")
        if i + bs < len(todo):
            time.sleep(args.pause)

    if args.prune:
        with engine.begin() as con:
            res = con.execute(text("delete from documents where not (key = any(:keys))"),
                              {"keys": [d["key"] for d in docs]})
        print(f"{res.rowcount} dokumen usang dihapus")

    with engine.connect() as con:
        total = con.execute(text("select count(*) from documents")).scalar()
    print(f"Selesai. Total di tabel documents: {total} (dimensi {EMBED_DIM})")


if __name__ == "__main__":
    main()
