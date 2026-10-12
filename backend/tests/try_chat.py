"""Ngobrol dengan chatbot dari terminal (butuh DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY).

    python tests/try_chat.py                  # mode interaktif, ketik 'keluar' untuk berhenti
    python tests/try_chat.py "berapa PNS di Dinas Kesehatan?"
"""
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from rag.pipeline import answer  # noqa: E402


def ask(q, history):
    r = answer(q, history)
    print("\n[rencana]", json.dumps(r["plan"], ensure_ascii=False))
    print("\n" + r["answer"] + "\n")
    history += [{"role": "user", "content": q}, {"role": "assistant", "content": r["answer"]}]


if __name__ == "__main__":
    hist = []
    if len(sys.argv) > 1:
        ask(" ".join(sys.argv[1:]), hist)
    else:
        while (q := input("kamu> ").strip()) and q.lower() not in {"keluar", "exit"}:
            ask(q, hist)
