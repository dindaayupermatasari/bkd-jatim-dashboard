"""
formasi_service.py
Logic "Simulator Alokasi Formasi" SIAP-ASN.

MODEL
- Variabel   : alokasi_i = jumlah formasi untuk OPD ke-i
- Objective  : maximize sum_i( bobot_i * sqrt(alokasi_i) ),  bobot_i = (100 - skor_i) / 100
- Constraint : sum_i(alokasi_i) <= kuota ;  0 <= alokasi_i <= kekurangan_abk_i

CATATAN TEORI (untuk sidang)
Objective = jumlah fungsi cekung terpisah + constraint linear. Untuk kelas
masalah ini, greedy per-unit dengan marginal gain EKSAK
bobot * (sqrt(a+1) - sqrt(a)) menghasilkan solusi integer yang optimal.
Jadi Greedy = pembanding optimal; GA & SA dipakai sebagai metaheuristik
pembanding, dan diharapkan mendekati (bukan melampaui) Greedy.
"""

import heapq
import logging
import math
import random
import time

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.opd_service import compute_perbandingan_opd, _kategori

log = logging.getLogger(__name__)
KUOTA_MIN = 50


# ---------------------------------------------------------------------
# 1. Data
# ---------------------------------------------------------------------
def _ambil_data_gabungan(db: Session) -> list[dict]:
    """Skor risiko (opd_service) + kekurangan ABK (abk_per_opd).
    Dipanggil SEKALI per request lalu dioper ke semua algoritma."""
    skor_list = compute_perbandingan_opd(db)
    rows = db.execute(text("SELECT opd, kekurangan FROM abk_per_opd")).mappings().all()
    abk_map = {r["opd"].upper().strip(): int(r["kekurangan"]) for r in rows}

    hasil, tidak_ketemu = [], []
    for s in skor_list:
        kekurangan = abk_map.get(s["nama"].upper().strip())
        if kekurangan is None:
            tidak_ketemu.append(s["nama"])
            continue
        hasil.append({
            "nama": s["nama"],
            "skor_risiko": float(s["skor_komposit"]),
            "kategori": s["kategori"],
            "kekurangan_abk": kekurangan,
        })
    if tidak_ketemu:
        log.warning("OPD tidak ketemu di abk_per_opd: %s", tidak_ketemu)
    return hasil


def _bobot_risiko(skor: float) -> float:
    return (100 - skor) / 100


def _nilai_alokasi(data: list[dict], alokasi: np.ndarray) -> float:
    return float(sum(_bobot_risiko(d["skor_risiko"]) * math.sqrt(a) for d, a in zip(data, alokasi)))


def _skor(nilai: float, acuan: float) -> float:
    """Skala 'Skor Optimasi': 100 = setara nilai Greedy."""
    return round(nilai / acuan * 100, 1) if acuan > 0 else 0.0


# ---------------------------------------------------------------------
# 2. Greedy per-unit (juga dipakai GA/SA untuk mengisi sisa kuota)
# ---------------------------------------------------------------------
def _greedy_alokasikan(data: list[dict], kuota: int, alokasi_awal: np.ndarray | None = None) -> np.ndarray:
    n = len(data)
    alokasi = alokasi_awal.copy() if alokasi_awal is not None else np.zeros(n)
    kekurangan = np.array([d["kekurangan_abk"] for d in data], dtype=float)
    bobot = np.array([_bobot_risiko(d["skor_risiko"]) for d in data])

    sisa = int(kuota - alokasi.sum())
    if sisa <= 0:
        return alokasi

    def gain(i: int) -> float:
        if alokasi[i] >= kekurangan[i]:
            return -1.0
        # selisih EKSAK nilai bila alokasi naik dari a ke a+1
        return bobot[i] * (math.sqrt(alokasi[i] + 1) - math.sqrt(alokasi[i]))

    heap = [(-gain(i), i) for i in range(n) if gain(i) > 0]
    heapq.heapify(heap)

    for _ in range(sisa):
        if not heap:
            break
        _, i = heapq.heappop(heap)
        alokasi[i] += 1
        g = gain(i)
        if g > 0:
            heapq.heappush(heap, (-g, i))
    return alokasi


def _perbaiki(mentah: np.ndarray, data: list[dict], kuota: int) -> np.ndarray:
    """Clip ke batas, skala turun bila melebihi kuota, bulatkan,
    lalu isi sisa kuota dengan greedy."""
    kekurangan = np.array([d["kekurangan_abk"] for d in data], dtype=float)
    a = np.clip(mentah, 0, kekurangan)
    total = a.sum()
    if total > kuota:
        a = a * (kuota / total)
    a = np.clip(np.floor(a), 0, kekurangan)
    return _greedy_alokasikan(data, kuota, alokasi_awal=a)


def _vektor_acak(data: list[dict], kuota: int) -> np.ndarray:
    proporsi = np.random.dirichlet(np.ones(len(data)))
    return _perbaiki(proporsi * kuota, data, kuota)


# ---------------------------------------------------------------------
# 3. Susun hasil
# ---------------------------------------------------------------------
def _hitung_pengurangan_risiko(data: list[dict], alokasi: np.ndarray) -> float:
    """Angka bacaan: pemenuhan kekurangan tertimbang risiko (BUKAN yang dioptimasi)."""
    potensi = sum(_bobot_risiko(d["skor_risiko"]) * d["kekurangan_abk"] for d in data)
    tercapai = sum(_bobot_risiko(d["skor_risiko"]) * a for d, a in zip(data, alokasi))
    return round(tercapai / potensi * 100, 1) if potensi > 0 else 0.0


def _baseline_merata(data: list[dict], kuota: int) -> float:
    total = sum(d["kekurangan_abk"] for d in data)
    if total == 0:
        return 0.0
    a = np.array([min(d["kekurangan_abk"], round(d["kekurangan_abk"] / total * kuota)) for d in data], dtype=float)
    return _hitung_pengurangan_risiko(data, a)


def _bentuk_hasil(data, alokasi, kuota, algoritma, t0, konvergen, kurva, nilai_acuan) -> dict:
    daftar = []
    for i, (d, a) in enumerate(zip(data, alokasi)):
        a_int, k = int(a), d["kekurangan_abk"]
        daftar.append({
            "id": i + 1,
            "nama": d["nama"],
            "skor_risiko": round(d["skor_risiko"], 1),
            "kategori": _kategori(d["skor_risiko"]),
            "kekurangan_abk": k,
            "alokasi": a_int,
            "sisa_kekurangan": k - a_int,
            "persen_terpenuhi": round(a_int / k * 100, 1) if k > 0 else 100.0,
        })
    return {
        "algoritma": algoritma,
        "kuota": kuota,
        "formasi_terpakai": int(alokasi.sum()),
        "pengurangan_risiko_persen": _hitung_pengurangan_risiko(data, alokasi),
        "nilai_objektif": _skor(_nilai_alokasi(data, alokasi), nilai_acuan),
        "waktu_eksekusi_detik": round(time.time() - t0, 2),
        "konvergen_iterasi": konvergen,
        "kurva_konvergensi": kurva,
        "alokasi": daftar,
        "baseline_merata": {"pengurangan_risiko_persen": _baseline_merata(data, kuota)},
    }


def _konvergen(kurva: list[float], default: int) -> int:
    akhir = kurva[-1] if kurva else 0.0
    return next((i + 1 for i, v in enumerate(kurva) if v >= akhir * 0.98), default)


# ---------------------------------------------------------------------
# 4. Tiga algoritma (parameter `data` opsional: kalau sudah diambil di
#    luar, dioper supaya DB tidak di-query ulang)
# ---------------------------------------------------------------------
def jalankan_greedy(db: Session, kuota: int, data: list[dict] | None = None) -> dict:
    kuota = max(KUOTA_MIN, int(kuota))
    if data is None:
        data = _ambil_data_gabungan(db)
    t0 = time.time()  # timer mulai SETELAH query DB, supaya adil antar algoritma

    alokasi = _greedy_alokasikan(data, kuota)
    acuan = _nilai_alokasi(data, alokasi)
    return _bentuk_hasil(data, alokasi, kuota, "greedy", t0, None, [], acuan)


def jalankan_ga(db: Session, kuota: int, populasi: int = 100, generasi: int = 200,
                mutasi_persen: float = 10, data: list[dict] | None = None) -> dict:
    kuota = max(KUOTA_MIN, int(kuota))
    if data is None:
        data = _ambil_data_gabungan(db)
    t0 = time.time()
    n = len(data)
    mutasi_rate = mutasi_persen / 100
    acuan = _nilai_alokasi(data, _greedy_alokasikan(data, kuota))

    pop = [_vektor_acak(data, kuota) for _ in range(populasi)]
    terbaik, nilai_terbaik = None, -1.0
    kurva: list[float] = []

    for _ in range(generasi):
        fit = np.array([_nilai_alokasi(data, ind) for ind in pop])
        idx = int(np.argmax(fit))
        if fit[idx] > nilai_terbaik:
            nilai_terbaik, terbaik = float(fit[idx]), pop[idx].copy()
        kurva.append(_skor(nilai_terbaik, acuan))  # best-so-far -> kurva monoton

        # seleksi turnamen
        pilihan = []
        for _ in range(populasi):
            i, j = random.sample(range(populasi), 2)
            pilihan.append(pop[i] if fit[i] > fit[j] else pop[j])

        # crossover blend + mutasi
        pop_baru = []
        for k in range(0, populasi, 2):
            p1, p2 = pilihan[k], pilihan[(k + 1) % populasi]
            alpha = random.random()
            for anak in (alpha * p1 + (1 - alpha) * p2, alpha * p2 + (1 - alpha) * p1):
                if random.random() < mutasi_rate:
                    anak = anak + np.random.normal(0, kuota * 0.02, size=n)
                pop_baru.append(_perbaiki(anak, data, kuota))

        pop = [terbaik.copy()] + pop_baru[: populasi - 1]  # elitisme

    fit = np.array([_nilai_alokasi(data, ind) for ind in pop])
    idx = int(np.argmax(fit))
    if fit[idx] > nilai_terbaik:
        terbaik = pop[idx].copy()

    return _bentuk_hasil(data, terbaik, kuota, "ga", t0, _konvergen(kurva, generasi), kurva, acuan)


def jalankan_sa(db: Session, kuota: int, suhu_awal: float = 1000, laju_pendinginan: float = 0.95,
                iterasi: int = 250, data: list[dict] | None = None) -> dict:
    """
    Suhu dinormalisasi: T = suhu_awal / 1000, dan selisih nilai dihitung dalam
    poin Skor Optimasi (0-100). Jadi suhu_awal=1000 berarti kemunduran 1 poin
    diterima dengan peluang e^-1 di awal proses.
    """
    kuota = max(KUOTA_MIN, int(kuota))
    if data is None:
        data = _ambil_data_gabungan(db)
    t0 = time.time()
    n = len(data)
    acuan = _nilai_alokasi(data, _greedy_alokasikan(data, kuota))

    alokasi = _vektor_acak(data, kuota)
    nilai = _nilai_alokasi(data, alokasi)
    terbaik, nilai_terbaik = alokasi.copy(), nilai

    suhu = suhu_awal / 1000
    kurva: list[float] = []

    for _ in range(iterasi):
        kandidat = _perbaiki(alokasi + np.random.normal(0, kuota * 0.03, size=n), data, kuota)
        nilai_k = _nilai_alokasi(data, kandidat)
        delta = (nilai_k - nilai) / acuan * 100 if acuan > 0 else 0.0  # dalam poin skor

        if delta > 0 or random.random() < math.exp(delta / max(suhu, 1e-9)):
            alokasi, nilai = kandidat, nilai_k
            if nilai > nilai_terbaik:
                terbaik, nilai_terbaik = alokasi.copy(), nilai

        suhu *= laju_pendinginan
        kurva.append(_skor(nilai_terbaik, acuan))

    return _bentuk_hasil(data, terbaik, kuota, "sa", t0, _konvergen(kurva, iterasi), kurva, acuan)


# ---------------------------------------------------------------------
# 5. Bandingkan & sensitivitas (data diambil SEKALI)
# ---------------------------------------------------------------------
def jalankan_bandingkan(db: Session, kuota: int) -> dict:
    data = _ambil_data_gabungan(db)
    greedy = jalankan_greedy(db, kuota, data=data)
    ga = jalankan_ga(db, kuota, data=data)
    sa = jalankan_sa(db, kuota, data=data)
    terbaik = max([("greedy", greedy), ("ga", ga), ("sa", sa)], key=lambda x: x[1]["nilai_objektif"])[0]
    return {"greedy": greedy, "ga": ga, "sa": sa, "algoritma_terbaik": terbaik}


_RUNNER = {
    "greedy": lambda db, k, d: jalankan_greedy(db, k, data=d),
    "ga": lambda db, k, d: jalankan_ga(db, k, data=d),
    "sa": lambda db, k, d: jalankan_sa(db, k, data=d),
}


def jalankan_sensitivitas(db: Session, algoritma: str, kuota_list: list[int]) -> dict:
    runner = _RUNNER.get(algoritma)
    if runner is None:
        raise ValueError(f"Algoritma tidak dikenal: {algoritma}")

    data = _ambil_data_gabungan(db)
    hasil_list = [runner(db, k, data) for k in kuota_list]

    titik = [{"kuota": k, "pengurangan_risiko_persen": h["pengurangan_risiko_persen"]}
             for k, h in zip(kuota_list, hasil_list)]

    perubahan = []
    if len(hasil_list) > 2:  # titik ke-2 -> ke-3, sesuai tampilan frontend
        a_map = {o["nama"]: o["alokasi"] for o in hasil_list[1]["alokasi"]}
        b_map = {o["nama"]: o["alokasi"] for o in hasil_list[2]["alokasi"]}
        for nama, dari in a_map.items():
            ke = b_map.get(nama, dari)
            if dari != ke:
                perubahan.append({"nama": nama, "dari": dari, "ke": ke})
        perubahan.sort(key=lambda x: abs(x["ke"] - x["dari"]), reverse=True)
        perubahan = perubahan[:5]

    return {"titik": titik, "perubahan_alokasi": perubahan}