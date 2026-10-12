"""
optimasi_service.py
Logic Simulator Optimasi Bobot Kriteria.

OBJECTIVE FUNCTION: maximize Var(skor_komposit) antar OPD, terhadap bobot w.
Rasional: bobot yang baik = bikin skor OPD paling tersebar/diskriminatif,
supaya OPD kritis vs aman kelihatan beda jelas (lihat threshold _kategori()
di opd_service.py). Bobot yang bikin semua OPD nilainya mepet-mepet = useless
buat prioritisasi.

CONSTRAINT: sum(w) = 100, tiap w_k dalam [BOBOT_MIN, BOBOT_MAX].

PENTING: sub-skor per OPD (usia_score dst) dihitung SEKALI dari DB lewat
_hitung_sub_skor() di opd_service.py, lalu GA/PSO/SA cuma ngoprek array di
memori. JANGAN panggil compute_perbandingan_opd() atau query DB di dalam
loop optimasi - itu bakal lambat parah (ribuan evaluasi x query berat).

=====================================================================
UPDATE PENTING: kriteria sekarang DINAMIS, bukan hardcode 4
=====================================================================
Sebelumnya file ini hardcode KRITERIA = ["usia","bup","jenis_jabatan",
"klaster"] (4 kriteria, array shape (n,4)). Setelah opd_service.py nambah
kriteria ke-5 (generasi, dari masukan mentor BKD soal komposisi generasi
ideal), file ini DIUBAH supaya baca daftar kriteria langsung dari
KRITERIA_URUTAN di opd_service.py - biar kalau nanti nambah/kurang
kriteria lagi, gak perlu ubah manual di 2 tempat (opd_service.py DAN
optimasi_service.py). Semua np.array/np.full yang tadinya hardcode angka 4
sekarang pakai len(KRITERIA).
"""

import random
import time

import numpy as np
from sqlalchemy.orm import Session

from app.services.opd_service import KRITERIA_URUTAN, _hitung_sub_skor

KRITERIA = KRITERIA_URUTAN  # alias, biar kode di bawah gak perlu diubah namanya
N_KRITERIA = len(KRITERIA)
BOBOT_MIN = 5
BOBOT_MAX = 60


def _ambil_matrix_subskor(db: Session) -> np.ndarray:
    """shape (n_opd, N_KRITERIA), urutan kolom sesuai KRITERIA."""
    sub = _hitung_sub_skor(db)
    return np.array([[s[f"{k}_score"] for k in KRITERIA] for s in sub])


def _skor_komposit(matrix: np.ndarray, w: np.ndarray) -> np.ndarray:
    return matrix @ w / 100  # w dalam skala 0-100, sum=100


def _clip_normalisasi(w: np.ndarray) -> np.ndarray:
    w = np.clip(w, BOBOT_MIN, BOBOT_MAX)
    return w / w.sum() * 100


def _hitung_var_max(matrix: np.ndarray) -> float:
    """Upper bound variance secara brute-force di titik ekstrem simplex
    (valid karena maximize variance = fungsi kuadratik konveks, optimum
    global selalu di corner region layak). Dipakai buat normalisasi fitness
    ke skala 0-100, dan sebagai sanity-check independen terhadap hasil GA/PSO/SA."""
    terbaik = 0.0
    for i in range(N_KRITERIA):
        w = np.full(N_KRITERIA, BOBOT_MIN, dtype=float)
        w[i] = BOBOT_MAX
        w = _clip_normalisasi(w)
        var = np.var(_skor_komposit(matrix, w))
        terbaik = max(terbaik, var)
    return terbaik or 1e-9


def _fitness(matrix: np.ndarray, w: np.ndarray, var_max: float) -> float:
    var = np.var(_skor_komposit(matrix, w))
    return float(var / var_max * 100)


def _random_bobot() -> np.ndarray:
    w = np.random.dirichlet(np.ones(N_KRITERIA)) * 100
    return _clip_normalisasi(w)


def jalankan_ga(db: Session, pop_size: int = 100, generations: int = 200,
                mutation_rate: float = 0.1) -> dict:
    t0 = time.time()
    matrix = _ambil_matrix_subskor(db)
    var_max = _hitung_var_max(matrix)

    populasi = [_random_bobot() for _ in range(pop_size)]
    kurva = []

    for _ in range(generations):
        fit = np.array([_fitness(matrix, w, var_max) for w in populasi])
        kurva.append(float(fit.max()))

        # seleksi turnamen
        anak = []
        for _ in range(pop_size):
            i, j = random.sample(range(pop_size), 2)
            anak.append(populasi[i] if fit[i] > fit[j] else populasi[j])

        # crossover (blend) + mutasi
        populasi_baru = []
        for i in range(0, pop_size, 2):
            p1, p2 = anak[i], anak[(i + 1) % pop_size]
            alpha = random.random()
            for c in (alpha * p1 + (1 - alpha) * p2, alpha * p2 + (1 - alpha) * p1):
                if random.random() < mutation_rate:
                    c = c + np.random.normal(0, 5, size=N_KRITERIA)
                populasi_baru.append(_clip_normalisasi(c))
        populasi = populasi_baru[:pop_size]

    fit_akhir = np.array([_fitness(matrix, w, var_max) for w in populasi])
    idx = int(np.argmax(fit_akhir))
    w_terbaik = populasi[idx]

    return {
        "bobot": {k: round(v, 1) for k, v in zip(KRITERIA, w_terbaik)},
        "fitness_terbaik": round(float(fit_akhir[idx]), 1),
        "kurva_konvergensi": [round(v, 1) for v in kurva],
        "waktu_eksekusi_detik": round(time.time() - t0, 2),
    }