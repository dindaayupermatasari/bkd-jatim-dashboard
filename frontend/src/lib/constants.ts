// ── Design tokens ─────────────────────────────────────────────────────────────

export const C = {
  blue:   "#2563EB",
  teal:   "#0D9488",
  coral:  "#F97316",
  amber:  "#F59E0B",
  red:    "#EF4444",
  purple: "#8B5CF6",
  navy:   "#0F172A",
};

export const GRAD = {
  blue:  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
  coral: "linear-gradient(135deg, #EA6F02 0%, #FB923C 100%)",
  teal:  "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
  hero:  "linear-gradient(to bottom right, #0F172A 0%, #1E3A8A 60%, #1D4ED8 100%)",
};

// ── Utilities ─────────────────────────────────────────────────────────────────

export const fmt    = (n: number) => n.toLocaleString("id-ID");
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export const riskLabel = (skor: number) => skor < 60 ? "Kritis" : skor < 75 ? "Waspada" : "Aman";
export const riskColor = (skor: number) => skor < 60 ? C.coral : skor < 75 ? C.amber : C.teal;

// ── Data constants ─────────────────────────────────────────────────────────────

export const STATUS_DATA = [
  { name: "PNS",              value: 35744, pct: 44.5, color: C.blue  },
  { name: "PPPK Penuh Waktu", value: 23310, pct: 29.0, color: C.teal  },
  { name: "PPPK Paruh Waktu", value: 21223, pct: 26.5, color: C.coral },
];

export const GENERASI_DATA = [
  { name: "Baby Boomer", value:   137, color: C.coral  },
  { name: "Generasi X",  value: 29842, color: C.blue   },
  { name: "Milenial",    value: 43983, color: C.teal   },
  { name: "Gen Z",       value:  6315, color: C.purple },
];

export const GENERASI_BY_STATUS = [
  { status: "PNS",              BabyBoom: 137,  GenX: 18000, Milenial: 14000, GenZ: 3607 },
  { status: "PPPK Penuh Waktu", BabyBoom: 0,    GenX:  7200, Milenial: 15200, GenZ:  910 },
  { status: "PPPK Paruh Waktu", BabyBoom: 0,    GenX:  4642, Milenial: 14783, GenZ: 1798 },
];

// Pola lonjakan: 2026→2027 +215% (klaster usia 57-58 berbarengan mencapai BUP)
export const PROYEKSI_PENSIUN = [
  { year: "2026", total:  423, pendidikan:  241, kesehatan:  98, lainnya:  84 },
  { year: "2027", total: 1332, pendidikan:  758, kesehatan: 334, lainnya: 240 },
  { year: "2028", total: 2100, pendidikan: 1200, kesehatan: 540, lainnya: 360 },
  { year: "2029", total: 2750, pendidikan: 1580, kesehatan: 710, lainnya: 460 },
  { year: "2030", total: 2800, pendidikan: 1620, kesehatan: 720, lainnya: 460 },
  { year: "2031", total: 2400, pendidikan: 1380, kesehatan: 640, lainnya: 380 },
  { year: "2032", total: 1980, pendidikan: 1120, kesehatan: 530, lainnya: 330 },
  { year: "2033", total: 1580, pendidikan:  880, kesehatan: 430, lainnya: 270 },
  { year: "2034", total: 1200, pendidikan:  660, kesehatan: 340, lainnya: 200 },
  { year: "2035", total:  870, pendidikan:  470, kesehatan: 250, lainnya: 150 },
];

export const OPD_DATA = [
  { id: 1,  nama: "Dinas Pendidikan",            total: 52809, rataUsia: 44.2, pctS1: 82, pctTua: 38, skor: 42, skorStk: 65, skorFnk: 35, detail: "52.809 ASN (65,8% total provinsi) — didominasi JF Guru. Risiko fungsional ekstrem: proyeksi 1.580 guru pensiun dalam 5 tahun. Risiko struktural moderat karena posisi JPT/Admin relatif lebih muda." },
  { id: 2,  nama: "Dinas Kelautan & Perikanan",  total:   876, rataUsia: 44.8, pctS1: 69, pctTua: 35, skor: 51, skorStk: 55, skorFnk: 48, detail: "Proporsi tenaga ahli kelautan usia >50 tahun sangat tinggi (35%). Risiko hilangnya keahlian teknis spesifik yang sulit digantikan." },
  { id: 3,  nama: "Dinas PU Bina Marga",         total:  3120, rataUsia: 43.6, pctS1: 61, pctTua: 31, skor: 54, skorStk: 50, skorFnk: 56, detail: "Banyak tenaga teknis konstruksi senior mendekati BUP. Risiko fungsional lebih tinggi dari struktural." },
  { id: 4,  nama: "Dinas Kesehatan",             total:  8920, rataUsia: 41.8, pctS1: 74, pctTua: 29, skor: 61, skorStk: 68, skorFnk: 57, detail: "Kebutuhan JF Medis dan Paramedis cukup tinggi. Posisi struktural cukup terisi PNS senior." },
  { id: 5,  nama: "Dinas Perhubungan",           total:  1560, rataUsia: 42.3, pctS1: 55, pctTua: 28, skor: 62, skorStk: 60, skorFnk: 63, detail: "Pendidikan S1+ masih 55%. PPPK Paruh Waktu mendominasi staf pelaksana namun tidak bisa mengisi jabatan Pengawas." },
  { id: 6,  nama: "Satuan Polisi Pamong Praja",  total:  2780, rataUsia: 38.9, pctS1: 48, pctTua: 19, skor: 70, skorStk: 72, skorFnk: 68, detail: "Distribusi usia muda cukup baik. Mayoritas PNS sehingga risiko struktural lebih terkendali." },
  { id: 7,  nama: "Dinas Sosial",                total:  2340, rataUsia: 40.1, pctS1: 68, pctTua: 22, skor: 75, skorStk: 76, skorFnk: 74, detail: "Komposisi usia relatif baik. Perlu peningkatan proporsi S1+ pada jabatan fungsional Pekerja Sosial." },
  { id: 8,  nama: "Badan Kesbangpol",            total:   312, rataUsia: 41.5, pctS1: 84, pctTua: 24, skor: 79, skorStk: 82, skorFnk: 77, detail: "Komposisi kepegawaian baik. Sebagian besar PNS sehingga jabatan struktural aman." },
  { id: 9,  nama: "Badan Pendapatan Daerah",     total:  1840, rataUsia: 39.2, pctS1: 78, pctTua: 21, skor: 81, skorStk: 85, skorFnk: 78, detail: "Komposisi kepegawaian cukup baik. Pendidikan tinggi memadai untuk fungsi pengelolaan pendapatan." },
  { id: 10, nama: "Badan Kepegawaian Daerah",    total:   245, rataUsia: 38.4, pctS1: 91, pctTua: 18, skor: 88, skorStk: 90, skorFnk: 86, detail: "Komposisi sangat baik. Distribusi usia merata dengan proporsi PNS muda cukup dan pendidikan tinggi dominan." },
];

export const KONVERGENSI = Array.from({ length: 50 }, (_, i) => ({
  iter: i + 1,
  GA:  +(Math.max(75, 97 - 22 * Math.exp(-i * 0.12)).toFixed(2)),
  PSO: +(Math.max(73, 95 - 22 * Math.exp(-i * 0.15)).toFixed(2)),
  SA:  +(Math.max(68, 88 - 20 * Math.exp(-i * 0.08)).toFixed(2)),
}));

export const ALGO_DATA = [
  { algo: "Genetic Algorithm (GA)",    waktu: "2,34 dtk", fitness: 97.8, iter: 200, terbaik: true  },
  { algo: "Particle Swarm Opt. (PSO)", waktu: "1,89 dtk", fitness: 95.2, iter: 180, terbaik: false },
  { algo: "Simulated Annealing (SA)",  waktu: "3,12 dtk", fitness: 93.6, iter: 250, terbaik: false },
];

export const DEFAULT_WEIGHTS = [
  { label: "Usia",          key: "usia",         kolom: "umur",          pct: 30, color: C.blue   },
  { label: "Jarak BUP",    key: "jarakBup",      kolom: "bup",           pct: 25, color: C.teal   },
  { label: "Klaster",       key: "klaster",       kolom: "klaster",       pct: 25, color: C.coral  },
  { label: "Jenis Jabatan", key: "jenisJabatan",  kolom: "jenis_jabatan", pct: 20, color: C.purple },
];

export const OPT_WEIGHTS: Record<string, { label: string; pct: number; color: string }[]> = {
  GA:  [
    { label: "Usia",          pct: 38, color: C.blue   },
    { label: "Jarak BUP",    pct: 24, color: C.teal   },
    { label: "Klaster",       pct: 19, color: C.coral  },
    { label: "Jenis Jabatan", pct: 19, color: C.purple },
  ],
  PSO: [
    { label: "Usia",          pct: 35, color: C.blue   },
    { label: "Jarak BUP",    pct: 26, color: C.teal   },
    { label: "Klaster",       pct: 21, color: C.coral  },
    { label: "Jenis Jabatan", pct: 18, color: C.purple },
  ],
  SA:  [
    { label: "Usia",          pct: 36, color: C.blue   },
    { label: "Jarak BUP",    pct: 23, color: C.teal   },
    { label: "Klaster",       pct: 22, color: C.coral  },
    { label: "Jenis Jabatan", pct: 19, color: C.purple },
  ],
};

export const OPD_SKOR_OPT: Record<string, Record<number, number>> = {
  GA:  { 1: 39, 2: 46, 3: 50, 4: 59, 5: 61, 6: 74, 7: 76, 8: 79, 9: 83, 10: 91 },
  PSO: { 1: 41, 2: 48, 3: 52, 4: 60, 5: 62, 6: 72, 7: 76, 8: 79, 9: 82, 10: 90 },
  SA:  { 1: 40, 2: 47, 3: 51, 4: 60, 5: 62, 6: 73, 7: 76, 8: 79, 9: 83, 10: 90 },
};

export const ALGO_DEFAULTS_SUMMARY = [
  { algo: "GA",  items: ["Populasi: 100 individu", "Iterasi: 200 generasi", "Mutasi: 10%"] },
  { algo: "PSO", items: ["Partikel: 50",            "Iterasi: 180",          "Inersia: 0.7"] },
  { algo: "SA",  items: ["Suhu awal: 1.000",        "Pendinginan: 95%",      "Iterasi: 250"] },
];

export const KUALITAS_DATA = [
  { sumber: "Data PNS",         skor: 94.2, lengkap: 33598, total: 35744, color: C.teal  },
  { sumber: "PPPK Penuh Waktu", skor: 88.7, lengkap: 20676, total: 23310, color: C.blue  },
  { sumber: "PPPK Paruh Waktu", skor: 76.3, lengkap: 16193, total: 21223, color: C.amber },
];

export const ANOMALI_DATA = [
  { field: "Tanggal Lahir",       kosong: 842,  pct: 1.05 },
  { field: "Tingkat Pendidikan",  kosong: 1205, pct: 1.50 },
  { field: "Nomor SK Terakhir",   kosong: 3210, pct: 4.00 },
  { field: "Unit Kerja Detail",   kosong: 2105, pct: 2.62 },
  { field: "Jabatan Fungsional",  kosong: 980,  pct: 1.22 },
  { field: "TMT Jabatan",         kosong: 1560, pct: 1.94 },
];

export const SLIDES = [
  { img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&h=1080&fit=crop&auto=format", headline: "Perencanaan SDM ASN yang Lebih Presisi, Berbasis Data",   sub: "Sistem analitik kepegawaian terintegrasi untuk 80.277 ASN di 56 OPD Provinsi Jawa Timur" },
  { img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&h=1080&fit=crop&auto=format", headline: "Prediksi Pensiun Akurat hingga 10 Tahun ke Depan",         sub: "Antisipasi 9.405 ASN yang pensiun 2026–2030 dan rencanakan rekrutmen strategis lebih awal" },
  { img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&h=1080&fit=crop&auto=format", headline: "Asisten AI yang Memahami Data Kepegawaian Anda",          sub: "Tanya jawab analitik real-time berbasis data agregat ASN untuk keputusan cepat dan tepat"  },
  { img: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop&auto=format", headline: "Satu Platform untuk Seluruh Kebutuhan Analitik ASN",      sub: "Dari demografi real-time hingga simulasi optimasi bobot kriteria berbasis algoritma"       },
];

export const QUICK_TOPICS = [
  "Berapa proyeksi pensiun 2027?",
  "OPD mana paling butuh rekrutmen?",
  "Berapa total ASN Jawa Timur?",
  "OPD dengan risiko regenerasi tertinggi?",
];

export const getBotResponse = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("pensiun") && m.includes("2027")) return "Diperkirakan 1.332 ASN akan memasuki pensiun pada 2027. Mayoritas berasal dari Dinas Pendidikan (758 orang) dan Dinas Kesehatan (334 orang). Berdasarkan Pergub No. 45/2022, OPD wajib menyampaikan kebutuhan formasi paling lambat 6 bulan sebelum BUP.";
  if (m.includes("rekrutmen") || m.includes("formasi")) return "Prioritas rekrutmen: (1) Dinas Pendidikan — 420 formasi JF Guru, (2) Dinas Kesehatan — 185 JF Medis & 240 JF Paramedis, (3) Dinas PU Bina Marga — 95 JF Teknis. Total rekomendasi formasi: 1.225 posisi untuk skenario standar.";
  if (m.includes("total asn") || m.includes("jumlah asn")) return "Total ASN Provinsi Jawa Timur per Agustus 2026: 80.277 orang — PNS 35.744 (44,5%), PPPK Penuh Waktu 23.310 (29%), PPPK Paruh Waktu 21.223 (26,5%). Rata-rata usia 41,2 tahun.";
  if (m.includes("algoritma") || m.includes("terbaik")) return "Genetic Algorithm (GA) menghasilkan performa terbaik — nilai fitness 97,8 dalam 200 iterasi (2,34 detik). Selisih 2,6 poin di atas PSO dan 4,2 poin di atas SA. Direkomendasikan untuk optimasi bobot kriteria skala provinsi.";
  if (m.includes("regenerasi") || m.includes("risiko")) return "OPD dengan risiko regenerasi tertinggi: Dinas Pendidikan (skor 42 — Kritis) dan Dinas Kelautan & Perikanan (skor 51 — Kritis). Keduanya memiliki proporsi ASN usia >50 tahun yang sangat tinggi. Berdasarkan data Agustus 2026.";
  return "Maaf, saya belum memiliki jawaban spesifik untuk itu. Silakan coba pertanyaan lain tentang demografi ASN, proyeksi pensiun, atau rekomendasi formasi. Data tersedia untuk seluruh 56 OPD Provinsi Jawa Timur.";
};
