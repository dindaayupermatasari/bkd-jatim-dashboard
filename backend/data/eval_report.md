# Laporan evaluasi chatbot

Lulus **33 dari 35** pertanyaan (94%).

| Kategori | Lulus | Total |
|---|---|---|
| jumlah | 10 | 10 |
| sebaran | 4 | 5 |
| statistik | 4 | 4 |
| pensiun | 4 | 4 |
| hitungan | 3 | 3 |
| percakapan | 1 | 2 |
| dokumen | 3 | 3 |
| batas | 4 | 4 |

## Yang gagal (baca jawabannya: kadang benar tapi dirumuskan lain)

### pend_pns (sebaran)
- Pertanyaan: Pendidikan apa yang paling banyak dimiliki PNS?
- Diharapkan: (salah satu kata: S-1 | S1 DAN angka 21.225)
- Rencana LLM: `{"queries": [{"metric": "count", "group_by": ["pendidikan"], "filters": [{"column": "sumber", "op": "eq", "value": "pns"}], "order": "metric_desc", "limit": 1}], "search": null, "search_filter": null}`
- Jawaban:

> Berdasarkan data yang tersedia hanya tercatat S‑1 sebanyak 21.225 orang. Karena baris‑baris pendidikan lainnya tidak ditampilkan, tidak dapat ditentukan pendidikan mana yang paling banyak dimiliki oleh seluruh PNS. Data lengkap diperlukan untuk menjawab pertanyaan ini.

### lanjut_opd (percakapan)
- Pertanyaan: Berapa PNS di Dinas Kesehatan? → Kalau PPPK paruh waktu di dinas yang sama?
- Diharapkan: angka 2.554
- Rencana LLM: `{"queries": [{"metric": "count", "group_by": ["sumber"], "filters": [{"column": "opd_induk", "op": "eq", "value": "DINAS KESEHATAN"}, {"column": "sumber", "op": "eq", "value": "pppk_pw"}]}], "search": null, "search_filter": null}`
- Jawaban:

> Data untuk PPPK paruh waktu di Dinas Kesehatan tidak tersedia dalam konteks yang diberikan.


Waktu respons rata-rata: 15.6 detik per pertanyaan.
