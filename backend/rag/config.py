import os

from dotenv import load_dotenv

load_dotenv()

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768  # harus sama dengan vector(768) di sql/002_documents.sql

# Model LLM di Groq. Daftar model Groq berubah cepat; cek dengan `python tests/groq_models.py`
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
