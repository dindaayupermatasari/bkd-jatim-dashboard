"""Orkestrasi chatbot: perencanaan -> (statistik SQL terstruktur) + (pencarian dokumen) -> jawaban."""
import json
import logging
import os
import re
from contextvars import ContextVar

from . import llm, prompts, retriever, stats

log = logging.getLogger(__name__)

# Sumber data disembunyikan secara default. Set SHOW_SOURCES=1 untuk menampilkannya lagi.
SHOW_SOURCES = os.getenv("SHOW_SOURCES", "0") == "1"

# ID sesi anonim dari header X-Session-Id (diisi middleware di app/main.py), hanya untuk log.
session_id_var: ContextVar[str] = ContextVar("session_id", default="-")

MAX_QUERIES = 3
HISTORY_TURNS = 6
HISTORY_CHARS = {"user": 500, "assistant": 1500}  # jawaban asisten sering berisi daftar, jangan dipotong terlalu pendek
ALLOWED_FILTER_KEYS = {"sumber", "type"}
VALUE_COLS = {"nilai", "jumlah", "total"}  # kolom hasil (bukan kolom pengelompokan)


# ---------- util ----------
def _fmt(v) -> str:
    if isinstance(v, int):
        return f"{v:,}".replace(",", ".")
    if isinstance(v, float):
        return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return str(v)


def _trim_history(history: list[dict] | None) -> list[dict]:
    out = []
    for m in (history or [])[-HISTORY_TURNS:]:
        role = m.get("role")
        if role in HISTORY_CHARS and m.get("content"):
            out.append({"role": role, "content": str(m["content"])[:HISTORY_CHARS[role]]})
    return out


def _parse_json(s: str) -> dict:
    s = re.sub(r"^```(?:json)?|```$", "", s.strip(), flags=re.M).strip()
    a, b = s.find("{"), s.rfind("}")
    if a == -1 or b == -1:
        raise ValueError("tidak ada objek JSON")
    obj = json.loads(s[a:b + 1])
    if not isinstance(obj, dict):
        raise ValueError("JSON bukan objek")
    return obj


def _normalize_plan(obj: dict) -> dict:
    queries = obj.get("queries") or []
    queries = [q for q in queries if isinstance(q, dict)][:MAX_QUERIES]
    search = obj.get("search")
    search = search.strip() if isinstance(search, str) and search.strip() else None
    flt = obj.get("search_filter")
    flt = ({k: v for k, v in flt.items() if k in ALLOWED_FILTER_KEYS and isinstance(v, str)}
           if isinstance(flt, dict) else None) or None
    return {"queries": queries, "search": search, "search_filter": flt}


# ---------- perencanaan ----------
def _ask_planner(messages: list[dict]) -> tuple[dict | None, str]:
    raw = llm.chat(messages, json_mode=True, max_tokens=1200, temperature=0)
    try:
        return _parse_json(raw), raw
    except (ValueError, json.JSONDecodeError):
        return None, raw


def plan(question: str, history: list[dict]) -> tuple[dict, list[dict]]:
    """Kembalikan (rencana, pesan perencana) agar bisa dipakai untuk perbaikan."""
    messages = ([{"role": "system", "content": prompts.planner_system()}]
                + history + [{"role": "user", "content": f"Pertanyaan: {question}"}])
    obj, raw = _ask_planner(messages)
    if obj is None:  # coba sekali lagi, lalu menyerah ke pencarian dokumen biasa
        messages += [{"role": "assistant", "content": raw},
                     {"role": "user", "content": "Balasanmu bukan JSON yang valid. Kirim ulang HANYA objek JSON."}]
        obj, raw = _ask_planner(messages)
    if obj is None:
        return {"queries": [], "search": question, "search_filter": None}, messages
    messages.append({"role": "assistant", "content": raw})
    return _normalize_plan(obj), messages


def run_stats(queries: list[dict]) -> tuple[list[dict], list[str], int]:
    """Kembalikan (hasil, pesan error yang bisa diperbaiki planner, jumlah kegagalan teknis)."""
    results, errors, failures = [], [], 0
    for spec in queries:
        try:
            results.append(stats.run_query(spec))
        except (stats.StatsError, ValueError, TypeError) as e:
            errors.append(str(e))
        except Exception:  # gangguan database dsb.: jangan jatuhkan seluruh jawaban
            log.exception("perhitungan gagal")
            failures += 1
    return results, errors, failures


def _unordered_truncated(r: dict) -> bool:
    """Hasil terpotong dan diurutkan menurut nama kelompok, sehingga tidak bisa dipakai untuk peringkat."""
    if not r["truncated"] or r.get("order") != "group_asc":
        return False
    return any(c not in VALUE_COLS and c not in stats.NUMERIC for c in r["columns"])


def _issues(results: list[dict], errors: list[str]) -> list[str]:
    issues = list(errors)
    for r in results:
        if _unordered_truncated(r):
            issues.append(
                f"Hasil terpotong dan hanya diurutkan menurut nama kelompok: {r['description']}. "
                "Untuk peringkat pakai order metric_desc dengan limit 10; untuk daftar lengkap naikkan limit.")
    return issues


# ---------- konteks ----------
def _row_value(r: dict, row: dict) -> str:
    if r.get("metric") == "ratio":
        return f"{_fmt(row['nilai'])}% ({_fmt(row['jumlah'])} dari {_fmt(row['total'])} pegawai)"
    return _fmt(row["nilai"])


def _truncation_note(r: dict) -> str:
    shown, groups = len(r["rows"]), r.get("total_groups")
    cakupan = f"{shown} dari {groups} kelompok" if groups else f"{shown} kelompok pertama"
    order = r.get("order")
    if order == "metric_desc":
        isi = (f"yang tampil adalah {cakupan}, diurutkan dari nilai terbesar. Kelompok lain nilainya "
               "lebih kecil, jadi peringkat teratas di atas valid. Sebut sebagai daftar teratas, bukan data tidak lengkap.")
    elif order == "metric_asc":
        isi = (f"yang tampil adalah {cakupan}, diurutkan dari nilai terkecil. Kelompok lain nilainya "
               "lebih besar, jadi peringkat terbawah di atas valid, tetapi bukan peringkat teratas.")
    else:
        isi = (f"yang tampil adalah {cakupan}, diurutkan menurut nama/angka kelompok, BUKAN menurut nilai. "
               "Jangan menyimpulkan peringkat atau 'paling' dari daftar ini; katakan baru sebagian data yang dapat ditampilkan.")
    return f"  CATATAN INTERNAL (jangan disebut ke pengguna): {isi}"


def stats_block(r: dict) -> str:
    lines = [f"[Perhitungan] {r['description']}"]
    group_cols = [c for c in r["columns"] if c not in VALUE_COLS]
    if not r["rows"]:
        lines.append("  hasil: tidak ada pegawai yang cocok")
    for row in r["rows"]:
        label = " / ".join(str(row[c]) for c in group_cols) or "hasil"
        lines.append(f"  - {label}: {_row_value(r, row)}")
    if r.get("total") is not None and (len(r["rows"]) > 1 or r["truncated"]):
        extra = " (termasuk yang tidak ditampilkan)" if r["truncated"] else ""
        lines.append(f"  - TOTAL seluruh kelompok{extra}: {_fmt(r['total'])}")
    if r["truncated"]:
        lines.append(_truncation_note(r))
    return "\n".join(lines)


def build_context(stat_results: list[dict], stat_errors: list[str], failures: int, docs: list[dict]) -> str:
    parts = [stats_block(r) for r in stat_results]
    parts += [f"[Perhitungan GAGAL] {e}" for e in stat_errors]
    if failures:
        parts.append("[Perhitungan GAGAL] terjadi gangguan saat mengambil sebagian data; angkanya tidak tersedia.")
    for d in docs:
        parts.append(f"[Dokumen {d['key']}]\n{d['content']}")
    return "\n\n".join(parts) if parts else "(tidak ada konteks)"


# ---------- utama ----------
def answer(question: str, history: list[dict] | None = None) -> dict:
    history = _trim_history(history)
    p, planner_msgs = plan(question, history)

    stat_results, stat_errors, failures = run_stats(p["queries"])

    # Satu kali kesempatan memperbaiki rencana: kueri ditolak, atau hasil terpotong tanpa urutan nilai.
    issues = _issues(stat_results, stat_errors)
    if issues:
        fix = ("Beberapa kueri bermasalah:\n- " + "\n- ".join(issues) +
               "\nPerbaiki dan kirim ulang objek JSON lengkap.")
        obj, _ = _ask_planner(planner_msgs + [{"role": "user", "content": fix}])
        if obj is not None:
            p2 = _normalize_plan(obj)
            r2, e2, f2 = run_stats(p2["queries"])
            if len(_issues(r2, e2)) < len(issues):
                p, stat_results, stat_errors, failures = p2, r2, e2, f2

    docs = []
    if p["search"]:
        try:
            docs = retriever.search(p["search"], k=5, filter=p["search_filter"])
            if not docs and p["search_filter"]:
                docs = retriever.search(p["search"], k=5, filter=None)
        except Exception:  # angka dari perhitungan tetap bisa dijawab walau pencarian dokumen bermasalah
            log.exception("pencarian dokumen gagal")
            docs = []

    context = build_context(stat_results, stat_errors, failures, docs)
    messages = ([{"role": "system", "content": prompts.ANSWER_SYSTEM}] + history +
                [{"role": "user", "content": f"KONTEKS:\n{context}\n\nPERTANYAAN: {question}"}])
    text = llm.chat(messages, max_tokens=1500, temperature=0.1)

    sources: list[str] = []
    if SHOW_SOURCES:
        sources = [f"Perhitungan: {r['description']}" for r in stat_results]
        sources += [f"Dokumen: {d['key']}" for d in docs]
        sources = list(dict.fromkeys(sources))  # buang duplikat, urutan tetap
    log.info(
        "chat session=%s q=%r stat_queries=%d stat_errors=%d docs=%d",
        session_id_var.get(), question[:300], len(stat_results), len(stat_errors), len(docs),
    )
    return {"answer": text, "sources": sources, "plan": p, "context": context}
