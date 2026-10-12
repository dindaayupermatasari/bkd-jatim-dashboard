import React, { useState, useEffect, useMemo } from "react";
import {
  Search, ChevronLeft, ChevronRight, Plus, Minus, Users,
  Trash2, Sparkles, Eye, Download, Pencil, Briefcase, UserCheck,
  UserCog, AlertTriangle, Clock, Info, X, Circle, ArrowUpDown, FileText, Printer,
  CheckSquare, Square, ChevronDown, Link, Loader2,
} from "lucide-react";
import { fmt } from "../lib/constants";

// ─── Accent & Colors ──────────────────────────────────────────────────────────
const ACCENT   = "#ea580c";
const ACCENT_L = "#fff7ed";
const BLUE_C   = "#2563EB";
const GR       = "#16A34A";
const GY       = "#6B7280";
const RE       = "#DC2626";
const AM       = "#D97706";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Unit       { nama: string; abk: number; pns: number; pppk: number; }
interface JenjangRow { nama: string; abk: number; pns: number; pppk: number; units: Unit[]; }
interface FJabatan   {
  nama: string; kategori: "Teknis" | "Nakes";
  syncColor: "green" | "yellow" | null;
  jenjang: JenjangRow[];
}
interface PJabatan   {
  nama: string; kategori: "Teknis" | "Nakes";
  abk: number; pns: number; pppk: number;
  units: Unit[]; totalUnits?: number;
}
interface JenjangSummary { nama: string; abk: number; pns: number; pppk: number; units?: Unit[]; }
interface DrawerTarget {
  jabatan: string;
  jenjangLabel?: string;   // display-only: "Ahli Pertama" etc. when clicking a jenjang row
  kategori: string; abk: number; pns: number; pppk: number;
  jenjang?: JenjangSummary[];  // seluruh jenjang dalam jabatan (dipakai rule engine)
  units?: Unit[];              // sebaran unit untuk jenjang yang diklik
}
interface InstansiRow   { jabatan: string; rincian: number; instansi: string; }
interface BelumABKRow   { pd: string; jabatan: string; jenjang: string; pns: number; pppk: number; }
// Sisa masa berlaku ≤ threshold ini → "Segera berakhir"
const SEGERA_BERAKHIR_HARI = 180;
const INSIGHT_SEGERA_KEDALUWARSA_HARI = 30; // sisa masa berlaku rekomendasi AI Insight ≤ ini → indikator oranye
type DhStatus = "Berlaku" | "Segera berakhir" | "Kedaluwarsa";
interface DasarHukumRow {
  id: number;
  tipe: "Rekom" | "Persetujuan" | "Distribusi";
  jenis: "Jabatan Fungsional" | "Jabatan Pelaksana";
  nomor: string; penerbit: string; perihal: string;
  berlakuDari: string;   // ISO YYYY-MM-DD
  berlakuHingga: string; // ISO YYYY-MM-DD
  jabatan: number; jabatanNama: string[];
}
interface MappingBelumRow { nama: string; jumlah: number; usulan: string; persen: number; }
interface MappingSudahRow { nama: string; jumlah: number; }
interface InstansiRow2 { id: number; jabatan: string; rincian: number; instansi: string; dinas: string; terisi: boolean; }
interface OPDJabatanEntry { nama: string; abk: number; pns: number; pppk: number; isPelaksana: boolean; }
interface OPDEntry { nama: string; abk: number; pns: number; pppk: number; jabatan: OPDJabatanEntry[]; }

// ─── Fungsional Data ─────────────────────────────────────────────────────────
const FUNGSIONAL: FJabatan[] = [
  { nama: "Administrator Database Kependudukan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 4, pns: 1, pppk: 2, units: [
      { nama: "Dinas Perpustakaan dan Kearsipan", abk: 2, pns: 1, pppk: 1 },
      { nama: "Dinas Komunikasi dan Informatika", abk: 2, pns: 0, pppk: 1 },
    ]},
  ]},
  { nama: "Administrator Kesehatan", kategori: "Nakes", syncColor: "green", jenjang: [
    { nama: "Ahli Madya", abk: 15, pns: 6, pppk: 0, units: [
      { nama: "RSUD Dr. Saiful Anwar", abk: 8, pns: 3, pppk: 0 },
      { nama: "Dinas Kesehatan", abk: 7, pns: 3, pppk: 0 },
    ]},
    { nama: "Ahli Muda", abk: 50, pns: 18, pppk: 0, units: [
      { nama: "RSUD Dr. Saiful Anwar", abk: 25, pns: 9, pppk: 0 },
      { nama: "RSUD Daha Husada", abk: 15, pns: 5, pppk: 0 },
      { nama: "Dinas Kesehatan", abk: 10, pns: 4, pppk: 0 },
    ]},
    { nama: "Ahli Pertama", abk: 151, pns: 37, pppk: 73, units: [
      { nama: "RSUD Dr. Saiful Anwar", abk: 80, pns: 20, pppk: 40 },
      { nama: "RSUD Daha Husada", abk: 40, pns: 10, pppk: 20 },
      { nama: "Dinas Kesehatan", abk: 31, pns: 7, pppk: 13 },
    ]},
  ]},
  { nama: "Adyatama Kepariwisataan dan Ekonomi Kreatif", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 3,  pns: 3, pppk: 0, units: [{ nama: "Dinas Kebudayaan dan Pariwisata", abk: 3,  pns: 3, pppk: 0 }] },
    { nama: "Ahli Muda",    abk: 10, pns: 4, pppk: 0, units: [{ nama: "Dinas Kebudayaan dan Pariwisata", abk: 10, pns: 4, pppk: 0 }] },
    { nama: "Ahli Pertama", abk: 14, pns: 5, pppk: 4, units: [{ nama: "Dinas Kebudayaan dan Pariwisata", abk: 14, pns: 5, pppk: 4 }] },
  ]},
  { nama: "Analis Akuakultur", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 4,  pns: 0, pppk: 0, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 4,  pns: 0, pppk: 0 }] },
    { nama: "Ahli Muda",    abk: 8,  pns: 3, pppk: 0, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 8,  pns: 3, pppk: 0 }] },
    { nama: "Ahli Pertama", abk: 10, pns: 2, pppk: 2, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 10, pns: 2, pppk: 2 }] },
  ]},
  { nama: "Analis Hukum", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 1, pns: 2, pppk: 1, units: [{ nama: "Biro Administrasi Pembangunan", abk: 1, pns: 2, pppk: 1 }] },
  ]},
  { nama: "Analis Kebakaran", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 10, pns: 0, pppk: 0, units: [{ nama: "Satuan Polisi Pamong Praja", abk: 10, pns: 0, pppk: 0 }] },
  ]},
  { nama: "Analis Kebencanaan", kategori: "Teknis", syncColor: null, jenjang: [
    { nama: "Ahli Pertama", abk: 0, pns: 7, pppk: 2, units: [{ nama: "Badan Penanggulangan Bencana Daerah", abk: 0, pns: 7, pppk: 2 }] },
  ]},
  { nama: "Analis Kebijakan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 50,  pns: 22, pppk: 0,  units: [{ nama: "Biro Administrasi Pembangunan", abk: 30, pns: 12, pppk: 0 }, { nama: "Biro Administrasi Pimpinan", abk: 20, pns: 10, pppk: 0 }] },
    { nama: "Ahli Muda",    abk: 100, pns: 45, pppk: 10, units: [{ nama: "Badan Perencanaan Pembangunan Daerah", abk: 60, pns: 25, pppk: 5 }, { nama: "Biro Administrasi Pembangunan", abk: 40, pns: 20, pppk: 5 }] },
    { nama: "Ahli Pertama", abk: 103, pns: 45, pppk: 28, units: [{ nama: "Badan Perencanaan Pembangunan Daerah", abk: 50, pns: 20, pppk: 15 }, { nama: "Biro Administrasi Pembangunan", abk: 53, pns: 25, pppk: 13 }] },
  ]},
  { nama: "Analis Ketahanan Pangan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Muda",    abk: 15, pns: 2, pppk: 0, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 15, pns: 2, pppk: 0 }] },
    { nama: "Ahli Pertama", abk: 25, pns: 2, pppk: 4, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 25, pns: 2, pppk: 4 }] },
  ]},
  { nama: "Analis Pasar Hasil Perikanan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 38, pns: 3, pppk: 3, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 38, pns: 3, pppk: 3 }] },
  ]},
  { nama: "Analis Pasar Hasil Pertanian", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Muda",    abk: 5, pns: 3, pppk: 0, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 5, pns: 3, pppk: 0 }] },
    { nama: "Ahli Pertama", abk: 8, pns: 5, pppk: 3, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 8, pns: 5, pppk: 3 }] },
  ]},
  { nama: "Analis Pembiayaan Infrastruktur Pekerjaan Umum dan Perumahan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 38, pns: 8, pppk: 1, units: [{ nama: "Biro Administrasi Pembangunan", abk: 38, pns: 8, pppk: 1 }] },
  ]},
  { nama: "Analis Pengusahaan Jasa Kelautan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 25, pns: 2, pppk: 0, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 25, pns: 2, pppk: 0 }] },
  ]},
  { nama: "Analis Perdagangan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Pertama", abk: 16, pns: 7, pppk: 1, units: [{ nama: "Dinas Perindustrian dan Perdagangan", abk: 16, pns: 7, pppk: 1 }] },
  ]},
  { nama: "Analis Prasarana dan Sarana Pertanian", kategori: "Teknis", syncColor: "yellow", jenjang: [
    { nama: "Ahli Muda",    abk: 10, pns: 6, pppk: 0, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 10, pns: 6, pppk: 0 }] },
    { nama: "Ahli Pertama", abk: 15, pns: 9, pppk: 4, units: [{ nama: "Dinas Pertanian dan Ketahanan Pangan", abk: 15, pns: 9, pppk: 4 }] },
  ]},
  { nama: "Analis Sumber Daya Manusia Aparatur", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 60,  pns: 15, pppk: 0,  units: [{ nama: "Badan Kepegawaian Daerah", abk: 60,  pns: 15, pppk: 0  }] },
    { nama: "Ahli Muda",    abk: 130, pns: 40, pppk: 10, units: [{ nama: "Badan Kepegawaian Daerah", abk: 130, pns: 40, pppk: 10 }] },
    { nama: "Ahli Pertama", abk: 162, pns: 42, pppk: 31, units: [{ nama: "Badan Kepegawaian Daerah", abk: 162, pns: 42, pppk: 31 }] },
  ]},
  { nama: "Apoteker", kategori: "Nakes", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 50,  pns: 20, pppk: 0,  units: [{ nama: "RSUD Dr. Saiful Anwar", abk: 50,  pns: 20, pppk: 0  }] },
    { nama: "Ahli Muda",    abk: 130, pns: 55, pppk: 20, units: [{ nama: "RSUD Dr. Saiful Anwar", abk: 80,  pns: 35, pppk: 15 }, { nama: "RSUD Daha Husada", abk: 50, pns: 20, pppk: 5 }] },
    { nama: "Ahli Pertama", abk: 163, pns: 61, pppk: 57, units: [{ nama: "RSUD Dr. Saiful Anwar", abk: 100, pns: 35, pppk: 35 }, { nama: "Dinas Kesehatan", abk: 63, pns: 26, pppk: 22 }] },
  ]},
  { nama: "Arsiparis", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Ahli Madya",   abk: 80,  pns: 30,  pppk: 0,  units: [{ nama: "Dinas Perpustakaan dan Kearsipan", abk: 80,  pns: 30, pppk: 0 }] },
    { nama: "Ahli Muda",    abk: 200, pns: 90,  pppk: 20, units: [{ nama: "Dinas Perpustakaan dan Kearsipan", abk: 120, pns: 55, pppk: 15 }, { nama: "Sekretariat DPRD", abk: 80, pns: 35, pppk: 5 }] },
    { nama: "Ahli Pertama", abk: 288, pns: 132, pppk: 63, units: [{ nama: "Dinas Perpustakaan dan Kearsipan", abk: 200, pns: 90, pppk: 45 }, { nama: "Sekretariat DPRD", abk: 88, pns: 42, pppk: 18 }] },
  ]},
  { nama: "Asisten Apoteker", kategori: "Nakes", syncColor: "green", jenjang: [
    { nama: "Mahir",    abk: 300, pns: 80, pppk: 150, units: [{ nama: "Dinas Kesehatan",       abk: 300, pns: 80, pppk: 150 }] },
    { nama: "Terampil", abk: 348, pns: 89, pppk: 204, units: [{ nama: "RSUD Dr. Saiful Anwar", abk: 348, pns: 89, pppk: 204 }] },
    { nama: "Pemula",   abk: 200, pns: 20, pppk: 50,  units: [{ nama: "Dinas Kesehatan",       abk: 200, pns: 20, pppk: 50  }] },
  ]},
  { nama: "Asisten Pembina Mutu Hasil Kelautan dan Perikanan", kategori: "Teknis", syncColor: "green", jenjang: [
    { nama: "Terampil", abk: 38, pns: 3, pppk: 3, units: [{ nama: "Dinas Kelautan dan Perikanan", abk: 38, pns: 3, pppk: 3 }] },
  ]},
];

// ─── Pelaksana Data ───────────────────────────────────────────────────────────
const PELAKSANA: PJabatan[] = [
  { nama: "Dokumentalis Hukum", kategori: "Teknis", abk: 5, pns: 2, pppk: 0, totalUnits: 2, units: [
    { nama: "Satuan Polisi Pamong Praja", abk: 4, pns: 2, pppk: 0 },
    { nama: "Sekretariat DPRD",           abk: 1, pns: 0, pppk: 0 },
  ]},
  { nama: "Fasilitator Pemerintahan", kategori: "Teknis", abk: 154, pns: 0, pppk: 0, totalUnits: 43, units: [
    { nama: "Badan Kepegawaian Daerah",              abk: 4, pns: 0, pppk: 0 },
    { nama: "Badan Kesatuan Bangsa dan Politik",      abk: 3, pns: 0, pppk: 0 },
    { nama: "Badan Koordinasi Wilayah Bojonegoro",    abk: 2, pns: 0, pppk: 0 },
    { nama: "Badan Koordinasi Wilayah Pamekasan",     abk: 2, pns: 0, pppk: 0 },
    { nama: "Badan Pengembangan Sumber Daya Manusia", abk: 1, pns: 0, pppk: 0 },
    { nama: "Badan Penghubung Daerah Provinsi",       abk: 1, pns: 0, pppk: 0 },
    { nama: "Badan Perencanaan Pembangunan Daerah",   abk: 9, pns: 0, pppk: 0 },
    { nama: "Biro Administrasi Pembangunan",          abk: 6, pns: 0, pppk: 0 },
    { nama: "Biro Administrasi Pimpinan",             abk: 1, pns: 0, pppk: 0 },
    { nama: "Biro Kesejahteraan Rakyat",              abk: 1, pns: 0, pppk: 0 },
  ]},
  { nama: "Fasilitator Perdagangan", kategori: "Teknis", abk: 9, pns: 0, pppk: 0, totalUnits: 3, units: [
    { nama: "Badan Penghubung Daerah Provinsi",                       abk: 1, pns: 0, pppk: 0 },
    { nama: "Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu", abk: 5, pns: 0, pppk: 0 },
    { nama: "Dinas Perindustrian dan Perdagangan",                    abk: 3, pns: 0, pppk: 0 },
  ]},
  { nama: "Filolog", kategori: "Teknis", abk: 0, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Perpustakaan dan Kearsipan", abk: 0, pns: 0, pppk: 0 },
  ]},
  { nama: "Jurnalis", kategori: "Teknis", abk: 4, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Komunikasi dan Informatika", abk: 4, pns: 0, pppk: 0 },
  ]},
  { nama: "Konselor SDM", kategori: "Teknis", abk: 19, pns: 18, pppk: 0, totalUnits: 10, units: [
    { nama: "Badan Kepegawaian Daerah",                                         abk: 5, pns: 5, pppk: 0 },
    { nama: "Biro Administrasi Pembangunan",                                    abk: 2, pns: 2, pppk: 0 },
    { nama: "Biro Kesejahteraan Rakyat",                                        abk: 1, pns: 1, pppk: 0 },
    { nama: "Dinas Kelautan dan Perikanan",                                     abk: 1, pns: 1, pppk: 0 },
    { nama: "Dinas Pemberdayaan Perempuan, Perlindungan Anak dan Kependudukan", abk: 1, pns: 1, pppk: 0 },
    { nama: "Dinas Pertanian dan Ketahanan Pangan",                             abk: 1, pns: 1, pppk: 0 },
    { nama: "Dinas Sosial",                                                     abk: 3, pns: 3, pppk: 0 },
    { nama: "RSUD Daha Husada",                                                 abk: 1, pns: 1, pppk: 0 },
    { nama: "RSUD Dr. Saiful Anwar",                                            abk: 3, pns: 1, pppk: 0 },
    { nama: "RSUD Dungus",                                                      abk: 1, pns: 2, pppk: 0 },
  ]},
  { nama: "Kurator", kategori: "Teknis", abk: 2, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Kebudayaan dan Pariwisata", abk: 2, pns: 0, pppk: 0 },
  ]},
  { nama: "Operator Alat Berat", kategori: "Teknis", abk: 25, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Badan Penanggulangan Bencana Daerah", abk: 25, pns: 0, pppk: 0 },
  ]},
  { nama: "Operator Layanan Kesehatan", kategori: "Teknis", abk: 147, pns: 32, pppk: 2, totalUnits: 2, units: [
    { nama: "RSUD Dr. Saiful Anwar", abk: 100, pns: 22, pppk: 1 },
    { nama: "RSUD Daha Husada",      abk: 47,  pns: 10, pppk: 1 },
  ]},
  { nama: "Operator Layanan Operasional", kategori: "Teknis", abk: 1978, pns: 1076, pppk: 9337, totalUnits: 38, units: [
    { nama: "Dinas Pendidikan",      abk: 1200, pns: 650, pppk: 5500 },
    { nama: "Dinas Kesehatan",       abk: 500,  pns: 250, pppk: 2500 },
    { nama: "RSUD Dr. Saiful Anwar", abk: 278,  pns: 176, pppk: 1337 },
  ]},
  { nama: "Pamong Pemerintahan", kategori: "Teknis", abk: 26, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Badan Koordinasi Wilayah Bojonegoro", abk: 26, pns: 0, pppk: 0 },
  ]},
  { nama: "Penata Bangunan Gedung Dan Permukiman", kategori: "Teknis", abk: 16, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Biro Administrasi Pembangunan", abk: 16, pns: 0, pppk: 0 },
  ]},
  { nama: "Penata Kelola Hukum dan Perundang-undangan", kategori: "Teknis", abk: 16, pns: 5, pppk: 0, totalUnits: 1, units: [
    { nama: "Biro Administrasi Pembangunan", abk: 16, pns: 5, pppk: 0 },
  ]},
  { nama: "Penata Kelola Kelautan dan Perikanan", kategori: "Teknis", abk: 38, pns: 85, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Kelautan dan Perikanan", abk: 38, pns: 85, pppk: 0 },
  ]},
  { nama: "Penata Kelola Layanan Kesehatan", kategori: "Teknis", abk: 21, pns: 14, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Kesehatan", abk: 21, pns: 14, pppk: 0 },
  ]},
  { nama: "Penata Kelola Pemberdayaan Perempuan dan Perlindungan Anak", kategori: "Teknis", abk: 11, pns: 3, pppk: 0, totalUnits: 1, units: [
    { nama: "Dinas Pemberdayaan Perempuan, Perlindungan Anak dan Kependudukan", abk: 11, pns: 3, pppk: 0 },
  ]},
  { nama: "Penata Kelola Pemerintahan", kategori: "Teknis", abk: 11, pns: 0, pppk: 0, totalUnits: 1, units: [
    { nama: "Biro Administrasi Pimpinan", abk: 11, pns: 0, pppk: 0 },
  ]},
  { nama: "Penata Kelola Pertambangan", kategori: "Teknis", abk: 3, pns: 3, pppk: 0, totalUnits: 1, units: [
    { nama: "Biro Administrasi Pembangunan", abk: 3, pns: 3, pppk: 0 },
  ]},
  { nama: "Penata Kelola Sistem dan Teknologi Informasi", kategori: "Teknis", abk: 180, pns: 243, pppk: 0, totalUnits: 2, units: [
    { nama: "Dinas Komunikasi dan Informatika", abk: 100, pns: 150, pppk: 0 },
    { nama: "Badan Kepegawaian Daerah",         abk: 80,  pns: 93,  pppk: 0 },
  ]},
  { nama: "Penata Kelola Usaha Ketenagalistrikan", kategori: "Teknis", abk: 3, pns: 3, pppk: 0, totalUnits: 1, units: [
    { nama: "Biro Administrasi Pembangunan", abk: 3, pns: 3, pppk: 0 },
  ]},
];

// ─── Instansi Pembina Data ────────────────────────────────────────────────────
const INSTANSI_DATA: InstansiRow[] = [
  { jabatan: "(Dokter)Dokter Spesialis Mata",                                                    rincian: 45, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Mikrobiologi Klinik",                                     rincian: 27, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Neurologi",                                               rincian: 44, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Obstetri dan Ginekologi",                                 rincian: 45, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Onkologi Radiasi",                                        rincian: 17, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Orthopaedi dan Traumatologi",                             rincian: 43, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Parasitologi Klinik",                                     rincian: 8,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Patologi Anatomi",                                        rincian: 34, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Patologi Klinik",                                         rincian: 50, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Penyakit Dalam",                                          rincian: 48, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Pulmonologi dan Kedokteran Respirasi (Paru)",             rincian: 44, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Radiologi",                                               rincian: 46, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Telinga Hidung Tenggorok - Bedah Kepala dan Leher",       rincian: 40, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Spesialis Urologi",                                                 rincian: 28, instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Anak-Alergi Imunologi",                              rincian: 4,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Anak-Emergensi dan Rawat Intensif Anak (ERIA)",      rincian: 8,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Anak-Endokrinologi",                                 rincian: 4,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Anak-Gastro-Hepatologi",                             rincian: 4,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Bedah-Bedah Kepala Leher",                           rincian: 3,  instansi: "Kementerian Kesehatan" },
  { jabatan: "(Dokter)Dokter Sub Spesialis Bedah-Bedah Onkologi",                               rincian: 22, instansi: "Kementerian Kesehatan" },
];

// ─── Belum Ada ABK Data ───────────────────────────────────────────────────────
const BELUM_ABK: BelumABKRow[] = [
  { pd: "BADAN KEPEGAWAIAN DAERAH",                  jabatan: "Penata Laksana Barang",                          jenjang: "—",             pns: 1, pppk: 0 },
  { pd: "BADAN KEPEGAWAIAN DAERAH",                  jabatan: "Penata Laksana Sumber Daya Air",                 jenjang: "Pemula",        pns: 0, pppk: 1 },
  { pd: "BADAN KEPEGAWAIAN DAERAH",                  jabatan: "Pranata Hubungan Masyarakat",                    jenjang: "—",             pns: 1, pppk: 0 },
  { pd: "BADAN KESATUAN BANGSA DAN POLITIK",         jabatan: "Penata Laksana Barang",                          jenjang: "Terampil",      pns: 1, pppk: 0 },
  { pd: "BADAN KOORDINASI WILAYAH BOJONEGORO",       jabatan: "Analis Kebijakan",                               jenjang: "Ahli Pertama",  pns: 0, pppk: 4 },
  { pd: "BADAN KOORDINASI WILAYAH MADIUN",           jabatan: "Analis Kebijakan",                               jenjang: "Ahli Pertama",  pns: 0, pppk: 1 },
  { pd: "BADAN KOORDINASI WILAYAH MALANG",           jabatan: "Analis Kebijakan",                               jenjang: "Ahli Pertama",  pns: 0, pppk: 1 },
  { pd: "BADAN KOORDINASI WILAYAH MALANG",           jabatan: "Pranata Hubungan Masyarakat",                    jenjang: "Ahli Pertama",  pns: 0, pppk: 1 },
  { pd: "BADAN KOORDINASI WILAYAH MALANG",           jabatan: "Pranata Hubungan Masyarakat",                    jenjang: "Terampil",      pns: 1, pppk: 0 },
  { pd: "BADAN KOORDINASI WILAYAH PAMEKASAN",        jabatan: "Analis Kebijakan",                               jenjang: "Ahli Pertama",  pns: 0, pppk: 2 },
  { pd: "BADAN KOORDINASI WILAYAH PAMEKASAN",        jabatan: "Pranata Komputer",                               jenjang: "Ahli Pertama",  pns: 0, pppk: 1 },
  { pd: "BADAN PENANGGULANGAN BENCANA DAERAH",       jabatan: "Analis Kebakaran",                               jenjang: "Ahli Pertama",  pns: 1, pppk: 0 },
  { pd: "BADAN PENANGGULANGAN BENCANA DAERAH",       jabatan: "Penata Penanggulangan Bencana",                  jenjang: "Ahli Pertama",  pns: 0, pppk: 3 },
  { pd: "BADAN PENANGGULANGAN BENCANA DAERAH",       jabatan: "Pranata Pencarian dan Pertolongan",              jenjang: "Pemula",        pns: 0, pppk: 25 },
  { pd: "BADAN PENDAPATAN DAERAH",                   jabatan: "Analis Keuangan Pemerintah Pusat dan Daerah",    jenjang: "Ahli Muda",     pns: 1, pppk: 0 },
  { pd: "BADAN PENDAPATAN DAERAH",                   jabatan: "Auditor",                                        jenjang: "—",             pns: 1, pppk: 0 },
  { pd: "BADAN PENDAPATAN DAERAH",                   jabatan: "Pranata Hubungan Masyarakat",                    jenjang: "Terampil",      pns: 7, pppk: 0 },
  { pd: "BADAN PENDAPATAN DAERAH",                   jabatan: "Pranata Sumber Daya Manusia Aparatur",           jenjang: "Terampil",      pns: 0, pppk: 1 },
  { pd: "BADAN PENGELOLA KEUANGAN DAN ASET DAERAH",  jabatan: "Analis Keuangan Pemerintah Pusat dan Daerah",    jenjang: "Ahli Muda",     pns: 4, pppk: 0 },
  { pd: "BADAN PENGELOLA KEUANGAN DAN ASET DAERAH",  jabatan: "Analis Keuangan Pemerintah Pusat dan Daerah",    jenjang: "Ahli Pertama",  pns: 6, pppk: 0 },
];

// ─── Dasar Hukum Data ─────────────────────────────────────────────────────────
const DASAR_HUKUM_INIT: DasarHukumRow[] = [
  { id: 1,  tipe: "Rekom",       jenis: "Jabatan Fungsional", nomor: "B/BA.00.00/152/2026",         penerbit: "BKN Pusat",           perihal: "Rekomendasi Formasi JF Administrator Kesehatan",               berlakuDari: "2026-05-12", berlakuHingga: "2031-05-12", jabatan: 1,  jabatanNama: ["Administrator Kesehatan"] },
  { id: 2,  tipe: "Persetujuan", jenis: "Jabatan Fungsional", nomor: "B/128/M.SM.01.00/2026",       penerbit: "Kementerian PAN-RB",  perihal: "Persetujuan Formasi JF Analis Kebijakan Jatim",                berlakuDari: "2026-01-12", berlakuHingga: "2031-01-12", jabatan: 5,  jabatanNama: ["Analis Kebijakan"] },
  { id: 3,  tipe: "Distribusi",  jenis: "Jabatan Fungsional", nomor: "800.1.2.1/8365/204.2/2025",   penerbit: "Gubernur Jawa Timur", perihal: "Distribusi Formasi JF Arsiparis ke Perangkat Daerah",          berlakuDari: "2025-12-04", berlakuHingga: "2030-12-04", jabatan: 1,  jabatanNama: ["Arsiparis"] },
  { id: 4,  tipe: "Rekom",       jenis: "Jabatan Fungsional", nomor: "B-3931/BKN.00/KP.12.01/2025", penerbit: "BKN Pusat",           perihal: "Rekomendasi Formasi JF Asisten Apoteker",                     berlakuDari: "2025-11-19", berlakuHingga: "2030-11-19", jabatan: 1,  jabatanNama: ["Asisten Apoteker"] },
  { id: 5,  tipe: "Persetujuan", jenis: "Jabatan Fungsional", nomor: "B/214/M.SM.01.00/2025",       penerbit: "Kementerian PAN-RB",  perihal: "Persetujuan Formasi JF Apoteker dan Asisten Apoteker",        berlakuDari: "2025-10-03", berlakuHingga: "2030-10-03", jabatan: 8,  jabatanNama: ["Apoteker", "Asisten Apoteker"] },
  { id: 6,  tipe: "Distribusi",  jenis: "Jabatan Pelaksana",  nomor: "800.1.2.1/5120/204.2/2025",   penerbit: "Gubernur Jawa Timur", perihal: "Distribusi Formasi Operator Layanan Operasional",              berlakuDari: "2025-08-12", berlakuHingga: "2030-08-12", jabatan: 3,  jabatanNama: ["Operator Layanan Operasional"] },
  { id: 7,  tipe: "Rekom",       jenis: "Jabatan Fungsional", nomor: "B/BA.00.00/087/2025",         penerbit: "BKN Pusat",           perihal: "Rekomendasi Formasi JF Analis Sumber Daya Manusia Aparatur",  berlakuDari: "2025-07-15", berlakuHingga: "2030-07-15", jabatan: 1,  jabatanNama: ["Analis Sumber Daya Manusia Aparatur"] },
  { id: 8,  tipe: "Persetujuan", jenis: "Jabatan Fungsional", nomor: "B/097/M.SM.01.00/2025",       penerbit: "Kementerian PAN-RB",  perihal: "Persetujuan Formasi JF Arsiparis dan Adyatama Kepariwisataan", berlakuDari: "2025-06-02", berlakuHingga: "2030-06-02", jabatan: 12, jabatanNama: ["Arsiparis", "Adyatama Kepariwisataan dan Ekonomi Kreatif"] },
  // Segera berakhir — berlakuHingga ≤ SEGERA_BERAKHIR_HARI dari hari ini
  { id: 9,  tipe: "Rekom",       jenis: "Jabatan Fungsional", nomor: "B/BA.00.00/241/2026",         penerbit: "BKN Pusat",           perihal: "Rekomendasi Formasi JF Analis Ketahanan Pangan Jawa Timur",   berlakuDari: "2024-12-15", berlakuHingga: "2026-12-15", jabatan: 2,  jabatanNama: ["Analis Ketahanan Pangan"] },
  { id: 10, tipe: "Distribusi",  jenis: "Jabatan Fungsional", nomor: "800.1.2.1/0034/204.2/2024",   penerbit: "Gubernur Jawa Timur", perihal: "Distribusi Formasi JF Analis Kebakaran ke Perangkat Daerah",  berlakuDari: "2024-01-31", berlakuHingga: "2027-01-31", jabatan: 1,  jabatanNama: ["Analis Kebakaran"] },
  // Kedaluwarsa — sudah melewati masa berlaku
  { id: 11, tipe: "Persetujuan", jenis: "Jabatan Fungsional", nomor: "B/302/M.SM.01.00/2021",       penerbit: "Kementerian PAN-RB",  perihal: "Persetujuan Formasi JF Analis Hukum Provinsi Jawa Timur",     berlakuDari: "2021-06-01", berlakuHingga: "2026-06-01", jabatan: 4,  jabatanNama: ["Analis Hukum"] },
];

// ─── Mapping & Instansi Data ──────────────────────────────────────────────────
const MAPPING_UNIT_BELUM: MappingBelumRow[] = [
  { nama: "Dinas Kesehatan Prov. Jawa Timur",  jumlah: 312, usulan: "Dinas Kesehatan",                  persen: 94 },
  { nama: "BKD Prov. Jatim",                   jumlah: 78,  usulan: "Badan Kepegawaian Daerah",          persen: 87 },
  { nama: "Dinas Perikanan",                   jumlah: 33,  usulan: "Dinas Kelautan dan Perikanan",      persen: 68 },
  { nama: "BPPD Jatim",                        jumlah: 44,  usulan: "Badan Pendapatan Daerah",           persen: 72 },
  { nama: "RS Dr. Soetomo",                    jumlah: 21,  usulan: "RSUD Dr. Saiful Anwar",             persen: 61 },
];
const MAPPING_UNIT_SUDAH: MappingSudahRow[] = [
  { nama: "Badan Perencanaan Pembangunan Daerah", jumlah: 89  },
  { nama: "Biro Administrasi Pembangunan",         jumlah: 120 },
  { nama: "RSUD Dr. Saiful Anwar",                 jumlah: 445 },
  { nama: "Dinas Komunikasi dan Informatika",       jumlah: 67  },
];
const MAPPING_JAB_BELUM: MappingBelumRow[] = [
  { nama: "Perencana Ahli Muda",    jumlah: 45,  usulan: "Analis Kebijakan",               persen: 81 },
  { nama: "Pembina Tingkat I",      jumlah: 18,  usulan: "Jabatan Fungsional Tertentu",    persen: 61 },
  { nama: "Staff",                  jumlah: 130, usulan: "Operator Layanan Operasional",   persen: 79 },
  { nama: "Kepala Sub Bagian",      jumlah: 24,  usulan: "Koordinator",                    persen: 57 },
];
const MAPPING_JAB_SUDAH: MappingSudahRow[] = [
  { nama: "Perencana Ahli Pertama",                              jumlah: 65 },
  { nama: "Penelaah Teknis Kebijakan",                           jumlah: 64 },
  { nama: "Pengadministrasi Perkantoran",                        jumlah: 64 },
  { nama: "Arsiparis Terampil",                                  jumlah: 64 },
  { nama: "Penata Layanan Operasional",                          jumlah: 61 },
  { nama: "Analis Sumber Daya Manusia Aparatur Ahli Pertama",    jumlah: 49 },
];
const INSTANSI2_INIT: InstansiRow2[] = [
  { id: 1,  jabatan: "(Dokter) Dokter Spesialis Mata",              rincian: 45, instansi: "Kementerian Kesehatan", dinas: "", terisi: false },
  { id: 2,  jabatan: "(Dokter) Dokter Spesialis Mikrobiologi Klinik", rincian: 27, instansi: "",                  dinas: "", terisi: false },
  { id: 3,  jabatan: "(Dokter) Dokter Spesialis Neurologi",          rincian: 44, instansi: "Kementerian Kesehatan", dinas: "", terisi: false },
  { id: 4,  jabatan: "Administrator Database Kependudukan",   rincian: 4,   instansi: "Kementerian Dalam Negeri", dinas: "DINAS PEMBERDAYAAN PEREMPUAN, PERLINDUNGAN ANAK DAN KEPENDUDUKAN", terisi: true },
  { id: 5,  jabatan: "Administrator Kesehatan",               rincian: 216, instansi: "Kementerian Kesehatan",    dinas: "DINAS KESEHATAN", terisi: true },
  { id: 6,  jabatan: "Analis Kebencanaan",                    rincian: 9,   instansi: "Badan Nasional Penanggulangan Bencana", dinas: "BADAN PENANGGULANGAN BENCANA DAERAH", terisi: true },
];

// ─── OPD List ─────────────────────────────────────────────────────────────────
const OPD_LIST = [
  "Badan Kepegawaian Daerah", "Badan Kesatuan Bangsa dan Politik",
  "Badan Koordinasi Wilayah Bojonegoro", "Badan Koordinasi Wilayah Jember",
  "Badan Koordinasi Wilayah Madiun", "Badan Koordinasi Wilayah Malang",
  "Badan Koordinasi Wilayah Pamekasan",
  "Badan Penanggulangan Bencana Daerah", "Badan Pendapatan Daerah",
  "Badan Pengembangan Sumber Daya Manusia",
  "Badan Pengelola Keuangan dan Aset Daerah", "Badan Penghubung Daerah Provinsi",
  "Badan Perencanaan Pembangunan Daerah",
  "Biro Administrasi Pembangunan", "Biro Administrasi Pimpinan", "Biro Kesejahteraan Rakyat",
  "Dinas Kebudayaan dan Pariwisata", "Dinas Kelautan dan Perikanan",
  "Dinas Komunikasi dan Informatika", "Dinas Pendidikan",
  "Dinas Pemberdayaan Perempuan, Perlindungan Anak dan Kependudukan",
  "Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu",
  "Dinas Perindustrian dan Perdagangan", "Dinas Perpustakaan dan Kearsipan",
  "Dinas Pertanian dan Ketahanan Pangan", "Dinas Sosial",
  "RSUD Daha Husada", "RSUD Dr. Saiful Anwar", "RSUD Dungus",
  "Satuan Polisi Pamong Praja", "Sekretariat DPRD",
];

// ─── OPD Table (deterministic, sorted) ───────────────────────────────────────
const OPD_TABLE: OPDEntry[] = [...OPD_LIST]
  .sort((a, b) => a.localeCompare(b, "id"))
  .map((nama, i) => {
    const s   = (i + 1) * 7;
    const abk = (s * 53) % 480 + 30;
    const pns = Math.floor(abk * (0.30 + (s % 5) * 0.04));
    const pppk= Math.floor(abk * (0.10 + (s % 3) * 0.05));
    const jabatan: OPDJabatanEntry[] = [
      ...FUNGSIONAL
        .filter(j => j.jenjang.some(jen => jen.units.some(u => u.nama === nama)))
        .map(j => {
          const us = j.jenjang.flatMap(jen => jen.units.filter(u => u.nama === nama));
          return {
            nama: j.nama,
            abk: us.reduce((acc, u) => acc + u.abk, 0),
            pns: us.reduce((acc, u) => acc + u.pns, 0),
            pppk: us.reduce((acc, u) => acc + u.pppk, 0),
            isPelaksana: false,
          };
        }),
      ...PELAKSANA
        .filter(j => j.units.some(u => u.nama === nama))
        .map(j => {
          const u = j.units.find(u => u.nama === nama)!;
          return { nama: j.nama, abk: u.abk, pns: u.pns, pppk: u.pppk, isPelaksana: true };
        }),
    ];
    return { nama, abk, pns, pppk, jabatan };
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lowFmt(v: number) { return v.toString(); }
function lowColor(v: number) { return v < 0 ? BLUE_C : v > 0 ? RE : GY; }
function fAbk(j: FJabatan)  { return j.jenjang.reduce((s, x) => s + x.abk,  0); }
function fPns(j: FJabatan)  { return j.jenjang.reduce((s, x) => s + x.pns,  0); }
function fPppk(j: FJabatan) { return j.jenjang.reduce((s, x) => s + x.pppk, 0); }

// ─── Small Components ─────────────────────────────────────────────────────────
function KatBadge({ k }: { k: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
      {k}
    </span>
  );
}

function PelBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 ml-1">
      Pelaksana
    </span>
  );
}

function TipeBadge({ t }: { t: "Rekom" | "Persetujuan" | "Distribusi" }) {
  const s = {
    Rekom:       "bg-blue-50 text-blue-700 border border-blue-200",
    Persetujuan: "bg-green-50 text-green-700 border border-green-200",
    Distribusi:  "bg-purple-50 text-purple-700 border border-purple-200",
  }[t];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s}`}>{t}</span>;
}

function EmptySlot() {
  return <div className="w-7 h-7 flex-shrink-0" />;
}

function DocBtn({ count, variant = "green", onClick }: {
  count: number; variant?: "green" | "orange"; onClick: () => void;
}) {
  const [tip, setTip] = useState(false);
  const cls = variant === "green"
    ? "border-green-300 text-green-600 hover:bg-green-50"
    : "border-orange-300 text-orange-500 hover:bg-orange-50";
  return (
    <div className="relative flex-shrink-0" style={{ width: 28 }}>
      <button
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        onClick={onClick}
        className={`w-7 h-7 rounded border bg-white flex items-center justify-center transition-colors ${cls}`}>
        <FileText size={12} />
      </button>
      {tip && (
        <div style={{
          position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#111827", color: "white", fontSize: 10, padding: "2px 8px",
          borderRadius: 4, whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none",
        }}>
          {count} berlaku
        </div>
      )}
    </div>
  );
}

type BtnVariant = "gray" | "orange" | "green" | "yellow" | "red";
function ABtn({ icon: Icon, variant = "gray", title, onClick }: {
  icon: React.ComponentType<{ size?: number }>;
  variant?: BtnVariant; title?: string; onClick?: () => void;
}) {
  const cls: Record<BtnVariant, string> = {
    gray:   "border-gray-200 text-gray-400 hover:bg-gray-50",
    orange: "border-orange-300 text-orange-500 hover:bg-orange-50",
    green:  "border-green-300 text-green-600 hover:bg-green-50",
    yellow: "border-yellow-300 text-yellow-500 hover:bg-yellow-50",
    red:    "border-red-200 text-red-400 hover:bg-red-50",
  };
  return (
    <button title={title} onClick={onClick}
      className={`w-7 h-7 rounded border flex items-center justify-center transition-colors flex-shrink-0 bg-white ${cls[variant]}`}>
      <Icon size={12} />
    </button>
  );
}

function PaginationBar({ total, page, onPage, perPage = 20, unit = "baris" }: {
  total: number; page: number; onPage: (p: number) => void; perPage?: number; unit?: string;
}) {
  const tp = Math.max(1, Math.ceil(total / perPage));
  const nums = useMemo(() => {
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "…", tp];
    if (page >= tp - 3) return [1, "…", tp - 4, tp - 3, tp - 2, tp - 1, tp];
    return [1, "…", page - 1, page, page + 1, "…", tp];
  }, [tp, page]);
  return (
    <div className="flex items-center gap-1.5 justify-end py-2.5 px-4 border-t border-gray-100">
      <span className="text-xs text-gray-400 mr-2">{fmt(total)} {unit}</span>
      <button disabled={page === 1} onClick={() => onPage(Math.max(1, page - 1))}
        className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors">
        <ChevronLeft size={11} />
      </button>
      {nums.map((n, i) =>
        typeof n === "string" ? (
          <span key={`e${i}`} className="text-xs text-gray-400 w-5 text-center">{n}</span>
        ) : (
          <button key={n} onClick={() => onPage(n)}
            className="w-6 h-6 rounded border text-xs font-medium transition-all"
            style={page === n
              ? { borderColor: ACCENT, color: ACCENT, backgroundColor: "white" }
              : { borderColor: "#E5E7EB", color: "#6B7280" }}>
            {n}
          </button>
        )
      )}
      <button disabled={page === tp} onClick={() => onPage(Math.min(tp, page + 1))}
        className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 disabled:opacity-30 transition-colors">
        <ChevronRight size={11} />
      </button>
    </div>
  );
}

// ─── Dasar Hukum Helpers ─────────────────────────────────────────────────────
function hitungDhStatus(berlakuHingga: string): DhStatus {
  const today = new Date("2026-09-29");
  const end   = new Date(berlakuHingga);
  const diff  = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "Kedaluwarsa";
  if (diff <= SEGERA_BERAKHIR_HARI) return "Segera berakhir";
  return "Berlaku";
}

function fmtTgl(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const mo = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${d} ${mo[m - 1]} ${y}`;
}

const DH_SC: Record<DhStatus, { dot: string; text: string; bg: string }> = {
  "Berlaku":         { dot: "#22C55E", text: "#16A34A", bg: "#F0FDF4" },
  "Segera berakhir": { dot: "#F97316", text: "#C2410C", bg: "#FFF7ED" },
  "Kedaluwarsa":     { dot: "#EF4444", text: "#DC2626", bg: "#FEF2F2" },
};

function DhStatusDot({ status }: { status: DhStatus }) {
  const c = DH_SC[status];
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {status}
    </span>
  );
}

// ─── PDF Preview Modal ────────────────────────────────────────────────────────
function PdfPreviewModal({ row, onClose }: { row: DasarHukumRow; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[660px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-800">Pratinjau — {row.nomor}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={14} />
          </button>
        </div>
        {/* PDF toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-800">
          {[
            { title: "Unduh",  icon: <Download size={13} />,  action: () => {} },
            { title: "Cetak",  icon: <Printer size={13} />,   action: () => window.print() },
          ].map(b => (
            <button key={b.title} title={b.title} onClick={b.action}
              className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white rounded hover:bg-gray-700 transition-colors">
              {b.icon}
            </button>
          ))}
          <span className="text-gray-600 text-lg font-bold leading-none ml-1 hover:text-gray-400 cursor-pointer select-none">⋯</span>
        </div>
        {/* Document */}
        <div className="flex-1 overflow-auto bg-gray-200 p-6">
          <div className="bg-white shadow-md mx-auto" style={{ width: 560, minHeight: 740, padding: "48px 56px", fontFamily: "Georgia, serif" }}>
            <div style={{ borderBottom: "3px solid #000", paddingBottom: 12, marginBottom: 16, textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1, marginBottom: 4 }}>ARSIP NASIONAL REPUBLIK INDONESIA</p>
              <p style={{ fontSize: 10, color: "#666" }}>Jalan Ampera Raya Nomor 7, Jakarta 12560 · Telp. (021) 7805851 · www.anri.go.id</p>
            </div>
            <div style={{ fontSize: 11, marginBottom: 20, lineHeight: 1.9 }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  {[["Nomor", row.nomor], ["Sifat", "BIASA"], ["Lampiran", "Satu lembar"],
                    ["Hal", "Rekomendasi Kebutuhan Jabatan Fungsional Arsiparis\n di Lingkungan Provinsi Jawa Timur"]
                  ].map(([k, v]) => (
                    <tr key={k}><td style={{ paddingRight: 16, verticalAlign: "top" }}>{k}</td>
                      <td style={{ verticalAlign: "top", whiteSpace: "pre-line" }}>: {v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, textAlign: "right", marginBottom: 20 }}>Jakarta, 12 Mei 2026</p>
            <p style={{ fontSize: 11, marginBottom: 16 }}>Yth. Sekretaris Daerah Provinsi Jawa Timur<br />di Surabaya</p>
            <div style={{ fontSize: 11, lineHeight: 1.9 }}>
              <p style={{ marginBottom: 12 }}>
                Dalam rangka pelaksanaan pengisian kebutuhan Jabatan Fungsional di lingkungan Pemerintah Provinsi Jawa Timur, bersama ini kami sampaikan rekomendasi atas usulan kebutuhan yang telah diajukan sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.
              </p>
              <p style={{ marginBottom: 12 }}>
                Berdasarkan hasil analisis dan verifikasi data yang telah dilakukan, rekomendasi ini diberikan dengan memperhatikan aspek beban kerja, distribusi pegawai, serta keseimbangan antara kebutuhan organisasi dan ketersediaan sumber daya manusia aparatur.
              </p>
              <p>Demikian disampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.</p>
            </div>
            <div style={{ marginTop: 48, fontSize: 11 }}>
              <p style={{ marginBottom: 4 }}>Deputi Bidang Tata Kelola Kearsipan,</p>
              <div style={{ height: 64 }} />
              <p style={{ fontWeight: 700 }}>Dr. Drs. Syamsul Huda, M.Si.</p>
              <p>NIP 196608251992031001</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dasar Hukum Form Modal (Upload & Edit) ───────────────────────────────────
function DhFormModal({ mode, row, autoTipe, autoJabatan, onSave, onClose }: {
  mode: "upload" | "edit";
  row?: DasarHukumRow; autoTipe?: string; autoJabatan?: string;
  onSave: (r: DasarHukumRow) => void; onClose: () => void;
}) {
  const [tipe,     setTipe]     = useState(autoTipe ?? row?.tipe ?? "");
  const [jenis,    setJenis]    = useState<"Jabatan Fungsional" | "Jabatan Pelaksana">(row?.jenis ?? "Jabatan Fungsional");
  const [penerbit, setPenerbit] = useState(row?.penerbit ?? "");
  const [nomor,    setNomor]    = useState(row?.nomor ?? "");
  const [dari,     setDari]     = useState(row?.berlakuDari ?? "");
  const [hingga,   setHingga]   = useState(row?.berlakuHingga ?? "");
  const [perihal,  setPerihal]  = useState(row?.perihal ?? "");
  const [jabTags,  setJabTags]  = useState<string[]>(autoJabatan ? [autoJabatan] : (row?.jabatanNama ?? []));
  const [jabQ,     setJabQ]     = useState("");
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const allJab = FUNGSIONAL.map(j => j.nama).concat(PELAKSANA.map(j => j.nama));
  const suggestions = jabQ.length > 1
    ? allJab.filter(j => j.toLowerCase().includes(jabQ.toLowerCase()) && !jabTags.includes(j)).slice(0, 6)
    : [];

  function validate() {
    const e: Record<string, string> = {};
    if (!tipe)    e.tipe    = "Wajib diisi";
    if (!penerbit) e.penerbit = "Wajib diisi";
    if (!nomor)   e.nomor   = "Wajib diisi";
    if (!dari)    e.dari    = "Wajib diisi";
    if (!hingga)  e.hingga  = "Wajib diisi";
    else if (hingga <= dari) e.hingga = "Harus setelah tanggal terbit";
    if (mode === "upload") {} // berkas optional in this mock
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id: row?.id ?? Date.now(),
      tipe: tipe as DasarHukumRow["tipe"],
      jenis, penerbit, nomor, perihal,
      berlakuDari: dari, berlakuHingga: hingga,
      jabatan: jabTags.length, jabatanNama: jabTags,
    });
  }

  function Err({ f }: { f: string }) {
    return errors[f] ? <p className="text-[10px] text-red-500 mt-0.5">{errors[f]}</p> : null;
  }
  const inp = (err?: boolean) =>
    `w-full py-1.5 px-2.5 text-xs border rounded-lg focus:outline-none focus:border-orange-300 bg-white ${err ? "border-red-300" : "border-gray-200"}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[390px] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{mode === "upload" ? "Unggah Dasar Hukum" : "Sunting Dasar Hukum"}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tipe */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Tipe <span className="text-red-500">*</span></label>
            <select value={tipe} onChange={e => setTipe(e.target.value)} className={inp(!!errors.tipe)}>
              <option value="">Pilih tipe…</option>
              {["Rekom","Persetujuan","Distribusi"].map(o => <option key={o}>{o}</option>)}
            </select><Err f="tipe" />
          </div>
          {/* Jenis */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Jenis Jabatan <span className="text-red-500">*</span></label>
            <select value={jenis} onChange={e => setJenis(e.target.value as typeof jenis)} className={inp()}>
              <option>Jabatan Fungsional</option><option>Jabatan Pelaksana</option>
            </select>
          </div>
          {/* Penerbit */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Penerbit <span className="text-red-500">*</span></label>
            <input value={penerbit} onChange={e => setPenerbit(e.target.value)} placeholder="mis. BKN Pusat"
              className={inp(!!errors.penerbit)} /><Err f="penerbit" />
          </div>
          {/* Nomor */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Nomor <span className="text-red-500">*</span></label>
            <input value={nomor} onChange={e => setNomor(e.target.value)} placeholder="mis. B/BA.00.00/152/2026"
              className={`${inp(!!errors.nomor)} font-mono`} /><Err f="nomor" />
          </div>
          {/* Tanggal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" value={dari} onChange={e => setDari(e.target.value)} className={inp(!!errors.dari)} /><Err f="dari" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">Tanggal Berakhir <span className="text-red-500">*</span></label>
              <input type="date" value={hingga} onChange={e => setHingga(e.target.value)} className={inp(!!errors.hingga)} /><Err f="hingga" />
            </div>
          </div>
          {/* Perihal */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1">Perihal</label>
            <textarea value={perihal} onChange={e => setPerihal(e.target.value)} rows={3}
              style={{ resize: "vertical" }} placeholder="Perihal surat…"
              className="w-full py-1.5 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300" />
          </div>
          {/* Berkas */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1 flex gap-0.5">
              Berkas PDF {mode === "upload" && <span className="text-red-500">*</span>}
            </label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
              <Download size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500">Pilih Berkas PDF</span>
              <input type="file" accept=".pdf" className="hidden" />
            </label>
            {mode === "edit" && <p className="text-[10px] text-gray-400 mt-1">Biarkan kosong untuk mempertahankan berkas lama.</p>}
          </div>
          {/* Jabatan multi-select */}
          <div>
            <label className="text-[11px] font-medium text-gray-600 mb-1">Jabatan</label>
            <div className="border border-gray-200 rounded-lg p-2 min-h-[38px] focus-within:border-orange-300">
              <div className="flex flex-wrap gap-1 mb-1">
                {jabTags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: ACCENT_L, color: ACCENT }}>
                    {tag}
                    <button onClick={() => setJabTags(t => t.filter(x => x !== tag))}><X size={9} /></button>
                  </span>
                ))}
              </div>
              <input value={jabQ} onChange={e => setJabQ(e.target.value)}
                placeholder="Ketik untuk mencari jabatan…"
                className="w-full text-xs focus:outline-none bg-transparent" />
            </div>
            {suggestions.length > 0 && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-28 overflow-y-auto shadow-sm">
                {suggestions.map(j => (
                  <button key={j} onClick={() => { setJabTags(t => [...t, j]); setJabQ(""); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    {j}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Batal</button>
          <button onClick={handleSave} className="px-4 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: ACCENT }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

// ─── Hapus Confirm Modal ──────────────────────────────────────────────────────
function HapusConfirmModal({ row, onConfirm, onClose }: { row: DasarHukumRow; onConfirm: () => void; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[360px] p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Hapus dasar hukum {row.nomor}?</p>
        <p className="text-xs text-gray-500 mb-5">Jabatan yang terkait tidak akan terhapus.</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onClick={onConfirm} className="px-4 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">Hapus</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dasar Hukum Drawer ───────────────────────────────────────────────────────
function DasarHukumDrawer({ jabatan, onClose, onOpenUpload }: {
  jabatan: string; onClose: () => void;
  onOpenUpload: (tipe: string, jabatan: string) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[560px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800 leading-snug max-w-[460px]">
            Dasar Hukum — {jabatan}
          </p>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0 ml-2">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Rekom */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">Rekom</p>
            <div className="border border-dashed border-gray-300 rounded-xl px-4 py-6 flex flex-col items-center gap-3">
              <p className="text-xs text-gray-400">Belum ada surat rekom</p>
              <button onClick={() => onOpenUpload("Rekom", jabatan)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                <Plus size={11} /> Unggah Rekom
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Persetujuan */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">Persetujuan</p>
            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <p className="text-[11px] text-green-700 font-medium">Berlaku s.d. 10 Mei 2030</p>
              </div>
              <p className="text-sm font-bold text-gray-900">B/2008/M.SM.01.00/2025</p>
              <p className="text-[11px] text-gray-400">Kementerian PAN-RB</p>
              <p className="text-[11px] text-gray-500">10 Mei 2025 → 10 Mei 2030 · 3 tahun lagi</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Persetujuan Kebutuhan Jabatan Fungsional di Lingkungan Pemerintah Provinsi Jawa Timur
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  <Eye size={11} /> Lihat
                </button>
                <button className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  <Download size={11} /> Unduh
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Distribusi */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">Distribusi</p>
            <div className="border border-dashed border-gray-300 rounded-xl px-4 py-6 flex flex-col items-center gap-3">
              <p className="text-xs text-gray-400">Belum ada surat distribusi</p>
              <button onClick={() => onOpenUpload("Distribusi", jabatan)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                <Plus size={11} /> Unggah Distribusi
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-600 leading-relaxed">
              Kelola surat — unggah, sunting, tautkan — di tab Dasar Hukum.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Insight Engine ───────────────────────────────────────────────────────────
// Alur:
//  1. Rule engine (deterministik) menghitung status + opsi dari angka ABK, bezetting, pensiun, dan sebaran unit.
//  2. Kesimpulan disusun langsung dari hasil rule di atas (template kalimat berbasis angka), tanpa AI.
//  3. Pemanggilan Groq DINONAKTIFKAN (GROQ_AKTIF = false). Ubah ke true dan isi key bila ingin dihidupkan lagi:
//     narasi Groq hanya menulis ulang hasil rule; jika gagal/tidak valid, otomatis kembali ke template.
const LEVEL_ORDER = ["Ahli Pertama", "Ahli Muda", "Ahli Madya"];

// ── Konfigurasi Groq ─────────────────────────────────────────────────────────
// Isi lewat .env (VITE_GROQ_API_URL, VITE_GROQ_API_KEY, VITE_GROQ_MODEL) atau langsung di baris di bawah.
// Catatan: key yang dipanggil dari browser terlihat di DevTools. Untuk produksi, arahkan URL ke backend proxy.
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
const GROQ_API_URL = ENV.VITE_GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions"; // ← taruh link endpoint di sini
const GROQ_API_KEY = ENV.VITE_GROQ_API_KEY || "";                                                  // ← taruh API key di sini
const GROQ_AKTIF   = false;                                                                        // ← true = panggil Groq; false = murni rule-based
const GROQ_MODEL   = ENV.VITE_GROQ_MODEL   || "llama-3.3-70b-versatile";

// Ambang tingkat kekurangan (% dari ABK). Ini ketentuan internal dashboard, bukan angka dari regulasi.
const AMBANG_KRITIS = 60, AMBANG_TINGGI = 30, AMBANG_SEDANG = 10;
function tingkatKurang(persen: number): string {
  return persen >= AMBANG_KRITIS ? "Kritis" : persen >= AMBANG_TINGGI ? "Tinggi" : persen >= AMBANG_SEDANG ? "Sedang" : "Rendah";
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xFFFFFF;
  return h;
}
function deterministicDays(nama: string): number { return 30 + (hashStr(nama) % 61); }

// SIMULASI. Ganti dengan query jumlah PNS per jenjang yang mencapai BUP dalam ≤ 3 tahun.
function proyeksiPensiun3Tahun(jabatan: string, jenjang: string, pns: number): number {
  const pctPerTahun = ((hashStr(`${jabatan}|${jenjang}`) % 9) + 1) / 100;
  return Math.min(pns, Math.round(pns * pctPerTahun * 3));
}

interface InsightOpsi { label: string; text: string; dasar?: string; }
interface InsightJenjangRow { nama: string; abk: number; terisi: number; selisih: number; pensiun3: number; tingkat: string; }
interface InsightUnitRow { nama: string; abk: number; terisi: number; selisih: number; }
type InsightStatus = "Perlu Ditinjau" | "Kelebihan" | "Terpenuhi" | "Tidak Merata" | "Kritis" | "Tinggi" | "Sedang" | "Rendah";

interface InsightFakta {
  jabatan: string; abk: number; pns: number; pppk: number; terisi: number; selisih: number;
  persen: number | null; status: string;
  jenjang: { nama: string; abk: number; terisi: number; selisih: number; pensiunPNS3Tahun: number }[];
  unit: InsightUnitRow[];
  ringkasanUnit: string;
  sudahDicek: string[];
  langkahTerurut: string[];
  catatan: string | null;
}

interface InsightResult {
  status: InsightStatus;
  terisi: number; selisih: number;
  persenLebih?: number; persenKurang?: number;
  kesimpulan: string;
  penyebab: [string, string];
  jenjangRows: InsightJenjangRow[];
  unitRows?: InsightUnitRow[];
  fokusNama?: string;
  opsi: InsightOpsi[];
  catatan?: string;
  verifikasi: string[];
  sudahDicek?: string[];
  berlakuHingga: string;
  sisaHari: number;
  fakta: InsightFakta;
}

const STATUS_CFG: Record<InsightStatus, { color: string; bg: string; border: string }> = {
  "Perlu Ditinjau": { color: AM,     bg: "#FFFBEB", border: "#FDE68A" },
  "Tidak Merata":   { color: AM,     bg: "#FFFBEB", border: "#FDE68A" },
  "Kelebihan":      { color: BLUE_C, bg: "#EFF6FF", border: "#BFDBFE" },
  "Terpenuhi":      { color: GR,     bg: "#F0FDF4", border: "#BBF7D0" },
  "Kritis":         { color: RE,     bg: "#FEF2F2", border: "#FECACA" },
  "Tinggi":         { color: ACCENT, bg: ACCENT_L,  border: "#FED7AA" },
  "Sedang":         { color: AM,     bg: "#FFFBEB", border: "#FDE68A" },
  "Rendah":         { color: GY,     bg: "#F9FAFB", border: "#E5E7EB" },
};

const TINGKAT_COLOR: Record<string, string> = {
  "Kritis": RE, "Tinggi": ACCENT, "Sedang": AM, "Rendah": GY, "Terpenuhi": GR, "Kelebihan": BLUE_C,
};

// ── Analisis per jenjang ─────────────────────────────────────────────────────
interface JenjangAnalisis {
  nama: string; abk: number; pns: number; pppk: number; terisi: number; selisih: number;
  pensiun3: number; tingkat: string; units: Unit[]; unitLebih: Unit[]; unitKurang: Unit[];
}
const selUnit = (u: Unit) => u.pns + u.pppk - u.abk;
const sebut = (us: Unit[]) => us.map(u => `${u.nama} (${Math.abs(selUnit(u))})`).join(", ");

function analisisJenjang(jabatan: string, j: JenjangSummary): JenjangAnalisis {
  const terisi  = j.pns + j.pppk;
  const selisih = terisi - j.abk;
  const persen  = j.abk > 0 ? Math.round((-selisih / j.abk) * 100) : 0;
  const units   = j.units ?? [];
  return {
    nama: j.nama, abk: j.abk, pns: j.pns, pppk: j.pppk, terisi, selisih,
    pensiun3: proyeksiPensiun3Tahun(jabatan, j.nama, j.pns),
    tingkat: selisih > 0 ? "Kelebihan" : selisih === 0 ? "Terpenuhi" : tingkatKurang(persen),
    units, unitLebih: units.filter(u => selUnit(u) > 0), unitKurang: units.filter(u => selUnit(u) < 0),
  };
}

// ── Rule: kekurangan → redistribusi → kenaikan jenjang → pengadaan ───────────
function opsiKekurangan(F: JenjangAnalisis, rows: JenjangAnalisis[]) {
  const opsi: InsightOpsi[] = [];
  const catatan: string[] = [];
  const dicek: string[] = [];
  let sisa = -F.selisih;
  let feeder: JenjangAnalisis | undefined;

  // 1. Redistribusi antarunit pada jenjang yang sama
  const lebih = F.unitLebih.reduce((s, u) => s + selUnit(u), 0);
  if (lebih > 0 && F.unitKurang.length > 0) {
    const pindah = Math.min(lebih, sisa);
    opsi.push({
      label: "Redistribusi",
      text: `${sebut(F.unitLebih)} berlebih, sedangkan ${sebut(F.unitKurang)} kurang. Menggeser pegawai antarunit bisa menutup sampai ${pindah} dari ${sisa} kekurangan di ${F.nama}.`,
      dasar: "Usul formasi memuat rencana redistribusi, jadi peluang redistribusi dicek lebih dulu.",
    });
    sisa -= pindah;
  } else if (F.units.length > 1) {
    dicek.push(`Redistribusi antarunit: tidak ada unit yang berlebih pada ${F.nama}, jadi tidak ada pegawai yang bisa digeser.`);
  } else {
    dicek.push(`Redistribusi antarunit: ${F.nama} hanya tercatat di satu unit.`);
  }

  // 2. Kenaikan jenjang dari jenjang di bawahnya, hanya dari kelebihan agar tidak memindahkan masalah
  const idx = LEVEL_ORDER.indexOf(F.nama);
  feeder = idx > 0 ? rows.find(r => r.nama === LEVEL_ORDER[idx - 1]) : undefined;
  if (idx === 0) {
    dicek.push(`Kenaikan jenjang: ${F.nama} adalah jenjang terendah, tidak ada jenjang di bawahnya yang bisa menjadi calon.`);
  } else if (idx > 0 && !feeder) {
    dicek.push(`Kenaikan jenjang: tidak ada data ${LEVEL_ORDER[idx - 1]} pada jabatan ini.`);
  }
  if (feeder && sisa > 0) {
    const calon = Math.min(Math.max(0, feeder.selisih), feeder.pns, sisa);
    if (calon > 0) {
      opsi.push({
        label: "Kenaikan jenjang",
        text: `${feeder.nama} kelebihan ${feeder.selisih}, sehingga sampai ${calon} PNS bisa dipertimbangkan naik ke ${F.nama} tanpa membuat kekurangan baru di jenjang bawah. Kelayakannya bergantung pada angka kredit, masa kerja, dan diklat; calon yang belum memenuhi standar kompetensi perlu disiapkan lewat pengembangan kompetensi.`,
        dasar: "Pengembangan kompetensi menutup kesenjangan terhadap standar jabatan; ia menyiapkan calon, tidak menambah jumlah pegawai.",
      });
      sisa -= calon;
    } else {
      const alasan = feeder.selisih > 0 ? `kelebihannya bukan berupa PNS` : feeder.selisih === 0 ? `${feeder.nama} baru pas dengan ABK` : `${feeder.nama} sendiri masih kurang ${-feeder.selisih}`;
      dicek.push(`Kenaikan jenjang: ${alasan}, jadi tidak ada pegawai yang bisa dinaikkan tanpa membuat kekurangan baru.`);
      if (feeder.selisih < 0 && feeder.pns > 0) {
        catatan.push(`Menaikkan PNS dari ${feeder.nama} hanya memindahkan kekurangan ke jenjang bawah.`);
      }
    }
  }

  // 3. Pengadaan untuk sisa kekurangan + antisipasi pensiun
  if (sisa > 0 || F.pensiun3 > 0) {
    const text = sisa > 0 && F.pensiun3 > 0
      ? `${opsi.length > 0 ? "Sisa kekurangan" : "Kekurangan"} ${sisa} orang ditambah ${F.pensiun3} PNS yang diproyeksikan pensiun dalam 3 tahun berarti kebutuhan pengisian sekitar ${sisa + F.pensiun3} orang; dapat diusulkan bertahap sebagai formasi baru.`
      : sisa > 0
        ? (opsi.length > 0
            ? `Sisa kekurangan ${sisa} orang setelah langkah di atas dapat diusulkan sebagai formasi baru.`
            : `Kekurangan ${sisa} orang${F.unitKurang.length ? `, berada di ${F.unitKurang.map(u => u.nama).join(" dan ")},` : ""} tidak bisa ditutup dari dalam, sehingga dapat diusulkan sebagai formasi baru.`)
        : `Kekurangan saat ini bisa tertutup lewat langkah di atas, tetapi ${F.pensiun3} PNS diproyeksikan pensiun dalam 3 tahun sehingga formasi pengganti perlu diantisipasi.`;
    opsi.push({
      label: "Pengadaan", text,
      dasar: "Usul formasi memperhitungkan jumlah pegawai per jenjang, pensiun, kuota, dan rasio belanja pegawai; dokumen Anjab, ABK, rencana redistribusi, dan proyeksi 5 tahun harus lengkap.",
    });
  }
  return { opsi, catatan, dicek, sisa, feeder, adaKenaikan: opsi.some(o => o.label === "Kenaikan jenjang"), adaPengadaan: opsi.some(o => o.label === "Pengadaan") };
}

// ── Rule: kelebihan → tunggu pensiun → redistribusi/kenaikan jenjang → tinjau ABK ──
function opsiKelebihan(F: JenjangAnalisis, rows: JenjangAnalisis[]) {
  const opsi: InsightOpsi[] = [];
  let sisa = F.selisih - F.pensiun3;

  if (sisa <= 0) {
    opsi.push({
      label: "Pemantauan",
      text: `Kelebihan ${F.selisih} orang di ${F.nama} diperkirakan habis dalam 3 tahun karena ${F.pensiun3} PNS pensiun. Tidak perlu tindakan khusus; cukup tidak membuka formasi baru untuk jenjang ini.`,
      dasar: "Kelebihan pegawai dikurangi dulu dengan PNS yang akan pensiun sebelum diputuskan.",
    });
    return { opsi, sisa: 0 };
  }

  const kurangUnit = F.unitKurang.reduce((s, u) => s - selUnit(u), 0);
  if (kurangUnit > 0) {
    const pindah = Math.min(sisa, kurangUnit);
    opsi.push({
      label: "Redistribusi",
      text: `Setelah memperhitungkan ${F.pensiun3} PNS pensiun, kelebihan bersih ${sisa} orang. ${sebut(F.unitLebih)} bisa menyalurkan sampai ${pindah} orang ke ${sebut(F.unitKurang)}.`,
      dasar: "Redistribusi berbasis peta jabatan dan beban kerja dianjurkan saat ada ketimpangan antarunit.",
    });
    sisa -= pindah;
  }
  const idx = LEVEL_ORDER.indexOf(F.nama);
  const upper = idx >= 0 ? rows.find(r => r.nama === LEVEL_ORDER[idx + 1]) : undefined;
  if (upper && upper.selisih < 0 && sisa > 0 && F.pns > 0) {
    const calon = Math.min(sisa, F.pns, -upper.selisih);
    opsi.push({
      label: "Kenaikan jenjang",
      text: `${upper.nama} kurang ${-upper.selisih}. Sampai ${calon} PNS di ${F.nama} bisa dipertimbangkan naik jenjang, tergantung angka kredit, masa kerja, dan diklat.`,
    });
    sisa -= calon;
  }
  if (sisa > 0) {
    opsi.push({
      label: "Redistribusi",
      text: `Sisa kelebihan ${sisa} orang belum punya penampung di dalam jabatan ini. Cek jabatan sejenis di OPD lain yang kekurangan.`,
    });
    opsi.push({ label: "Tinjau Data", text: "Periksa kapan ABK jabatan ini terakhir dihitung dan apakah beban kerjanya sudah berubah." });
  }
  return { opsi, sisa };
}

// Ringkasan sebaran unit ditulis oleh rule supaya narasi tidak menilai sendiri ("merata", "timpang")
function ringkasUnit(F: JenjangAnalisis): string {
  if (F.units.length <= 1) return `Hanya satu unit: ${F.units[0]?.nama ?? "-"}.`;
  const kurang = F.unitKurang.map(u => `${u.nama} kurang ${-selUnit(u)}`);
  const lebih  = F.unitLebih.map(u => `${u.nama} lebih ${selUnit(u)}`);
  const pas    = F.units.filter(u => selUnit(u) === 0).map(u => `${u.nama} terpenuhi`);
  return [...kurang, ...lebih, ...pas].join("; ") + ".";
}

// Kalimat penutup kesimpulan: langkah pertama + alasan langkah lain tidak tersedia
function alasanLangkah(opsi: InsightOpsi[], dicek: string[]): string {
  const pertama = opsi[0]?.label ?? "Tinjau Data";
  const tidakAda = dicek.map(d => d.split(":")[0].toLowerCase());
  if (pertama === "Pengadaan" && tidakAda.length) {
    return `Karena ${tidakAda.join(" dan ")} tidak memungkinkan, langkah yang dapat dipertimbangkan adalah pengadaan formasi baru.`;
  }
  return `Langkah yang paling dulu dapat dipertimbangkan adalah ${pertama.toLowerCase()}.`;
}

function generateInsight(target: DrawerTarget): InsightResult {
  // Simulasi: pada implementasi nyata angka ini berasal dari query SQL agregat tabel abk_jabatan dan bezetting_pegawai
  const terisi  = target.pns + target.pppk;
  const selisih = terisi - target.abk;

  const d = new Date();
  const sisaHari = deterministicDays(target.jabatan); // SIMULASI: ganti dengan tanggal kedaluwarsa dari server
  d.setDate(d.getDate() + sisaHari);
  const berlakuHingga = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const label = target.jenjangLabel ? `${target.jabatan} · ${target.jenjangLabel}` : target.jabatan;
  const modeJenjang = !!target.jenjangLabel;

  const daftar: JenjangSummary[] = target.jenjang?.length
    ? target.jenjang
    : [{ nama: target.jenjangLabel ?? "Total", abk: target.abk, pns: target.pns, pppk: target.pppk, units: target.units }];
  const rows = daftar
    .map(j => analisisJenjang(target.jabatan, j))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.nama) - LEVEL_ORDER.indexOf(b.nama));

  const lingkup0 = modeJenjang ? rows.filter(r => r.nama === target.jenjangLabel) : rows;
  const lingkup  = lingkup0.length ? lingkup0 : rows;
  const kurang   = lingkup.filter(r => r.selisih < 0);
  const F = kurang.length
    ? kurang.reduce((w, r) => (r.selisih < w.selisih ? r : w))
    : lingkup.reduce((m, r) => (r.selisih > m.selisih ? r : m), lingkup[0]);

  const jenjangRows: InsightJenjangRow[] = rows.map(r => ({
    nama: r.nama, abk: r.abk, terisi: r.terisi, selisih: r.selisih, pensiun3: r.pensiun3, tingkat: r.tingkat,
  }));
  const unitRows: InsightUnitRow[] | undefined = F.units.length > 1
    ? F.units.map(u => ({ nama: u.nama, abk: u.abk, terisi: u.pns + u.pppk, selisih: selUnit(u) }))
    : undefined;

  const selesai = (p: {
    status: InsightStatus; kesimpulan: string; penyebab: [string, string]; opsi: InsightOpsi[];
    verifikasi: string[]; catatan?: string; persenLebih?: number; persenKurang?: number; sudahDicek?: string[];
  }): InsightResult => ({
    ...p, terisi, selisih, jenjangRows, unitRows, fokusNama: F.nama, berlakuHingga, sisaHari,
    fakta: {
      jabatan: label, abk: target.abk, pns: target.pns, pppk: target.pppk, terisi, selisih,
      persen: p.persenKurang ?? p.persenLebih ?? null, status: p.status,
      jenjang: rows.map(r => ({ nama: r.nama, abk: r.abk, terisi: r.terisi, selisih: r.selisih, pensiunPNS3Tahun: r.pensiun3 })),
      unit: unitRows ?? [],
      ringkasanUnit: ringkasUnit(F),
      sudahDicek: p.sudahDicek ?? [],
      langkahTerurut: p.opsi.map(o => `${o.label}: ${o.text}`),
      catatan: p.catatan ?? null,
    },
  });

  // ── A: ABK = 0, ada pegawai → Perlu Ditinjau ──────────────────────────────
  if (target.abk === 0 && terisi > 0) {
    return selesai({
      status: "Perlu Ditinjau",
      kesimpulan: `ABK jabatan ini tercatat 0, padahal ada ${terisi} pegawai (${target.pns} PNS, ${target.pppk} PPPK). Selisih ini kemungkinan bukan kelebihan pegawai, melainkan ABK yang belum dihitung atau dipetakan.`,
      penyebab: ["Jabatan belum dipetakan atau dihitung ABK-nya di sistem.", "Ada perubahan struktur organisasi sehingga pemetaan lama tidak berlaku."],
      opsi: [{ label: "Tinjau Data", text: "Validasi dan hitung ulang ABK jabatan ini melalui tab Perlu Mapping sebelum diambil kesimpulan lain." }],
      verifikasi: ["Apakah jabatan ini memang masih relevan di unit tersebut.", "Apakah ABK sudah pernah dihitung tapi belum diinput."],
    });
  }

  // ── B: Kekurangan ─────────────────────────────────────────────────────────
  if (selisih < 0) {
    const persenKurang = Math.round((-selisih / target.abk) * 100);
    const status = tingkatKurang(persenKurang) as InsightStatus;
    const r = opsiKekurangan(F, rows);
    const lain = kurang.filter(k => k.nama !== F.nama);
    const catatan = [
      ...r.catatan,
      lain.length ? `Jenjang lain yang juga kurang: ${lain.map(k => `${k.nama} (${-k.selisih})`).join(", ")}.` : "",
    ].filter(Boolean).join(" ") || undefined;

    const subjek = modeJenjang ? `${label}` : "Jabatan ini";
    const kalimat = [
      `${subjek} kekurangan ${-selisih} pegawai dari ABK ${target.abk} (${persenKurang}%, tingkat ${status.toLowerCase()}).`,
      rows.length > 1 && !modeJenjang ? `Kekurangan terbesar ada di ${F.nama} (${-F.selisih} orang).` : "",
      F.units.length > 1 && F.unitKurang.length ? `Per unit: ${ringkasUnit(F)}` : "",
      F.pensiun3 > 0
        ? `${F.pensiun3} PNS di ${F.nama} diproyeksikan pensiun dalam 3 tahun sehingga kekurangan berpotensi bertambah.`
        : `Belum ada PNS di ${F.nama} yang diproyeksikan pensiun dalam 3 tahun.`,
      alasanLangkah(r.opsi, r.dicek),
    ];
    const kesimpulan = kalimat.filter(Boolean).join(" ");

    const penyebabA = `Pengisian belum menutup ABK yang ditetapkan (terisi ${terisi} dari ${target.abk}).`;
    const penyebabB = F.unitLebih.length && F.unitKurang.length
      ? `Sebaran antarunit belum sesuai ABK: ${sebut(F.unitLebih)} berlebih sementara ${sebut(F.unitKurang)} kurang.`
      : F.pensiun3 > 0
        ? `Pensiun ${F.pensiun3} PNS dalam 3 tahun akan memperbesar kekosongan bila belum ada pengganti.`
        : "ABK mungkin disusun dari proyeksi beban kerja yang lebih tinggi dari kondisi riil; perlu dicek kapan terakhir dihitung.";

    const verifikasi = [
      r.adaKenaikan && r.feeder ? `Kelayakan kenaikan jenjang calon dari ${r.feeder.nama} (angka kredit, masa kerja, diklat).` : "",
      "Proyeksi pensiun per jenjang dalam 1–3 tahun ke depan.",
      r.adaPengadaan ? "Kuota formasi tahun berjalan dan rasio belanja pegawai terhadap total belanja." : "",
      r.adaPengadaan ? "Kelengkapan dokumen Anjab, ABK, dan proyeksi kebutuhan 5 tahun sebagai syarat usul formasi." : "",
    ].filter(Boolean);

    return selesai({ status, persenKurang, kesimpulan, penyebab: [penyebabA, penyebabB], opsi: r.opsi, catatan, verifikasi, sudahDicek: r.dicek });
  }

  // ── C: Total cukup/lebih, tetapi ada jenjang yang kurang ──────────────────
  if (kurang.length > 0 && !modeJenjang) {
    const lebihRows = rows.filter(r => r.selisih > 0);
    const r = opsiKekurangan(F, rows);
    return selesai({
      status: "Tidak Merata",
      kesimpulan: `Secara total jabatan ini terisi ${terisi} dari ABK ${target.abk}, tetapi komposisinya tidak sesuai: ${F.nama} kurang ${-F.selisih}${lebihRows.length ? `, sedangkan ${lebihRows.map(x => `${x.nama} lebih ${x.selisih}`).join(" dan ")}` : ""}.`,
      penyebab: [
        "Pengisian jabatan belum mengikuti komposisi jenjang dalam ABK; jumlahnya cukup tetapi tersebar tidak sesuai.",
        "Kemungkinan ada pegawai yang sudah layak naik jenjang tetapi belum diproses, atau ABK per jenjang belum diperbarui.",
      ],
      opsi: r.opsi,
      sudahDicek: r.dicek,
      catatan: r.catatan.join(" ") || undefined,
      verifikasi: [
        r.feeder ? `Kelayakan kenaikan jenjang pegawai di ${r.feeder.nama} (angka kredit, masa kerja, diklat).` : "Kelayakan kenaikan jenjang pegawai (angka kredit, masa kerja, diklat).",
        "Proyeksi pensiun per jenjang dalam 1–3 tahun ke depan.",
      ],
    });
  }

  // ── D: Kelebihan ──────────────────────────────────────────────────────────
  if (selisih > 0) {
    const persenLebih = Math.round((selisih / target.abk) * 100);
    const r = opsiKelebihan(F, rows);
    const pensiunLingkup = lingkup.reduce((s, x) => s + x.pensiun3, 0);
    return selesai({
      status: "Kelebihan", persenLebih,
      kesimpulan: [
        `Jabatan ini terisi ${terisi} pegawai, melebihi ABK sebanyak ${selisih} orang (${persenLebih}% di atas kebutuhan).`,
        F.units.length > 1 && F.unitLebih.length ? `Per unit: ${ringkasUnit(F)}` : "",
        pensiunLingkup >= selisih
          ? `Proyeksi ${pensiunLingkup} PNS pensiun dalam 3 tahun akan menghabiskan kelebihan ini.`
          : pensiunLingkup > 0
            ? `${pensiunLingkup} PNS diproyeksikan pensiun dalam 3 tahun, sehingga kelebihan bersih sekitar ${selisih - pensiunLingkup} orang.`
            : "Belum ada PNS yang diproyeksikan pensiun dalam 3 tahun, sehingga kelebihan tidak akan berkurang dengan sendirinya.",
        `Langkah yang dapat dipertimbangkan: ${[...new Set(r.opsi.map(o => o.label.toLowerCase()))].join(" dan ")}.`,
      ].filter(Boolean).join(" "),
      penyebab: [
        "Penambahan pegawai (pengadaan/mutasi) terjadi setelah ABK terakhir dihitung.",
        "ABK belum diperbarui mengikuti perubahan proses kerja atau efisiensi/otomatisasi.",
      ],
      opsi: r.opsi,
      catatan: "Kelebihan pegawai tidak serta-merta berarti pengurangan; opsi ini untuk penataan, bukan pemutusan hubungan kerja.",
      verifikasi: ["Kapan ABK jabatan ini terakhir dihitung ulang.", "Apakah ada unit atau OPD lain dengan jabatan sejenis yang kekurangan.", "Proyeksi pensiun per jenjang dalam 1–3 tahun ke depan."],
    });
  }

  // ── E: Terpenuhi ──────────────────────────────────────────────────────────
  const pensiunLingkup = lingkup.reduce((s, x) => s + x.pensiun3, 0);
  return selesai({
    status: "Terpenuhi",
    kesimpulan: `Jabatan ini sudah seimbang. Bezetting (${terisi}) sesuai dengan ABK (${target.abk}).` +
      (pensiunLingkup > 0 ? ` Namun ${pensiunLingkup} PNS diproyeksikan pensiun dalam 3 tahun, sehingga kekurangan bisa muncul.` : ""),
    penyebab: ["Data ABK sudah dikalibrasi dengan kondisi aktual.", "Rekrutmen dan redistribusi berjalan sesuai rencana."],
    opsi: [pensiunLingkup > 0
      ? { label: "Antisipasi pensiun", text: `Siapkan rencana pengganti untuk ${pensiunLingkup} PNS yang diproyeksikan pensiun dalam 3 tahun agar bezetting tetap memenuhi ABK.`, dasar: "Jumlah PNS yang akan pensiun menjadi parameter dalam perencanaan kebutuhan." }
      : { label: "Pemantauan", text: "Kondisi sudah seimbang. Lakukan evaluasi ABK berkala untuk memastikan angka tetap relevan." }],
    verifikasi: ["Kevalidan angka ABK (apakah masih relevan dengan kondisi terkini).", "Proyeksi pensiun dalam 1–3 tahun ke depan."],
  });
}

// ── Narasi Groq ───────────────────────────────────────────────────────────────
type NarasiSumber = "groq" | "template" | "galat";
const narasiCache = new Map<string, string>();

const PROMPT_SISTEM =
  "Kamu analis kepegawaian di BKD Provinsi Jawa Timur. Tulis kesimpulan dari data ABK yang diberikan, maksimal 3 kalimat, satu paragraf, tanpa poin dan tanpa pembuka basa-basi. " +
  "Aturan: (1) pakai hanya angka dan nama yang ada di data, jangan menambah angka atau fakta baru; " +
  "(2) jelaskan alasan rekomendasi dari angka (selisih, pensiun, jenjang) dan pakai ringkasanUnit apa adanya untuk sebaran unit, jangan menilai sebaran sendiri; " +
  "sebut langkah pertama dari langkahTerurut, dan jika ada sudahDicek, sebut singkat mengapa opsi lain tidak tersedia; " +
  "jangan pernah menulis nama field JSON (seperti langkahTerurut, ringkasanUnit, sudahDicek) atau kata 'data JSON' di jawaban; " +
  "(3) jangan menyatakan keputusan final, gunakan kata seperti 'dapat dipertimbangkan'; " +
  "(4) bahasa Indonesia formal yang lugas, hindari kalimat klise.";

function narasiValid(teks: string, fakta: InsightFakta): boolean {
  const boleh = new Set(JSON.stringify(fakta).match(/\d+/g) ?? []);
  ["1", "3", "5"].forEach(n => boleh.add(n));
  if (/[a-z][A-Z]/.test(teks) || /json/i.test(teks)) return false; // nama field bocor ke narasi
  return teks.length > 20 && teks.length < 700 && (teks.match(/\d+/g) ?? []).every(n => boleh.has(n));
}

async function tulisNarasi(fakta: InsightFakta, fallback: string, paksa: boolean): Promise<{ teks: string; sumber: NarasiSumber }> {
  if (!GROQ_AKTIF || !GROQ_API_KEY) return { teks: fallback, sumber: "template" };
  const kunci = JSON.stringify(fakta);
  if (!paksa && narasiCache.has(kunci)) return { teks: narasiCache.get(kunci)!, sumber: "groq" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL, temperature: 0.2, max_tokens: 300,
        messages: [
          { role: "system", content: PROMPT_SISTEM },
          { role: "user", content: `DATA (JSON):\n${kunci}\n\nTulis kesimpulannya.` },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const teks = String(data?.choices?.[0]?.message?.content ?? "").replace(/\*\*/g, "").trim();
    if (!narasiValid(teks, fakta)) return { teks: fallback, sumber: "galat" };
    narasiCache.set(kunci, teks);
    return { teks, sumber: "groq" };
  } catch {
    return { teks: fallback, sumber: "galat" };
  } finally {
    clearTimeout(timer);
  }
}

// ─── AI Insight Drawer ────────────────────────────────────────────────────────
function AIInsightDrawer({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const [reload, setReload]   = useState(0);
  const insight = useMemo(() => generateInsight(target), [target, reload]);
  const [narasi, setNarasi]   = useState<{ teks: string; sumber: NarasiSumber } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!GROQ_AKTIF) { setNarasi({ teks: insight.kesimpulan, sumber: "template" }); setLoading(false); return; }
    let batal = false;
    setLoading(true);
    tulisNarasi(insight.fakta, insight.kesimpulan, reload > 0).then(r => {
      if (!batal) { setNarasi(r); setLoading(false); }
    });
    return () => { batal = true; };
  }, [insight, reload]);

  const sc      = STATUS_CFG[insight.status];
  const terisi  = insight.terisi;
  const pctAbk  = target.abk > 0 ? Math.min(100, (terisi / target.abk) * 100) : 0;
  const label   = target.jenjangLabel ? `${target.jabatan} · ${target.jenjangLabel}` : target.jabatan;
  const sumberLabel = !narasi ? "" : narasi.sumber === "groq" ? "Narasi oleh Groq"
    : narasi.sumber === "galat" ? "Narasi template · Groq gagal atau tidak lolos validasi"
    : GROQ_AKTIF ? "Narasi template · Groq belum diatur" : "Disusun dari aturan";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[560px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Sparkles size={14} style={{ color: ACCENT }} />
              <p className="text-xs font-medium" style={{ color: ACCENT }}>AI Insight</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                {insight.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-800 leading-snug max-w-[440px]">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{target.kategori}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0 mt-0.5">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Formula ABK */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Formula ABK</p>
            <div className="flex items-center gap-2">
              {[
                { label: "ABK",                val: fmt(target.abk), color: "#374151" },
                { sep: "−" },
                { label: "Bezetting (PNS+PPPK)", val: fmt(terisi),     color: "#374151" },
                { sep: "=" },
                { label: "Selisih",            val: lowFmt(insight.selisih), color: lowColor(insight.selisih) },
              ].map((it, i) =>
                "sep" in it ? (
                  <span key={i} className="text-gray-400 text-sm font-bold">{it.sep}</span>
                ) : (
                  <div key={i} className="flex-1 bg-white rounded-lg border border-gray-200 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">{it.label}</p>
                    <p className="text-sm font-bold" style={{ color: it.color }}>{it.val}</p>
                  </div>
                )
              )}
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Pemenuhan bezetting</span><span>{Math.round(pctAbk)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${pctAbk}%`, backgroundColor: pctAbk >= 80 ? GR : pctAbk >= 50 ? AM : RE }} />
              </div>
            </div>
          </div>

          {/* Kesimpulan AI */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Kesimpulan</p>
              {!loading && sumberLabel && <p className="text-[10px] text-gray-400">{sumberLabel}</p>}
            </div>
            <div className="rounded-xl border p-3.5 text-xs text-gray-700 leading-relaxed"
              style={{ borderColor: sc.border, backgroundColor: sc.bg }}>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-2.5 rounded bg-black/10 w-full" />
                  <div className="h-2.5 rounded bg-black/10 w-11/12" />
                  <div className="h-2.5 rounded bg-black/10 w-2/3" />
                </div>
              ) : (narasi?.teks ?? insight.kesimpulan)}
            </div>
          </div>

          {/* Dua kemungkinan penyebab */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Dua kemungkinan penyebab</p>
            <div className="space-y-2">
              {insight.penyebab.map((t, i) => (
                <div key={i} className="flex gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5">{i + 1}</span>
                  <p className="text-xs text-gray-600 leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bahan pertimbangan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Bahan pertimbangan</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[10px] text-gray-400">
                    <th className="py-2 pl-3 text-left font-semibold">Jenjang</th>
                    <th className="py-2 pr-3 text-right font-semibold">ABK</th>
                    <th className="py-2 pr-3 text-right font-semibold">Terisi</th>
                    <th className="py-2 pr-3 text-right font-semibold">Selisih</th>
                    <th className="py-2 pr-3 text-right font-semibold">Pensiun 3 th</th>
                    <th className="py-2 pr-3 text-right font-semibold">Tingkat</th>
                  </tr>
                </thead>
                <tbody>
                  {insight.jenjangRows.map(row => {
                    const aktif = !!target.jenjangLabel && row.nama === target.jenjangLabel;
                    return (
                      <tr key={row.nama} className="border-t border-gray-100" style={aktif ? { backgroundColor: ACCENT_L } : undefined}>
                        <td className="py-2 pl-3 text-gray-700 font-medium">{row.nama}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{fmt(row.abk)}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{fmt(row.terisi)}</td>
                        <td className="py-2 pr-3 text-right font-semibold" style={{ color: lowColor(row.selisih) }}>{lowFmt(row.selisih)}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{fmt(row.pensiun3)}</td>
                        <td className="py-2 pr-3 text-right">
                          <span className="text-[10px] font-semibold" style={{ color: TINGKAT_COLOR[row.tingkat] ?? GY }}>{row.tingkat}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!target.jenjangLabel && (
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-2 pl-3 text-[10px] text-gray-400">Total · PNS {fmt(target.pns)} | PPPK {fmt(target.pppk)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-700">{fmt(target.abk)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-700">{fmt(terisi)}</td>
                      <td className="py-2 pr-3 text-right font-semibold" style={{ color: lowColor(insight.selisih) }}>{lowFmt(insight.selisih)}</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Proyeksi pensiun masih berupa data simulasi (PNS yang mencapai batas usia pensiun dalam 3 tahun).</p>

            {insight.unitRows && (
              <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] text-gray-400">
                      <th className="py-2 pl-3 text-left font-semibold">Unit · {insight.fokusNama}</th>
                      <th className="py-2 pr-3 text-right font-semibold">ABK</th>
                      <th className="py-2 pr-3 text-right font-semibold">Terisi</th>
                      <th className="py-2 pr-3 text-right font-semibold">Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.unitRows.map(u => (
                      <tr key={u.nama} className="border-t border-gray-100">
                        <td className="py-2 pl-3 text-gray-700">{u.nama}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{fmt(u.abk)}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{fmt(u.terisi)}</td>
                        <td className="py-2 pr-3 text-right font-semibold" style={{ color: lowColor(u.selisih) }}>{lowFmt(u.selisih)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Opsi yang bisa dipertimbangkan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Opsi yang bisa dipertimbangkan</p>
            <div className="space-y-2.5">
              {insight.opsi.map((o, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: ACCENT_L, color: ACCENT }}>{i + 1}</span>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-0.5">{o.label}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{o.text}</p>
                    {o.dasar && <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Dasar: {o.dasar}</p>}
                  </div>
                </div>
              ))}
            </div>
            {insight.sudahDicek && insight.sudahDicek.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">Sudah dicek dan tidak tersedia</p>
                <div className="space-y-1">
                  {insight.sudahDicek.map((t, i) => (
                    <p key={i} className="text-[11px] text-gray-500 leading-relaxed">• {t}</p>
                  ))}
                </div>
              </div>
            )}
            {insight.catatan && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                <Info size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">{insight.catatan}</p>
              </div>
            )}
          </div>

          {/* Perlu dipastikan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Perlu dipastikan sebelum memutuskan</p>
            <div className="space-y-1.5">
              {insight.verifikasi.map((v, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Circle size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 leading-relaxed">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: insight.sisaHari <= INSIGHT_SEGERA_KEDALUWARSA_HARI ? ACCENT : GR }} />
              <p className="text-[11px]"
                style={{ color: insight.sisaHari <= INSIGHT_SEGERA_KEDALUWARSA_HARI ? ACCENT : "#6B7280" }}>
                Berlaku hingga {insight.berlakuHingga}
                {insight.sisaHari <= INSIGHT_SEGERA_KEDALUWARSA_HARI && ` · segera berakhir (${insight.sisaHari} hari lagi)`}
              </p>
            </div>
            <button onClick={() => setReload(n => n + 1)} disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors disabled:opacity-50">
              {loading && <Loader2 size={11} className="animate-spin" />}
              {loading ? "Menghitung…" : "Hitung ulang"}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Data bersumber dari SIASN dan diolah secara otomatis berdasarkan aturan perhitungan baku. Hasilnya bersifat indikatif dan belum mencerminkan keputusan resmi. Keputusan akhir ada pada BKD/pimpinan.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ABKPage({ onNav }: { onNav?: (id: string) => void }) {
  const [mainTab,   setMainTab]   = useState<"abk" | "mapping" | "hukum">("abk");
  const [abkSubTab, setAbkSubTab] = useState<"jabatan" | "opd">("jabatan");
  const [mapSubTab, setMapSubTab] = useState<"unit-kerja" | "jabatan" | "instansi" | "belum">("instansi");

  // Filters
  const [search,        setSearch]        = useState("");
  const [filterPD,      setFilterPD]      = useState("");
  const [filterJabatan, setFilterJabatan] = useState("");
  const [filterJenis,   setFilterJenis]   = useState("");
  const [filterKat,     setFilterKat]     = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");

  // Per Jabatan state
  const [fOpen, setFOpen] = useState(true);
  const [pOpen, setPOpen] = useState(true);
  const [expandedF, setExpandedF] = useState<Set<string>>(new Set([
    "Administrator Database Kependudukan",
    "Administrator Kesehatan",
    "Adyatama Kepariwisataan dan Ekonomi Kreatif",
  ]));
  const [expandedJ, setExpandedJ] = useState<Set<string>>(new Set([
    "Administrator Database Kependudukan:Ahli Pertama",
  ]));
  const [expandedP, setExpandedP] = useState<Set<string>>(new Set([
    "Dokumentalis Hukum", "Fasilitator Pemerintahan", "Fasilitator Perdagangan",
    "Jurnalis", "Konselor SDM", "Kurator",
  ]));
  const [fPage,    setFPage]    = useState(1);
  const [pPage,    setPPage]    = useState(1);
  const [unitPage, setUnitPage] = useState<Record<string, number>>({});
  const getUP = (n: string) => unitPage[n] ?? 1;
  const setUP = (n: string, p: number) => setUnitPage(prev => ({ ...prev, [n]: p }));

  // Per OPD state
  const [expandedOPD, setExpandedOPD] = useState<Set<string>>(new Set());
  const [opdJabPage,  setOpdJabPage]  = useState<Record<string, number>>({});
  const [opdPage,     setOpdPage]     = useState(1);
  const getOJP = (n: string) => opdJabPage[n] ?? 1;
  const setOJP = (n: string, p: number) => setOpdJabPage(prev => ({ ...prev, [n]: p }));
  const toggleOPD = (n: string) => setExpandedOPD(s => { const ns = new Set(s); ns.has(n) ? ns.delete(n) : ns.add(n); return ns; });

  // Mapping state
  const [mapToggle,    setMapToggle]    = useState<"belum" | "sudah">("belum");
  const [mapInstChecked, setMapInstChecked] = useState<Set<number>>(new Set());
  const [mapBelumChecked, setMapBelumChecked] = useState<Set<number>>(new Set());
  const [instaFilter,    setInstaFilter]    = useState<"belum" | "sudah" | "semua">("belum");
  const [instansiSearch, setInstansiSearch] = useState("");
  const [instPage,       setInstPage]       = useState(1);
  const [belumPage,      setBelumPage]      = useState(1);
  const [instansi2,      setInstansi2]      = useState(INSTANSI2_INIT);

  // Dasar Hukum state
  const [dhRows,   setDhRows]   = useState(DASAR_HUKUM_INIT);
  const [dhTipe,   setDhTipe]   = useState("semua");
  const [dhJenis,  setDhJenis]  = useState("semua");
  const [dhStatus, setDhStatus] = useState("semua");
  const [dhSearch, setDhSearch] = useState("");
  const [dhPage,   setDhPage]   = useState(1);
  const [dhModal,  setDhModal]  = useState<
    | { type: "preview"; row: DasarHukumRow }
    | { type: "edit"; row: DasarHukumRow }
    | { type: "upload"; autoTipe?: string; autoJabatan?: string }
    | { type: "hapus"; row: DasarHukumRow }
    | null
  >(null);

  // Toast
  const [appToast, setAppToast] = useState<string | null>(null);
  useEffect(() => {
    if (!appToast) return;
    const t = setTimeout(() => setAppToast(null), 3000);
    return () => clearTimeout(t);
  }, [appToast]);

  // Drawers
  const [aiTarget, setAiTarget] = useState<DrawerTarget | null>(null);
  const [dhTarget, setDhTarget] = useState<string | null>(null);

  const toggleF = (n: string) => setExpandedF(s => { const ns = new Set(s); ns.has(n) ? ns.delete(n) : ns.add(n); return ns; });
  const toggleJ = (k: string) => setExpandedJ(s => { const ns = new Set(s); ns.has(k) ? ns.delete(k) : ns.add(k); return ns; });
  const toggleP = (n: string) => setExpandedP(s => { const ns = new Set(s); ns.has(n) ? ns.delete(n) : ns.add(n); return ns; });

  const UNIT_PP = 10;
  const OPD_JAB_PP = 10;
  const OPD_PP = 10;
  const tabCls = (active: boolean) =>
    `px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${active ? "" : "border-transparent text-gray-500 hover:text-gray-700"}`;

  const opdPageData = OPD_TABLE.slice((opdPage - 1) * OPD_PP, opdPage * OPD_PP);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-6 py-2">
        <p className="text-xs text-gray-400">ABK</p>
      </div>

      {/* Page Title */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-gray-900">ABK</h1>
          <p className="text-sm text-gray-400">Analisis beban kerja jabatan fungsional &amp; pelaksana</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 pt-4 pb-2">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total ABK",   value: 84634,  Icon: Briefcase,    iconBg: "#fff7ed", iconColor: ACCENT },
            { label: "Total ASN",   value: 73725,  Icon: Users,         iconBg: "#f0fdf4", iconColor: GR    },
            { label: "PNS",         value: 31589,  Icon: UserCheck,     iconBg: "#fff7ed", iconColor: ACCENT },
            { label: "PPPK",        value: 42136,  Icon: UserCog,       iconBg: "#fff7ed", iconColor: ACCENT },
            { label: "Kekurangan",  value: -10909, Icon: AlertTriangle, iconBg: "#fffbeb", iconColor: AM    },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.iconBg }}>
                <c.Icon size={18} style={{ color: c.iconColor }} />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
                <p className="text-lg font-bold text-gray-900">{fmt(Math.abs(c.value))}</p>
                {c.label === "Kekurangan" && <p className="text-[10px] text-gray-400">kekurangan bezetting</p>}
              </div>
            </div>
          ))}
          <div />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-1">
              <p className="text-[10px] text-gray-400 mb-1">pencarian</p>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Ketik nama jabatan atau unit…"
                  className="pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg w-full focus:outline-none focus:border-orange-300" />
              </div>
            </div>
            {[
              { label: "jabatan",      val: filterJabatan, set: setFilterJabatan, opts: ["Jabatan Fungsional","Jabatan Pelaksana"] },
              { label: "perangkat daerah / unit", val: filterPD, set: setFilterPD, opts: OPD_LIST },
              { label: "jenis jabatan", val: filterJenis, set: setFilterJenis, opts: ["Teknis","Nakes"] },
              { label: "kategori",      val: filterKat,   set: setFilterKat,   opts: ["Ahli","Terampil"] },
              { label: "status pemetaan", val: filterStatus, set: setFilterStatus, opts: ["Sudah dipetakan","Belum dipetakan"] },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] text-gray-400 mb-1">{f.label}</p>
                <select value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 bg-white">
                  <option value="">Semua</option>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="px-6">
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-2">
            <div className="flex">
              {(["abk","mapping","hukum"] as const).map(tab => {
                const labels = { abk: "ABK", mapping: "Perlu Mapping", hukum: "Dasar Hukum" };
                const active = mainTab === tab;
                return (
                  <button key={tab} onClick={() => setMainTab(tab)}
                    className={tabCls(active)}
                    style={active ? { borderBottomColor: ACCENT, color: ACCENT } : {}}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pr-2">
              <button className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                <Clock size={13} /><span>Riwayat</span>
              </button>
              <button className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                <FileText size={12} /><span>Ekspor Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 pb-6 flex-1 min-h-0">
        <div className="bg-white border border-t-0 border-gray-100 rounded-b-xl shadow-sm overflow-hidden">

          {/* ═══ TAB ABK ══════════════════════════════════════════════════════ */}
          {mainTab === "abk" && (
            <div>
              {/* Sub-tab pills */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                {[
                  { id: "jabatan" as const, label: "Per Jabatan" },
                  { id: "opd"     as const, label: "Per Perangkat Daerah" },
                ].map(t => (
                  <button key={t.id} onClick={() => setAbkSubTab(t.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    style={abkSubTab === t.id ? { backgroundColor: ACCENT_L, color: ACCENT } : { color: GY }}>
                    {t.label}
                  </button>
                ))}
                {abkSubTab === "jabatan" && (
                  <div className="ml-auto">
                    <button className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-500 hover:bg-gray-50 flex items-center gap-1 transition-colors">
                      <Plus size={11} />Tambah Jabatan
                    </button>
                  </div>
                )}
              </div>

              {/* ─── Per Jabatan ─────────────────────────────────────────── */}
              {abkSubTab === "jabatan" && (
                <div className="overflow-x-auto">
                  {/*
                    8 columns:
                    col1=toggle(40px) col2=name(flex) col3=kategori(96px)
                    col4=ABK(80px) col5=PNS(80px) col6=PPPK(80px)
                    col7=Lowongan(96px) col8=Aksi(144px)
                  */}
                  <table className="w-full min-w-[900px] text-xs">
                    <colgroup>
                      <col style={{ width: 40 }} />
                      <col style={{ minWidth: 200 }} />
                      <col style={{ width: 96 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 96 }} />
                      <col style={{ width: 148 }} />
                    </colgroup>
                    <tbody>

                      {/* ── FUNGSIONAL GROUP HEADER ──────────────────────── */}
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <td className="px-2 py-2.5">
                          <button onClick={() => setFOpen(v => !v)}
                            className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white transition-colors">
                            {fOpen ? <Minus size={10} /> : <Plus size={10} />}
                          </button>
                        </td>
                        <td colSpan={2} className="py-2.5 font-semibold text-gray-700 text-[11px] tracking-wide pr-2">
                          JABATAN FUNGSIONAL <span className="font-normal text-gray-400 ml-1">· 376 jabatan</span>
                        </td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700 border-l border-gray-200 pl-2">73531</td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700">26188</td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700">25650</td>
                        <td className="py-2.5 text-right pr-4 font-semibold" style={{ color: BLUE_C }}>-21693</td>
                        <td />
                      </tr>

                      {fOpen && <>
                        {/* Column headers */}
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400">
                          <th className="py-2 px-2" />
                          <th className="py-2 text-left font-medium"><span className="flex items-center gap-1">Jabatan Fungsional <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-center font-medium"><span className="flex items-center justify-center gap-1">Kategori <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">ABK <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">PNS <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">PPPK <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-4 font-medium"><span className="flex items-center justify-end gap-1">Lowongan <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-center pr-4 font-medium">Aksi</th>
                        </tr>

                        {fPage === 1
                          ? FUNGSIONAL.map(jab => {
                              const abk = fAbk(jab), pns = fPns(jab), pppk = fPppk(jab);
                              const lw  = pns + pppk - abk;
                              const isExp = expandedF.has(jab.nama);
                              return (
                                <React.Fragment key={jab.nama}>
                                  {/* Jabatan Fungsional row */}
                                  <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-2 py-2">
                                      <button onClick={() => toggleF(jab.nama)}
                                        className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                                        {isExp ? <Minus size={9} /> : <Plus size={9} />}
                                      </button>
                                    </td>
                                    <td className="py-2 pr-2 text-gray-800">
                                      <span className="flex items-center gap-1">{jab.nama}<Info size={11} className="text-gray-300 flex-shrink-0" /></span>
                                    </td>
                                    <td className="py-2 text-center"><KatBadge k={jab.kategori} /></td>
                                    <td className="py-2 text-right pr-2 font-medium text-gray-700">{fmt(abk)}</td>
                                    <td className="py-2 text-right pr-2 text-gray-600">{fmt(pns)}</td>
                                    <td className="py-2 text-right pr-2 text-gray-600">{fmt(pppk)}</td>
                                    <td className="py-2 text-right pr-4 font-medium" style={{ color: lowColor(lw) }}>{lowFmt(lw)}</td>
                                    {/* col8 Aksi: [Users][Doc/Empty][Sparkles][Trash] */}
                                    <td className="py-2 pr-4">
                                      <div className="flex items-center justify-center gap-1">
                                        <ABtn icon={Users} variant="gray" title="Detail pegawai" />
                                        {jab.syncColor
                                          ? <DocBtn count={1} variant={jab.syncColor === "yellow" ? "orange" : "green"} onClick={() => setDhTarget(jab.nama)} />
                                          : <EmptySlot />
                                        }
                                        <ABtn icon={Sparkles} variant="orange" title="AI Insight"
                                          onClick={() => setAiTarget({
                                            jabatan: jab.nama, kategori: jab.kategori, abk, pns, pppk,
                                            jenjang: jab.jenjang.map(jen => ({ nama: jen.nama, abk: jen.abk, pns: jen.pns, pppk: jen.pppk, units: jen.units })),
                                          })} />
                                        <ABtn icon={Trash2} variant="red" title="Hapus" />
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Jenjang sub-table */}
                                  {isExp && <>
                                    {/* Jenjang sub-header: col1 col2 [col3 empty] col4 col5 col6 col7 col8 */}
                                    <tr className="bg-blue-50/20 border-b border-gray-100 text-[10px] text-gray-400">
                                      <td />
                                      <td className="py-1.5 pl-6 font-semibold uppercase tracking-wide">Jenjang</td>
                                      <td />{/* col3 Kategori empty */}
                                      <td className="py-1.5 text-right pr-2 font-semibold">ABK</td>
                                      <td className="py-1.5 text-right pr-2 font-semibold">PNS</td>
                                      <td className="py-1.5 text-right pr-2 font-semibold">PPPK</td>
                                      <td className="py-1.5 text-right pr-4 font-semibold">Lowongan</td>
                                      <td className="py-1.5 text-center pr-4 font-semibold">Aksi</td>
                                    </tr>
                                    {jab.jenjang.map(jen => {
                                      const jlw  = jen.pns + jen.pppk - jen.abk;
                                      const jkey = `${jab.nama}:${jen.nama}`;
                                      const jExp = expandedJ.has(jkey);
                                      return (
                                        <React.Fragment key={jen.nama}>
                                          {/* Jenjang row: col1 col2 [col3 empty] col4 col5 col6 col7 col8 */}
                                          <tr className="bg-gray-50/60 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-2 py-2">
                                              <button onClick={() => toggleJ(jkey)}
                                                className="w-4 h-4 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-white ml-3 transition-colors">
                                                {jExp ? <Minus size={8} /> : <Plus size={8} />}
                                              </button>
                                            </td>
                                            <td className="py-2 pl-6 pr-2 text-gray-600">{jen.nama}</td>
                                            <td />{/* col3 Kategori empty */}
                                            <td className="py-2 text-right pr-2 font-medium text-gray-700">{fmt(jen.abk)}</td>
                                            <td className="py-2 text-right pr-2 text-gray-600">{fmt(jen.pns)}</td>
                                            <td className="py-2 text-right pr-2 text-gray-600">{fmt(jen.pppk)}</td>
                                            <td className="py-2 text-right pr-4 font-medium" style={{ color: lowColor(jlw) }}>{lowFmt(jlw)}</td>
                                            {/* col8 Aksi: [Users][EmptySlot][Sparkles][Trash] */}
                                            <td className="py-2 pr-4">
                                              <div className="flex items-center justify-center gap-1">
                                                <ABtn icon={Users} variant="gray" title="Detail pegawai" />
                                                <EmptySlot />
                                                <ABtn icon={Sparkles} variant="orange" title="AI Insight"
                                                  onClick={() => setAiTarget({
                                                    jabatan: jab.nama, jenjangLabel: jen.nama, kategori: jab.kategori, abk: jen.abk, pns: jen.pns, pppk: jen.pppk,
                                                    units: jen.units,
                                                    jenjang: jab.jenjang.map(j => ({ nama: j.nama, abk: j.abk, pns: j.pns, pppk: j.pppk, units: j.units })),
                                                  })} />
                                                <ABtn icon={Trash2} variant="red" title="Hapus" />
                                              </div>
                                            </td>
                                          </tr>
                                          {/* Unit rows under jenjang: col1 col2 [col3 empty] col4 col5 col6 col7 col8 */}
                                          {jExp && jen.units.map(u => {
                                            const ulw = u.pns + u.pppk - u.abk;
                                            return (
                                              <tr key={u.nama} className="bg-gray-50/30 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td />
                                                <td className="py-1.5 pl-14 pr-2 text-gray-500">{u.nama}</td>
                                                <td />{/* col3 Kategori empty */}
                                                <td className="py-1.5 text-right pr-2 text-gray-600">{fmt(u.abk)}</td>
                                                <td className="py-1.5 text-right pr-2 text-gray-500">{fmt(u.pns)}</td>
                                                <td className="py-1.5 text-right pr-2 text-gray-500">{fmt(u.pppk)}</td>
                                                <td className="py-1.5 text-right pr-4" style={{ color: lowColor(ulw) }}>{lowFmt(ulw)}</td>
                                                {/* col8 Aksi: [Users][EmptySlot][EmptySlot][Trash] */}
                                                <td className="py-1.5 pr-4">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <ABtn icon={Users} variant="gray" title="Detail pegawai" />
                                                    <EmptySlot />
                                                    <EmptySlot />
                                                    <ABtn icon={Trash2} variant="red" title="Hapus" />
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </React.Fragment>
                                      );
                                    })}
                                  </>}
                                </React.Fragment>
                              );
                            })
                          : <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">Data contoh hanya tersedia di halaman 1</td></tr>
                        }
                      </>}

                      {/* Fungsional pagination */}
                      <tr><td colSpan={8}><PaginationBar total={122} page={fPage} onPage={setFPage} perPage={20} unit="baris" /></td></tr>

                      {/* ── PELAKSANA GROUP HEADER ────────────────────────── */}
                      <tr className="bg-gray-100 border-t-2 border-gray-200 border-b border-gray-200">
                        <td className="px-2 py-2.5">
                          <button onClick={() => setPOpen(v => !v)}
                            className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white transition-colors">
                            {pOpen ? <Minus size={10} /> : <Plus size={10} />}
                          </button>
                        </td>
                        <td colSpan={2} className="py-2.5 font-semibold text-gray-700 text-[11px] tracking-wide pr-2">
                          JABATAN PELAKSANA <span className="font-normal text-gray-400 ml-1">· 44 jabatan</span>
                        </td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700 border-l border-gray-200 pl-2">11103</td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700">5401</td>
                        <td className="py-2.5 text-right pr-2 font-semibold text-gray-700">16486</td>
                        <td className="py-2.5 text-right pr-4 font-semibold" style={{ color: RE }}>10784</td>
                        <td />
                      </tr>

                      {pOpen && <>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400">
                          <th className="py-2 px-2" />
                          <th className="py-2 text-left font-medium"><span className="flex items-center gap-1">Jabatan Pelaksana <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-center font-medium"><span className="flex items-center justify-center gap-1">Kategori <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">ABK <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">PNS <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-2 font-medium"><span className="flex items-center justify-end gap-1">PPPK <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-right pr-4 font-medium"><span className="flex items-center justify-end gap-1">Lowongan <ArrowUpDown size={9} /></span></th>
                          <th className="py-2 text-center pr-4 font-medium">Aksi</th>
                        </tr>

                        {pPage === 1
                          ? PELAKSANA.map(jab => {
                              const lw    = jab.pns + jab.pppk - jab.abk;
                              const isExp = expandedP.has(jab.nama);
                              const totalU = jab.totalUnits ?? jab.units.length;
                              const curUP  = getUP(jab.nama);
                              return (
                                <React.Fragment key={jab.nama}>
                                  {/* Pelaksana jabatan row */}
                                  <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-2 py-2">
                                      <button onClick={() => toggleP(jab.nama)}
                                        className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                                        {isExp ? <Minus size={9} /> : <Plus size={9} />}
                                      </button>
                                    </td>
                                    <td className="py-2 pr-2 text-gray-800">
                                      <span className="flex items-center gap-1">{jab.nama}<Info size={11} className="text-gray-300 flex-shrink-0" /></span>
                                    </td>
                                    <td className="py-2 text-center"><KatBadge k={jab.kategori} /></td>
                                    <td className="py-2 text-right pr-2 font-medium text-gray-700">{fmt(jab.abk)}</td>
                                    <td className="py-2 text-right pr-2 text-gray-600">{fmt(jab.pns)}</td>
                                    <td className="py-2 text-right pr-2 text-gray-600">{fmt(jab.pppk)}</td>
                                    <td className="py-2 text-right pr-4 font-medium" style={{ color: lowColor(lw) }}>{lowFmt(lw)}</td>
                                    {/* col8 Aksi: [Users][EmptySlot][EmptySlot][Trash] */}
                                    <td className="py-2 pr-4">
                                      <div className="flex items-center justify-center gap-1">
                                        <ABtn icon={Users} variant="gray" title="Detail pegawai" />
                                        <EmptySlot />
                                        <EmptySlot />
                                        <ABtn icon={Trash2} variant="red" title="Hapus" />
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Pelaksana unit sub-table */}
                                  {isExp && <>
                                    <tr className="bg-orange-50/20 border-b border-gray-100">
                                      <td /><td colSpan={7} className="py-1.5 pl-6">
                                        <button className="text-[10px] border border-gray-200 rounded px-2 py-0.5 text-gray-500 hover:bg-white flex items-center gap-0.5 transition-colors">
                                          <Plus size={9} />Tambah Baris
                                        </button>
                                      </td>
                                    </tr>
                                    {/* Pelaksana sub-header: col1 col2 [col3 empty] col4 col5 col6 col7 col8 */}
                                    <tr className="bg-orange-50/10 border-b border-gray-100 text-[10px] text-gray-400">
                                      <td />
                                      <td className="py-1.5 pl-6 font-semibold uppercase tracking-wide">Perangkat Daerah</td>
                                      <td />{/* col3 Kategori empty */}
                                      <td className="py-1.5 text-right pr-2 font-semibold">ABK</td>
                                      <td className="py-1.5 text-right pr-2 font-semibold">PNS</td>
                                      <td className="py-1.5 text-right pr-2 font-semibold">PPPK</td>
                                      <td className="py-1.5 text-right pr-4 font-semibold">Lowongan</td>
                                      <td className="py-1.5 text-center pr-4 font-semibold">Aksi</td>
                                    </tr>
                                    {curUP === 1
                                      ? jab.units.slice(0, UNIT_PP).map(u => {
                                          const ulw = u.pns + u.pppk - u.abk;
                                          return (
                                            /* Pelaksana unit row: col1 col2 [col3 empty] col4 col5 col6 col7 col8 */
                                            <tr key={u.nama} className="bg-orange-50/10 border-b border-gray-100 hover:bg-orange-50/20 transition-colors">
                                              <td />
                                              <td className="py-1.5 pl-6 pr-2 text-gray-600">{u.nama}</td>
                                              <td />{/* col3 Kategori empty */}
                                              <td className="py-1.5 text-right pr-2">
                                                <input type="number" defaultValue={u.abk} readOnly
                                                  className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-right focus:outline-none focus:border-orange-300" />
                                              </td>
                                              <td className="py-1.5 text-right pr-2 text-gray-600">{fmt(u.pns)}</td>
                                              <td className="py-1.5 text-right pr-2 text-gray-600">{fmt(u.pppk)}</td>
                                              <td className="py-1.5 text-right pr-4" style={{ color: lowColor(ulw) }}>{lowFmt(ulw)}</td>
                                              {/* col8 Aksi: [Users][EmptySlot][EmptySlot][Trash] */}
                                              <td className="py-1.5 pr-4">
                                                <div className="flex items-center justify-center gap-1">
                                                  <ABtn icon={Users} variant="gray" title="Detail" />
                                                  <EmptySlot />
                                                  <EmptySlot />
                                                  <ABtn icon={Trash2} variant="red" title="Hapus" />
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      : <tr><td colSpan={8} className="py-4 text-center text-[11px] text-gray-400 bg-gray-50/40">Data contoh hanya tersedia di halaman 1</td></tr>
                                    }
                                    {totalU > UNIT_PP && (
                                      <tr><td colSpan={8}><PaginationBar total={totalU} page={curUP} onPage={p => setUP(jab.nama, p)} perPage={UNIT_PP} unit="baris" /></td></tr>
                                    )}
                                  </>}
                                </React.Fragment>
                              );
                            })
                          : <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">Data contoh hanya tersedia di halaman 1</td></tr>
                        }
                      </>}

                      {/* Pelaksana pagination */}
                      <tr><td colSpan={8}><PaginationBar total={44} page={pPage} onPage={setPPage} perPage={20} unit="baris" /></td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── Per Perangkat Daerah ────────────────────────────────── */}
              {abkSubTab === "opd" && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400">
                        <th className="py-2.5 pl-3 w-8" />
                        <th className="py-2.5 pl-2 text-left font-medium">
                          <span className="flex items-center gap-1">Perangkat Daerah <ArrowUpDown size={9} /></span>
                        </th>
                        <th className="py-2.5 pr-2 text-right font-medium">ABK</th>
                        <th className="py-2.5 pr-2 text-right font-medium">PNS</th>
                        <th className="py-2.5 pr-2 text-right font-medium">PPPK</th>
                        <th className="py-2.5 pr-4 text-right font-medium">Lowongan</th>
                        <th className="py-2.5 pr-4 text-center font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opdPageData.map(opd => {
                        const lw    = opd.pns + opd.pppk - opd.abk;
                        const isExp = expandedOPD.has(opd.nama);
                        const jPage = getOJP(opd.nama);
                        const jabSlice = opd.jabatan.slice((jPage - 1) * OPD_JAB_PP, jPage * OPD_JAB_PP);
                        return (
                          <React.Fragment key={opd.nama}>
                            <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                              <td className="pl-3 py-2.5">
                                <button onClick={() => toggleOPD(opd.nama)}
                                  className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                                  {isExp ? <Minus size={9} /> : <Plus size={9} />}
                                </button>
                              </td>
                              <td className="py-2.5 pl-2 pr-2 text-gray-800 font-medium">{opd.nama}</td>
                              <td className="py-2.5 pr-2 text-right font-medium text-gray-700">{fmt(opd.abk)}</td>
                              <td className="py-2.5 pr-2 text-right text-gray-600">{fmt(opd.pns)}</td>
                              <td className="py-2.5 pr-2 text-right text-gray-600">{fmt(opd.pppk)}</td>
                              <td className="py-2.5 pr-4 text-right font-medium" style={{ color: lowColor(lw) }}>{lowFmt(lw)}</td>
                              <td className="py-2.5 pr-4">
                                <div className="flex items-center justify-center">
                                  <ABtn icon={Users} variant="gray" title="Detail pegawai" />
                                </div>
                              </td>
                            </tr>
                            {isExp && (
                              <>
                                {/* Jabatan sub-header */}
                                <tr className="bg-blue-50/20 text-[10px] text-gray-400 border-b border-gray-100">
                                  <td />
                                  <td className="py-1.5 pl-8 font-semibold uppercase tracking-wide">Jabatan</td>
                                  <td className="py-1.5 pr-2 text-right font-semibold">ABK</td>
                                  <td className="py-1.5 pr-2 text-right font-semibold">PNS</td>
                                  <td className="py-1.5 pr-2 text-right font-semibold">PPPK</td>
                                  <td className="py-1.5 pr-4 text-right font-semibold">Lowongan</td>
                                  <td className="py-1.5 pr-4 text-center font-semibold">Aksi</td>
                                </tr>
                                {jabSlice.length === 0 ? (
                                  <tr className="border-b border-gray-100">
                                    <td colSpan={7} className="py-4 text-center text-[11px] text-gray-400 pl-8">Tidak ada jabatan terdaftar</td>
                                  </tr>
                                ) : jabSlice.map(jab => {
                                  const jlw = jab.pns + jab.pppk - jab.abk;
                                  return (
                                    <tr key={jab.nama} className="border-b border-gray-100 hover:bg-gray-50 transition-colors bg-gray-50/30">
                                      <td />
                                      <td className="py-2 pl-8 pr-2 text-gray-700">
                                        <span className="flex items-center">
                                          <Plus size={8} className="text-gray-300 mr-1.5 flex-shrink-0" />
                                          {jab.nama}
                                          {jab.isPelaksana && <PelBadge />}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-2 text-right text-gray-600">{fmt(jab.abk)}</td>
                                      <td className="py-2 pr-2 text-right text-gray-500">{fmt(jab.pns)}</td>
                                      <td className="py-2 pr-2 text-right text-gray-500">{fmt(jab.pppk)}</td>
                                      <td className="py-2 pr-4 text-right" style={{ color: lowColor(jlw) }}>{lowFmt(jlw)}</td>
                                      <td className="py-2 pr-4">
                                        <div className="flex items-center justify-center">
                                          <ABtn icon={Users} variant="gray" title="Detail" />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Per-OPD pagination */}
                                {opd.jabatan.length > 0 && (
                                  <tr className="border-b border-gray-200">
                                    <td colSpan={7}>
                                      <PaginationBar
                                        total={Math.max(opd.jabatan.length, 20)}
                                        page={jPage}
                                        onPage={p => setOJP(opd.nama, p)}
                                        perPage={OPD_JAB_PP}
                                        unit="baris"
                                      />
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  <PaginationBar total={71} page={opdPage} onPage={setOpdPage} perPage={OPD_PP} unit="baris" />
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB PERLU MAPPING ════════════════════════════════════════ */}
          {/* ═══ TAB PERLU MAPPING ════════════════════════════════════════ */}
          {mainTab === "mapping" && (() => {
            const unitBelumCount = MAPPING_UNIT_BELUM.length;
            const jabBelumCount  = MAPPING_JAB_BELUM.length;
            const instBelumCount = instansi2.filter(r => !r.terisi).length;
            const belumAbkCount  = BELUM_ABK.length;

            const mapUnitRows = mapToggle === "belum" ? MAPPING_UNIT_BELUM : MAPPING_UNIT_SUDAH;
            const mapJabRows  = mapToggle === "belum" ? MAPPING_JAB_BELUM  : MAPPING_JAB_SUDAH;

            const inst2Filtered = instansi2
              .filter(r => {
                if (instaFilter === "belum") return !r.terisi;
                if (instaFilter === "sudah") return r.terisi;
                return true;
              })
              .filter(r => !instansiSearch || r.jabatan.toLowerCase().includes(instansiSearch.toLowerCase()));
            const INST_PP = 10;
            const inst2Page = inst2Filtered.slice((instPage - 1) * INST_PP, instPage * INST_PP);

            const allInstIds  = inst2Filtered.map(r => r.id);
            const allInstSel  = allInstIds.length > 0 && allInstIds.every(id => mapInstChecked.has(id));
            const someInstSel = mapInstChecked.size > 0;

            const BELUM_PP = 10;
            const belumFiltered = BELUM_ABK;
            const belumPageData = belumFiltered.slice((belumPage - 1) * BELUM_PP, belumPage * BELUM_PP);
            const allBelumIds   = BELUM_ABK.map((_, i) => i);
            const allBelumSel   = allBelumIds.length > 0 && allBelumIds.every(i => mapBelumChecked.has(i));
            const someBelumSel  = mapBelumChecked.size > 0;

            const subTabs: { id: "unit-kerja" | "jabatan" | "instansi" | "belum"; label: string; badge: number }[] = [
              { id: "unit-kerja", label: "Unit Kerja",       badge: unitBelumCount },
              { id: "jabatan",    label: "Jabatan",          badge: jabBelumCount  },
              { id: "instansi",   label: "Instansi Pembina", badge: instBelumCount },
              { id: "belum",      label: "Belum Ada ABK",    badge: belumAbkCount  },
            ];

            return (
              <div>
                <div className="px-5 pt-3 pb-0">
                  <button onClick={() => onNav?.("opd")}
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors">
                    Buka di halaman penuh<ChevronRight size={11} />
                  </button>
                </div>

                {/* Sub-tabs with badges */}
                <div className="flex border-b border-gray-100 px-0 mt-1">
                  {subTabs.map(t => (
                    <button key={t.id} onClick={() => setMapSubTab(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${mapSubTab === t.id ? "" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                      style={mapSubTab === t.id ? { borderBottomColor: ACCENT, color: ACCENT } : {}}>
                      {t.label}
                      {t.badge > 0 && (
                        <span className="flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] leading-none"
                          style={mapSubTab === t.id
                            ? { backgroundColor: ACCENT, color: "white" }
                            : { backgroundColor: "#FEE2E2", color: RE }}>
                          {t.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ─── Unit Kerja ─────────────────────────────────────────── */}
                {mapSubTab === "unit-kerja" && (
                  <div>
                    {/* Toggle */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                      {(["belum","sudah"] as const).map(v => (
                        <button key={v} onClick={() => setMapToggle(v)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
                          style={mapToggle === v
                            ? { backgroundColor: ACCENT_L, color: ACCENT, borderColor: ACCENT }
                            : { color: GY, backgroundColor: "white", borderColor: "#E5E7EB" }}>
                          {v === "belum" ? "Belum dipadankan" : "Sudah dipadankan"}
                        </button>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                            <th className="py-2 pl-4 text-left font-medium">Nama di Sistem Lama</th>
                            <th className="py-2 pr-4 text-right font-medium">Jumlah Pegawai</th>
                            {mapToggle === "belum" && <th className="py-2 pr-4 text-left font-medium">Usulan Padanan</th>}
                            {mapToggle === "belum" && <th className="py-2 pr-4 text-right font-medium">Kemiripan</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(mapUnitRows as (MappingBelumRow | MappingSudahRow)[]).map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 pl-4 pr-2 text-gray-800">{row.nama}</td>
                              <td className="py-2.5 pr-4 text-right text-gray-600">{fmt(row.jumlah)}</td>
                              {mapToggle === "belum" && <td className="py-2.5 pr-4 text-gray-500">{(row as MappingBelumRow).usulan}</td>}
                              {mapToggle === "belum" && (
                                <td className="py-2.5 pr-4 text-right">
                                  <span className="font-semibold"
                                    style={{ color: (row as MappingBelumRow).persen >= 80 ? GR : (row as MappingBelumRow).persen >= 60 ? AM : RE }}>
                                    {(row as MappingBelumRow).persen}%
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── Jabatan ─────────────────────────────────────────────── */}
                {mapSubTab === "jabatan" && (
                  <div>
                    {/* Toggle */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                      {(["belum","sudah"] as const).map(v => (
                        <button key={v} onClick={() => setMapToggle(v)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
                          style={mapToggle === v
                            ? { backgroundColor: ACCENT_L, color: ACCENT, borderColor: ACCENT }
                            : { color: GY, backgroundColor: "white", borderColor: "#E5E7EB" }}>
                          {v === "belum" ? "Belum dipadankan" : "Sudah dipadankan"}
                        </button>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                            <th className="py-2 pl-4 text-left font-medium">Nama di Sistem Lama</th>
                            <th className="py-2 pr-4 text-right font-medium">Jumlah Pegawai</th>
                            {mapToggle === "belum" && <th className="py-2 pr-4 text-left font-medium">Usulan Padanan</th>}
                            {mapToggle === "belum" && <th className="py-2 pr-4 text-right font-medium">Kemiripan</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(mapJabRows as (MappingBelumRow | MappingSudahRow)[]).map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 pl-4 pr-2 text-gray-800">{row.nama}</td>
                              <td className="py-2.5 pr-4 text-right text-gray-600">{fmt(row.jumlah)}</td>
                              {mapToggle === "belum" && <td className="py-2.5 pr-4 text-gray-500">{(row as MappingBelumRow).usulan}</td>}
                              {mapToggle === "belum" && (
                                <td className="py-2.5 pr-4 text-right">
                                  <span className="font-semibold"
                                    style={{ color: (row as MappingBelumRow).persen >= 80 ? GR : (row as MappingBelumRow).persen >= 60 ? AM : RE }}>
                                    {(row as MappingBelumRow).persen}%
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── Instansi Pembina ──────────────────────────────────── */}
                {mapSubTab === "instansi" && (
                  <div>
                    {/* Mass action bar */}
                    {someInstSel && (
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 border-b border-orange-100">
                        <span className="text-xs font-medium" style={{ color: ACCENT }}>{mapInstChecked.size} dipilih</span>
                        <button onClick={() => {
                          setInstansi2(prev => prev.map(r => mapInstChecked.has(r.id) ? { ...r, terisi: true } : r));
                          setMapInstChecked(new Set());
                        }} className="px-3 py-1 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: ACCENT }}>
                          Tandai Terisi
                        </button>
                        <button onClick={() => setMapInstChecked(new Set())}
                          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                          Batal Pilih
                        </button>
                      </div>
                    )}
                    {/* Filter pills */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
                      {(["belum","sudah","semua"] as const).map(f => {
                        const labels = { belum: "Belum terisi", sudah: "Sudah terisi", semua: "Semua jabatan" };
                        return (
                          <button key={f} onClick={() => { setInstaFilter(f); setInstPage(1); setMapInstChecked(new Set()); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors border"
                            style={instaFilter === f
                              ? { backgroundColor: ACCENT_L, color: ACCENT, borderColor: ACCENT }
                              : { color: GY, backgroundColor: "white", borderColor: "#E5E7EB" }}>
                            {labels[f]}
                          </button>
                        );
                      })}
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={instansiSearch} onChange={e => { setInstansiSearch(e.target.value); setInstPage(1); }}
                          placeholder="Cari nama jabatan…"
                          className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 w-52" />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                            <th className="py-2 pl-3 w-8">
                              <button onClick={() => {
                                if (allInstSel) {
                                  setMapInstChecked(prev => { const s = new Set(prev); allInstIds.forEach(id => s.delete(id)); return s; });
                                } else {
                                  setMapInstChecked(prev => { const s = new Set(prev); allInstIds.forEach(id => s.add(id)); return s; });
                                }
                              }} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                                {allInstSel ? <CheckSquare size={13} /> : <Square size={13} />}
                              </button>
                            </th>
                            <th className="py-2 pr-4 text-left font-medium">Jabatan</th>
                            <th className="py-2 pr-4 text-right font-medium">Rincian</th>
                            <th className="py-2 pr-4 text-left font-medium" style={{ minWidth: 180 }}>Instansi Pembina</th>
                            <th className="py-2 pr-4 text-left font-medium" style={{ minWidth: 180 }}>Dinas Pengampu</th>
                            <th className="py-2 pr-4 font-medium w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {inst2Page.map(row => (
                            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 pl-3">
                                <button onClick={() => setMapInstChecked(prev => {
                                  const s = new Set(prev); s.has(row.id) ? s.delete(row.id) : s.add(row.id); return s;
                                })} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                                  {mapInstChecked.has(row.id) ? <CheckSquare size={13} style={{ color: ACCENT }} /> : <Square size={13} />}
                                </button>
                              </td>
                              <td className="py-2.5 pr-4 text-gray-800">{row.jabatan}</td>
                              <td className="py-2.5 pr-4 text-right text-gray-500">{row.rincian} baris</td>
                              <td className="py-2.5 pr-4">
                                <input type="text" defaultValue={row.instansi} placeholder="Instansi pembina…"
                                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300" />
                              </td>
                              <td className="py-2.5 pr-4">
                                <select defaultValue={row.dinas}
                                  className="w-full py-1 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 bg-white">
                                  <option value="">Pilih perangkat daerah…</option>
                                  {OPD_LIST.map(o => <option key={o}>{o}</option>)}
                                </select>
                              </td>
                              <td className="py-2.5 pr-4 text-right">
                                {row.terisi
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">sudah terisi</span>
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: ACCENT_L, color: ACCENT }}>belum terisi</span>
                                }
                              </td>
                            </tr>
                          ))}
                          {inst2Page.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-gray-400">Tidak ada data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <PaginationBar total={inst2Filtered.length} page={instPage} onPage={setInstPage} perPage={INST_PP} unit="jabatan" />
                  </div>
                )}

                {/* ─── Belum Ada ABK ─────────────────────────────────────── */}
                {mapSubTab === "belum" && (
                  <div>
                    {/* Mass action bar */}
                    {someBelumSel && (
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-50 border-b border-orange-100">
                        <span className="text-xs font-medium" style={{ color: ACCENT }}>{mapBelumChecked.size} dipilih</span>
                        <button className="px-3 py-1 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: ACCENT }}
                          onClick={() => setMapBelumChecked(new Set())}>
                          Buat ABK
                        </button>
                        <button onClick={() => setMapBelumChecked(new Set())}
                          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                          Batal Pilih
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                            <th className="py-2 pl-3 w-8">
                              <button onClick={() => {
                                if (allBelumSel) {
                                  setMapBelumChecked(new Set());
                                } else {
                                  setMapBelumChecked(new Set(allBelumIds));
                                }
                              }} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                                {allBelumSel ? <CheckSquare size={13} /> : <Square size={13} />}
                              </button>
                            </th>
                            <th className="py-2 pr-4 text-left font-medium">Perangkat Daerah</th>
                            <th className="py-2 pr-4 text-left font-medium">Jabatan</th>
                            <th className="py-2 pr-4 text-left font-medium">Jenjang</th>
                            <th className="py-2 pr-4 text-right font-medium">Bezetting PNS</th>
                            <th className="py-2 pr-4 text-right font-medium">Bezetting PPPK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {belumPageData.map((row, i) => {
                            const globalIdx = (belumPage - 1) * BELUM_PP + i;
                            return (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-2.5 pl-3">
                                  <button onClick={() => setMapBelumChecked(prev => {
                                    const s = new Set(prev); s.has(globalIdx) ? s.delete(globalIdx) : s.add(globalIdx); return s;
                                  })} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                                    {mapBelumChecked.has(globalIdx) ? <CheckSquare size={13} style={{ color: ACCENT }} /> : <Square size={13} />}
                                  </button>
                                </td>
                                <td className="py-2.5 pr-4 font-semibold text-gray-700 text-[11px] uppercase tracking-wide">{row.pd}</td>
                                <td className="py-2.5 pr-4 text-gray-700">{row.jabatan}</td>
                                <td className="py-2.5 pr-4 text-gray-500">{row.jenjang}</td>
                                <td className="py-2.5 pr-4 text-right text-gray-700">{row.pns}</td>
                                <td className="py-2.5 pr-4 text-right text-gray-700">{row.pppk}</td>
                              </tr>
                            );
                          })}
                          {belumPageData.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-gray-400">Tidak ada data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <PaginationBar total={belumFiltered.length} page={belumPage} onPage={setBelumPage} perPage={BELUM_PP} unit="baris" />
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══ TAB DASAR HUKUM ══════════════════════════════════════════ */}
          {mainTab === "hukum" && (() => {
            const dhFiltered = dhRows.filter(r => {
              const status = hitungDhStatus(r.berlakuHingga);
              if (dhTipe   !== "semua" && r.tipe   !== dhTipe)   return false;
              if (dhJenis  !== "semua" && !r.jenis.toLowerCase().includes(dhJenis.toLowerCase())) return false;
              if (dhStatus !== "semua" && status   !== dhStatus)  return false;
              if (dhSearch && !r.nomor.toLowerCase().includes(dhSearch.toLowerCase()) &&
                              !r.perihal.toLowerCase().includes(dhSearch.toLowerCase())) return false;
              return true;
            });
            const DH_PP = 20;
            const dhPageData = dhFiltered.slice((dhPage - 1) * DH_PP, dhPage * DH_PP);

            return (
              <div>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
                  <select value={dhTipe} onChange={e => { setDhTipe(e.target.value); setDhPage(1); }}
                    className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 bg-white">
                    <option value="semua">Semua tipe</option>
                    {["Rekom","Persetujuan","Distribusi"].map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select value={dhJenis} onChange={e => { setDhJenis(e.target.value); setDhPage(1); }}
                    className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 bg-white">
                    <option value="semua">Semua jenis</option>
                    <option>Jabatan Fungsional</option><option>Jabatan Pelaksana</option>
                  </select>
                  <select value={dhStatus} onChange={e => { setDhStatus(e.target.value); setDhPage(1); }}
                    className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300 bg-white">
                    <option value="semua">Semua status</option>
                    <option>Berlaku</option><option>Segera berakhir</option><option>Kedaluwarsa</option>
                  </select>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <input value={dhSearch} onChange={e => { setDhSearch(e.target.value); setDhPage(1); }}
                      placeholder="Cari nomor atau perihal..."
                      className="pl-3 pr-2 py-1.5 text-xs focus:outline-none w-52 border-r border-gray-200" />
                    <button className="px-3 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50"><Search size={12} /></button>
                  </div>
                  <div className="ml-auto">
                    <button onClick={() => setDhModal({ type: "upload" })}
                      className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: ACCENT }}>
                      <Plus size={11} />Unggah Dasar Hukum
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                        <th className="py-2 pl-4 text-left font-medium w-24">Tipe</th>
                        <th className="py-2 pr-4 text-left font-medium" style={{ minWidth: 140 }}>Nomor</th>
                        <th className="py-2 pr-4 text-left font-medium" style={{ minWidth: 200 }}>Perihal</th>
                        <th className="py-2 pr-4 text-left font-medium w-40">Masa Berlaku</th>
                        <th className="py-2 pr-4 text-left font-medium w-32">Status</th>
                        <th className="py-2 pr-4 text-center font-medium w-16">Jabatan</th>
                        <th className="py-2 pr-4 text-center font-medium w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {dhPageData.map(row => {
                        const status = hitungDhStatus(row.berlakuHingga);
                        return (
                          <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 pl-4 pr-2"><TipeBadge t={row.tipe} /></td>
                            <td className="py-3 pr-4">
                              <p className="font-mono font-semibold text-gray-800 text-[11px]">{row.nomor}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{row.penerbit}</p>
                            </td>
                            <td className="py-3 pr-4 text-gray-700 leading-relaxed">{row.perihal}</td>
                            <td className="py-3 pr-4 text-gray-500 text-[11px]">
                              <p>{fmtTgl(row.berlakuDari)}</p>
                              <p className="text-gray-400">→ {fmtTgl(row.berlakuHingga)}</p>
                            </td>
                            <td className="py-3 pr-4"><DhStatusDot status={status} /></td>
                            <td className="py-3 pr-4 text-center text-gray-700">{row.jabatan}</td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center justify-center gap-1">
                                <ABtn icon={Eye}    variant="gray" title="Lihat"  onClick={() => setDhModal({ type: "preview", row })} />
                                <ABtn icon={Pencil} variant="gray" title="Sunting" onClick={() => setDhModal({ type: "edit", row })} />
                                <ABtn icon={Trash2} variant="red"  title="Hapus"  onClick={() => setDhModal({ type: "hapus", row })} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {dhPageData.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-400">Tidak ada data yang sesuai filter</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationBar total={dhFiltered.length} page={dhPage} onPage={setDhPage} perPage={DH_PP} unit="dasar hukum" />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Drawers */}
      {aiTarget && <AIInsightDrawer target={aiTarget} onClose={() => setAiTarget(null)} />}
      {dhTarget  && <DasarHukumDrawer jabatan={dhTarget} onClose={() => setDhTarget(null)}
        onOpenUpload={(tipe, jab) => { setDhTarget(null); setDhModal({ type: "upload", autoTipe: tipe, autoJabatan: jab }); }} />}

      {/* Dasar Hukum Modals */}
      {dhModal?.type === "preview" && <PdfPreviewModal row={dhModal.row} onClose={() => setDhModal(null)} />}
      {dhModal?.type === "edit" && (
        <DhFormModal mode="edit" row={dhModal.row} onClose={() => setDhModal(null)}
          onSave={updated => {
            setDhRows(prev => prev.map(r => r.id === updated.id ? updated : r));
            setDhModal(null);
            setAppToast("Dasar hukum disimpan");
          }} />
      )}
      {dhModal?.type === "upload" && (
        <DhFormModal mode="upload" autoTipe={dhModal.autoTipe} autoJabatan={dhModal.autoJabatan}
          onClose={() => setDhModal(null)}
          onSave={newRow => {
            setDhRows(prev => [...prev, newRow]);
            setDhModal(null);
            setAppToast("Dasar hukum disimpan");
          }} />
      )}
      {dhModal?.type === "hapus" && (
        <HapusConfirmModal row={dhModal.row} onClose={() => setDhModal(null)}
          onConfirm={() => {
            setDhRows(prev => prev.filter(r => r.id !== dhModal.row.id));
            setDhModal(null);
          }} />
      )}

      {/* Toast */}
      {appToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ backgroundColor: GR }}>
          {appToast}
        </div>
      )}
    </div>
  );
}
