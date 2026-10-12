"""Pencarian dokumen terdekat di pgvector (fungsi SQL match_documents)."""
import json
import os

from sqlalchemy import create_engine, text

from .embedder import embed_query

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
    return _engine


def _vec(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


def search(query: str, k: int = 6, filter: dict | None = None) -> list[dict]:
    """Kembalikan k dokumen paling mirip. `filter` mencocokkan metadata, mis. {"sumber": "pns"}."""
    emb = embed_query(query)
    sql = text("select key, content, metadata, similarity "
               "from match_documents(cast(:q as vector), :k, cast(:f as jsonb))")
    with _get_engine().connect() as con:
        rows = con.execute(sql, {"q": _vec(emb), "k": k,
                                 "f": json.dumps(filter or {})}).mappings().all()
    return [dict(r) for r in rows]
