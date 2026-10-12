"""Tampilkan model yang tersedia di akun Groq-mu (untuk memastikan GROQ_MODEL valid)."""
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from rag import config  # noqa: E402,F401  (memuat .env)
from groq import Groq  # noqa: E402

for m in sorted(Groq(api_key=os.environ["GROQ_API_KEY"]).models.list().data, key=lambda m: m.id):
    print(m.id)
print("\nGROQ_MODEL saat ini:", config.GROQ_MODEL)
