"""Embedding teks dengan Gemini API. Dipakai ingestion (dokumen) dan chatbot (query)."""
import math
import os
import time

from google import genai
from google.genai import errors, types

from .config import EMBED_DIM, EMBED_MODEL

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY belum diisi di backend/.env")
        _client = genai.Client(api_key=key)
    return _client


def _normalize(v: list[float]) -> list[float]:
    # Vektor hasil pemotongan dimensi tidak otomatis berpanjang 1
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


def _embed(texts: list[str], task_type: str, retries: int = 5) -> list[list[float]]:
    client = _get_client()
    for attempt in range(retries):
        try:
            res = client.models.embed_content(
                model=EMBED_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task_type, output_dimensionality=EMBED_DIM),
            )
            vecs = [_normalize(list(e.values)) for e in res.embeddings]
            if len(vecs) != len(texts) or any(len(v) != EMBED_DIM for v in vecs):
                raise ValueError("jumlah/dimensi embedding tidak sesuai")
            return vecs
        except errors.APIError as e:
            # Coba lagi hanya untuk batas kuota (429) dan gangguan server (5xx)
            if e.code not in (429, 500, 503) or attempt == retries - 1:
                raise
            wait = 5 * 2 ** attempt
            print(f"  API {e.code}, coba lagi dalam {wait} detik...")
            time.sleep(wait)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed(texts, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    return _embed([text], "RETRIEVAL_QUERY")[0]
