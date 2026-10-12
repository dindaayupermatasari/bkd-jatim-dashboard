"""
Evaluasi akurasi chatbot: pertanyaan uji + jawaban pembanding yang dihitung langsung
dari data/pegawai_normalized.csv (pandas), lalu dijalankan ke pipeline sungguhan.

Pemeriksaan bersifat otomatis (angka/kata kunci pada jawaban), jadi tetap baca laporan
untuk kasus yang gagal: kadang jawabannya benar tapi dirumuskan lain.

    python tests/eval_chatbot.py --dry                  # lihat pertanyaan + jawaban pembanding, tanpa memanggil LLM
    python tests/eval_chatbot.py                        # jalankan semua (butuh DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY)
    python tests/eval_chatbot.py --cat pensiun          # satu kategori saja
    python tests/eval_chatbot.py --only total_asn,bup_def
    python tests/eval_chatbot.py --resume               # lanjutkan, lewati yang sudah selesai (berguna bila kena kuota)
    python tests/eval_chatbot.py --report-only          # buat ulang laporan dari hasil yang tersimpan

Hasil: data/eval_results.jsonl (mentah) dan data/eval_report.md (ringkasan + detail yang gagal).
"""
import argparse
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))

DATA = Path("data/pegawai_normalized.csv")
RESULTS = Path("data/eval_results.jsonl")
REPORT = Path("data/eval_report.md")


# ======================= pemeriksa jawaban =======================
def N(value, tol=0.0):            # satu angka harus muncul di jawaban
    return {"type": "num", "value": value, "tol": tol}


def NS(*values):                  # semua angka ini harus muncul
    return {"type": "all", "checks": [N(v) for v in values]}


def T(*alts):                     # salah satu teks harus muncul (tanpa membedakan huruf besar/kecil)
    return {"type": "text", "alts": list(alts)}


def ANY(*checks):                 # salah satu pemeriksaan lulus
    return {"type": "any", "checks": list(checks)}


def ALL(*checks):
    return {"type": "all", "checks": list(checks)}


def parse_numbers(text: str) -> list[float]:
    """Ambil semua angka dari teks, mengerti format Indonesia (12.345 dan 34,5)."""
    out = []
    for tok in re.findall(r"\d[\d.,]*\d|\d", text.replace("\u202f", "").replace("\xa0", "")):
        if "." in tok and "," in tok:
            tok = tok.replace(".", "").replace(",", ".")
        elif "." in tok:
            tok = tok.replace(".", "") if re.fullmatch(r"\d{1,3}(\.\d{3})+", tok) else tok
        elif "," in tok:
            tok = tok.replace(",", ".")
        try:
            out.append(float(tok))
        except ValueError:
            pass
    return out


def fmt(v) -> str:
    if isinstance(v, float) and not v.is_integer():
        return f"{v:.2f}".replace(".", ",")
    return f"{int(v):,}".replace(",", ".")


def evaluate(check: dict, answer: str, nums: list[float] | None = None) -> bool:
    nums = parse_numbers(answer) if nums is None else nums
    t = check["type"]
    if t == "num":
        return any(abs(n - check["value"]) <= max(check["tol"], 1e-9) for n in nums)
    if t == "text":
        low = answer.casefold()
        return any(a.casefold() in low for a in check["alts"])
    if t == "any":
        return any(evaluate(c, answer, nums) for c in check["checks"])
    if t == "all":
        return all(evaluate(c, answer, nums) for c in check["checks"])
    raise ValueError(t)


def describe(check: dict) -> str:
    t = check["type"]
    if t == "num":
        tol = f" (±{check['tol']})" if check["tol"] else ""
        return f"angka {fmt(check['value'])}{tol}"
    if t == "text":
        return "salah satu kata: " + " | ".join(check["alts"])
    joiner = " ATAU " if t == "any" else " DAN "
    return "(" + joiner.join(describe(c) for c in check["checks"]) + ")"


# ======================= daftar pertanyaan =======================
def build_questions(df: pd.DataFrame) -> list[dict]:
    d = df.copy()
    d["tmt_bup_invalid"] = d["tmt_bup_invalid"].astype(bool)
    d["tahun_bup"] = pd.to_datetime(d["tmt_bup"]).where(~d["tmt_bup_invalid"]).dt.year
    pns, full, pw = (d[d.sumber == s] for s in ("pns", "pppk_full", "pppk_pw"))
    n = len
    pct = lambda a, b: round(a * 100 / b, 1)  # noqa: E731
    kes = d[d.opd_induk == "DINAS KESEHATAN"]
    disdik = d[d.opd_induk == "DINAS PENDIDIKAN"]
    guru = disdik[(disdik.klaster == "JF GURU") & disdik.sumber.isin(["pppk_full", "pppk_pw"])]
    top_opd = d.opd_induk.value_counts().head(1)
    top_jab = d.nama_jabatan.value_counts().head(1)
    top_pend = pns.pendidikan.value_counts().head(1)
    klaster_pns = pns.klaster.value_counts().head(3)
    by_year = {y: int((d.tahun_bup == y).sum()) for y in range(2026, 2031)}
    S = "pendidikan"

    Q = []

    def add(id_, cat, q, checks, turns=None):
        Q.append({"id": id_, "cat": cat, "q": q, "turns": turns or [q], "check": checks})

    # --- jumlah ---
    add("total_asn", "jumlah", "Berapa total ASN Jawa Timur?", N(n(d)))
    add("per_status", "jumlah", "Berapa jumlah PNS, PPPK, dan PPPK paruh waktu?", NS(n(pns), n(full), n(pw)))
    add("pppk_total", "jumlah", "Berapa jumlah seluruh PPPK?", ANY(N(n(full) + n(pw)), NS(n(full), n(pw))))
    add("pns_dinkes", "jumlah", "Berapa PNS di Dinas Kesehatan?", N(n(kes[kes.sumber == "pns"])))
    add("guru_pppk", "jumlah", "Berapa jumlah guru PPPK di Dinas Pendidikan?",
        ANY(N(n(guru)), NS(*[n(guru[guru.sumber == s]) for s in ("pppk_full", "pppk_pw")])))
    add("perawat", "jumlah", "Berapa pegawai yang nama jabatannya mengandung kata perawat?",
        N(int(d.nama_jabatan.str.contains("perawat", case=False, na=False).sum())))
    add("pns_p_s2", "jumlah", "Berapa PNS perempuan yang berpendidikan S-2?",
        N(n(pns[(pns.jenis_kelamin == "P") & (pns[S] == "S-2")])))
    add("pw_s1", "jumlah", "Berapa PPPK paruh waktu yang berpendidikan S-1?", N(n(pw[pw[S] == "S-1"])))
    add("pns_eselon", "jumlah", "Berapa PNS yang memiliki eselon?", N(int(pns.eselon.notna().sum())))
    add("singkatan", "jumlah", "Jumlah seluruh pegawai Dinkes berapa?", ANY(N(n(kes)), NS(*[n(kes[kes.sumber == s]) for s in ("pns", "pppk_full", "pppk_pw")])))

    # --- sebaran / peringkat ---
    add("klaster_pns", "sebaran", "Bagaimana sebaran PNS menurut klaster jabatan?", NS(*[int(v) for v in klaster_pns.values]))
    add("jk", "sebaran", "Berapa jumlah pegawai laki-laki dan perempuan?",
        NS(int((d.jenis_kelamin == "L").sum()), int((d.jenis_kelamin == "P").sum())))
    nm = top_pend.index[0]
    add("pend_pns", "sebaran", "Pendidikan apa yang paling banyak dimiliki PNS?",
        ALL(T(nm, nm.replace("-", "")), N(int(top_pend.iloc[0]))))
    add("opd_terbanyak", "sebaran", "OPD mana yang punya pegawai paling banyak?",
        ALL(T(top_opd.index[0]), N(int(top_opd.iloc[0]))))
    add("jabatan_terbanyak", "sebaran", "Apa jabatan dengan pegawai terbanyak?",
        ALL(T(top_jab.index[0]), N(int(top_jab.iloc[0]))))

    # --- rata-rata / ekstrem ---
    add("avg_usia_pns", "statistik", "Berapa rata-rata usia PNS?", N(round(pns.usia.mean(), 2), 0.06))
    add("avg_usia_all", "statistik", "Berapa rata-rata usia seluruh ASN?", N(round(d.usia.mean(), 2), 0.06))
    add("usia_max_pw", "statistik", "Berapa usia tertua pegawai PPPK paruh waktu?", N(int(pw.usia.max())))
    add("avg_masa_kerja", "statistik", "Berapa rata-rata masa kerja PNS?", N(round(pns.masa_kerja.mean(), 2), 0.06))

    # --- pensiun ---
    add("pensiun_2027", "pensiun", "Berapa proyeksi pensiun 2027?", N(by_year[2027]))
    add("pensiun_5th", "pensiun", "Bagaimana proyeksi pensiun 2026 sampai 2030?", NS(*by_year.values()))
    add("pensiun_pns_2028", "pensiun", "Berapa PNS yang pensiun tahun 2028?", N(int((pns.tahun_bup == 2028).sum())))
    add("pensiun_disdik", "pensiun", "Berapa pegawai Dinas Pendidikan yang pensiun pada tahun 2027?",
        N(int((disdik.tahun_bup == 2027).sum())))

    # --- persentase / perbandingan ---
    add("pct_pns_p", "hitungan", "Berapa persentase PNS perempuan?", N(pct(int((pns.jenis_kelamin == "P").sum()), n(pns)), 0.11))
    add("pct_pw", "hitungan", "Berapa persen PPPK paruh waktu dari seluruh ASN?", N(pct(n(pw), n(d)), 0.11))
    add("selisih_pppk", "hitungan", "Selisih jumlah PPPK full time dan PPPK paruh waktu berapa?", N(abs(n(full) - n(pw))))

    # --- percakapan lanjutan ---
    add("lanjut_opd", "percakapan", "Kalau PPPK paruh waktu di dinas yang sama?",
        N(n(kes[kes.sumber == "pppk_pw"])), turns=["Berapa PNS di Dinas Kesehatan?", "Kalau PPPK paruh waktu di dinas yang sama?"])
    add("lanjut_tahun", "percakapan", "Bagaimana dengan 2029?", N(int((pns.tahun_bup == 2029).sum())),
        turns=["Berapa PNS yang pensiun tahun 2028?", "Bagaimana dengan 2029?"])

    # --- penjelasan dari dokumen ---
    add("bup_def", "dokumen", "Apa itu BUP?", T("batas usia pensiun"))
    add("golongan", "dokumen", "Apa perbedaan golongan PNS dan PPPK?", T("romawi"))
    add("profil_dinkes", "dokumen", "Gambarkan komposisi pegawai Dinas Kesehatan.",
        ANY(N(n(kes)), NS(*[n(kes[kes.sumber == s]) for s in ("pns", "pppk_full", "pppk_pw")])))

    # --- batas kemampuan (heuristik, perlu dibaca manual) ---
    add("nama_individu", "batas", "Siapa nama pegawai tertua di Dinas Kesehatan?",
        T("anonim", "tanpa nama", "tidak dapat", "tidak tersedia", "tidak ada nama", "tidak memuat"))
    add("luar_topik", "batas", "Siapa presiden Indonesia saat ini?", T("kepegawaian", "hanya"))
    add("gaji", "batas", "Berapa gaji rata-rata PNS?", T("tidak tersedia", "tidak ada", "tidak memuat", "belum tersedia", "tidak dapat"))
    add("opd_fiktif", "batas", "Berapa pegawai di Dinas Antariksa?", T("tidak ditemukan", "tidak ada", "tidak tersedia", "tidak dapat", "tidak terdaftar"))
    return Q


# ======================= menjalankan =======================
def run_question(q: dict, pause: float) -> dict:
    from rag import pipeline  # impor di sini agar --dry tidak butuh kunci API

    hist, res, t0 = [], None, time.time()
    for turn in q["turns"]:
        res = pipeline.answer(turn, hist)
        hist += [{"role": "user", "content": turn}, {"role": "assistant", "content": res["answer"]}]
        time.sleep(pause)
    return {"answer": res["answer"], "plan": res["plan"], "sources": res["sources"],
            "seconds": round(time.time() - t0, 1)}


def load_results() -> dict[str, dict]:
    if not RESULTS.exists():
        return {}
    rows = [json.loads(line) for line in open(RESULTS, encoding="utf-8") if line.strip()]
    return {r["id"]: r for r in rows}  # yang terakhir menang


def build_report(questions: list[dict], results: dict[str, dict]) -> str:
    done = [q for q in questions if q["id"] in results]
    if not done:
        return "Belum ada hasil.\n"
    ok = [q for q in done if results[q["id"]]["passed"]]
    cats = defaultdict(lambda: [0, 0])
    for q in done:
        cats[q["cat"]][1] += 1
        cats[q["cat"]][0] += results[q["id"]]["passed"]
    lines = [f"# Laporan evaluasi chatbot\n",
             f"Lulus **{len(ok)} dari {len(done)}** pertanyaan ({len(ok) * 100 / len(done):.0f}%).\n",
             "| Kategori | Lulus | Total |", "|---|---|---|"]
    lines += [f"| {c} | {a} | {b} |" for c, (a, b) in cats.items()]
    gagal = [q for q in done if not results[q["id"]]["passed"]]
    if gagal:
        lines.append("\n## Yang gagal (baca jawabannya: kadang benar tapi dirumuskan lain)\n")
    for q in gagal:
        r = results[q["id"]]
        lines += [f"### {q['id']} ({q['cat']})",
                  f"- Pertanyaan: {' → '.join(q['turns'])}",
                  f"- Diharapkan: {describe(q['check'])}",
                  f"- Rencana LLM: `{json.dumps(r.get('plan'), ensure_ascii=False)}`",
                  f"- Galat: {r['error']}" if r.get("error") else f"- Jawaban:\n\n> " + r["answer"].replace("\n", "\n> "), ""]
    waktu = [results[q["id"]]["seconds"] for q in done if results[q["id"]].get("seconds")]
    if waktu:
        lines.append(f"\nWaktu respons rata-rata: {sum(waktu) / len(waktu):.1f} detik per pertanyaan.")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(DATA))
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--cat")
    ap.add_argument("--only")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--report-only", action="store_true")
    ap.add_argument("--pause", type=float, default=4.0, help="jeda antar pertanyaan (detik) agar tidak kena batas kuota")
    a = ap.parse_args()

    questions = build_questions(pd.read_csv(a.data, low_memory=False))
    if a.cat:
        questions = [q for q in questions if q["cat"] == a.cat]
    if a.only:
        ids = set(a.only.split(","))
        questions = [q for q in questions if q["id"] in ids]

    if a.dry:
        for q in questions:
            print(f"[{q['cat']:10s}] {q['id']:18s} {' → '.join(q['turns'])}\n{'':13s}harapan: {describe(q['check'])}")
        print(f"\n{len(questions)} pertanyaan")
        return

    results = load_results()
    if not a.report_only:
        RESULTS.parent.mkdir(parents=True, exist_ok=True)
        todo = [q for q in questions if not (a.resume and q["id"] in results and not results[q["id"]].get("error"))]
        for i, q in enumerate(todo, 1):
            print(f"[{i}/{len(todo)}] {q['id']}: {' → '.join(q['turns'])}", flush=True)
            rec = {"id": q["id"], "cat": q["cat"]}
            try:
                rec.update(run_question(q, a.pause))
                rec["passed"] = evaluate(q["check"], rec["answer"])
                rec["error"] = None
            except Exception as e:  # noqa: BLE001 - satu pertanyaan gagal tidak boleh menghentikan evaluasi
                rec.update({"answer": "", "plan": None, "sources": [], "passed": False, "error": f"{type(e).__name__}: {e}"})
            print("   ", "LULUS" if rec["passed"] else "GAGAL", f"({rec.get('seconds', '-')} dtk)", flush=True)
            results[q["id"]] = rec
            with open(RESULTS, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    report = build_report(questions, results)
    REPORT.write_text(report, encoding="utf-8")
    print("\n" + report.split("\n## Yang gagal")[0])
    print(f"Laporan lengkap: {REPORT}")


if __name__ == "__main__":
    main()
