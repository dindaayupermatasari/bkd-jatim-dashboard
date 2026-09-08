import React, { useState } from "react";
import {
  Search, Download, Info, ChevronUp, ChevronDown, Shield, Layers,
  AlertTriangle, ArrowRight, Users, Clock,
} from "lucide-react";
import { C, GRAD, fmt, riskLabel, riskColor, OPD_DATA, OPD_SKOR_OPT } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge } from "../lib/ui";

const PAGE_SIZE = 10;
const TOTAL_OPD = 56;

// ── Enhanced OPD data — Level 1 + 2 (Operational view) ───────────────────────

type JenisJabatan = "Struktural" | "Fungsional" | "Pelaksana";
interface JabatanEntry { jabatan: string; jenis: JenisJabatan; count: number }
interface KriteriaEntry { label: string; val: number; max: number }

interface EnhancedOPD {
  id: number; nama: string; skor: number; total: number;
  pensiun12: { count: number; pct: number };
  alasan: string;
  rekomendasi: string;
  detail: {
    pensiun06: JabatanEntry[];
    pensiun612: JabatanEntry[];
    kriteriaScore: KriteriaEntry[];
    strukturalKosong: number;
    rekDetail: string;
  };
}

const ENHANCED_DATA: EnhancedOPD[] = [
  {
    id: 1, nama: "Dinas Pendidikan", skor: 42, total: 52809,
    pensiun12: { count: 758, pct: 1.4 },
    alasan: "758 guru pensiun serentak 2027; 8 jabatan Pengawas kosong dalam 6 bulan",
    rekomendasi: "Ajukan 420 formasi JF Guru + 8 mutasi pengisi jabatan Pengawas",
    detail: {
      pensiun06: [
        { jabatan: "Pengawas Sekolah (Eselon IV)", jenis: "Struktural", count: 8   },
        { jabatan: "JF Guru Madya",                jenis: "Fungsional", count: 241 },
        { jabatan: "Pelaksana Umum",               jenis: "Pelaksana",  count: 12  },
      ],
      pensiun612: [
        { jabatan: "JF Guru Pertama/Muda", jenis: "Fungsional", count: 517 },
        { jabatan: "Pelaksana Umum",       jenis: "Pelaksana",  count: 33  },
      ],
      kriteriaScore: [
        { label: "Usia rata-rata 46 thn",     val: 35, max: 40 },
        { label: "BUP — 758 dalam 12 bulan",  val: 27, max: 30 },
        { label: "Jenis Jabatan",              val: 14, max: 20 },
        { label: "Klaster SDM",               val: 6,  max: 10 },
      ],
      strukturalKosong: 8,
      rekDetail: "Prioritaskan 420 formasi JF Guru pada CPNS 2025–2026. Ajukan 8 mutasi internal untuk mengisi Pengawas Sekolah yang akan kosong dalam 6 bulan. Koordinasi dengan Kemendikbud untuk skema PPPK Guru 2026.",
    }
  },
  {
    id: 2, nama: "Dinas Kelautan & Perikanan", skor: 51, total: 876,
    pensiun12: { count: 89, pct: 10.2 },
    alasan: "10,2% pegawai pensiun dalam setahun; 3 posisi Eselon III tanpa kandidat pengganti",
    rekomendasi: "Ajukan 3 mutasi lintas OPD untuk Eselon III + rekrutmen 12 Fungsional Teknis",
    detail: {
      pensiun06: [
        { jabatan: "Kepala Bidang (Eselon III)", jenis: "Struktural", count: 3  },
        { jabatan: "JF Penyuluh Perikanan",      jenis: "Fungsional", count: 31 },
      ],
      pensiun612: [
        { jabatan: "JF Penyuluh Perikanan", jenis: "Fungsional", count: 55 },
        { jabatan: "Pelaksana Teknis",      jenis: "Pelaksana",  count: 7  },
      ],
      kriteriaScore: [
        { label: "Usia rata-rata 49 thn",      val: 38, max: 40 },
        { label: "BUP — 10,2% dalam 12 bulan", val: 25, max: 30 },
        { label: "Jenis Jabatan",               val: 12, max: 20 },
        { label: "Klaster SDM",                val: 7,  max: 10 },
      ],
      strukturalKosong: 3,
      rekDetail: "Ajukan 3 mutasi lintas OPD untuk mengisi Kepala Bidang. Buka rekrutmen 12 Fungsional Penyuluh Perikanan. Laporkan kekosongan struktural ke BKD dalam 30 hari untuk tindak lanjut darurat.",
    }
  },
  {
    id: 3, nama: "Dinas PU Bina Marga", skor: 54, total: 3120,
    pensiun12: { count: 89, pct: 2.9 },
    alasan: "2 posisi JPT Pratama (Eselon II) akan kosong dalam 6 bulan tanpa kandidat siap",
    rekomendasi: "Segera ajukan 2 nominasi JPT Pratama ke Pansel + rekrutmen 24 JF Teknis Sipil",
    detail: {
      pensiun06: [
        { jabatan: "JPT Pratama (Eselon II)", jenis: "Struktural", count: 2  },
        { jabatan: "JF Teknik Sipil",         jenis: "Fungsional", count: 28 },
      ],
      pensiun612: [
        { jabatan: "JF Teknik Sipil", jenis: "Fungsional", count: 61 },
      ],
      kriteriaScore: [
        { label: "Usia rata-rata 44 thn",    val: 28, max: 40 },
        { label: "BUP — 2,9% dalam 12 bln", val: 18, max: 30 },
        { label: "Jenis Jabatan (JPT)",       val: 18, max: 20 },
        { label: "Klaster SDM",              val: 8,  max: 10 },
      ],
      strukturalKosong: 2,
      rekDetail: "Segera proses 2 nominasi JPT Pratama ke Panitia Seleksi (Pansel). Rekrut 24 JF Teknik Sipil untuk menggantikan yang pensiun 6–12 bulan ke depan. Prioritas struktural lebih tinggi meski persentase pensiun kecil.",
    }
  },
  {
    id: 4, nama: "Dinas Kesehatan", skor: 61, total: 8920,
    pensiun12: { count: 334, pct: 3.7 },
    alasan: "334 tenaga kesehatan pensiun dalam setahun; 4 jabatan Pengawas akan kosong",
    rekomendasi: "Rekrut 200 PPPK Tenaga Kesehatan + 4 mutasi internal Pengawas (Eselon IV)",
    detail: {
      pensiun06: [
        { jabatan: "Pengawas (Eselon IV)", jenis: "Struktural", count: 4  },
        { jabatan: "JF Dokter/Perawat",    jenis: "Fungsional", count: 98 },
      ],
      pensiun612: [
        { jabatan: "JF Dokter/Perawat", jenis: "Fungsional", count: 236 },
      ],
      kriteriaScore: [
        { label: "Usia rata-rata 43 thn",    val: 26, max: 40 },
        { label: "BUP — 3,7% dalam 12 bln", val: 20, max: 30 },
        { label: "Jenis Jabatan",             val: 13, max: 20 },
        { label: "Klaster SDM",              val: 5,  max: 10 },
      ],
      strukturalKosong: 4,
      rekDetail: "Rekrut 200 PPPK Tenaga Kesehatan melalui skema khusus nakes. Ajukan 4 mutasi internal untuk mengisi Pengawas (Eselon IV). Koordinasi dengan Kemenkes untuk formasi dokter spesialis.",
    }
  },
];

const JENIS_STYLE: Record<JenisJabatan, string> = {
  Struktural: "bg-red-50 text-red-700 border border-red-200",
  Fungsional: "bg-blue-50 text-blue-700 border border-blue-200",
  Pelaksana:  "bg-gray-100 text-gray-600 border border-gray-200",
};

const KRITERIA_COLORS = [C.coral, C.amber, C.blue, C.teal];

const gaOptScore = (id: number): number =>
  OPD_SKOR_OPT["GA"][id] ?? (OPD_DATA.find(o => o.id === id)?.skor ?? 0);

// ── Level 2 detail panel ──────────────────────────────────────────────────────

const Level2Panel = ({ opd }: { opd: EnhancedOPD }) => {
  const { detail } = opd;
  const total06  = detail.pensiun06.reduce((s, d)  => s + d.count, 0);
  const total612 = detail.pensiun612.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-5 pb-5 pt-3">

      {/* KPI mini-cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Pegawai",         val: fmt(opd.total),            sub: "aktif saat ini",               color: C.blue  },
          { label: "Pensiun 0–6 Bulan",     val: String(total06),           sub: "segera — perlu tindakan kini", color: C.coral },
          { label: "Pensiun 6–12 Bulan",    val: String(total612),          sub: "perlu disiapkan pengganti",    color: C.amber },
          { label: "Jabatan Struktural ⚠",  val: String(detail.strukturalKosong), sub: "posisi kritis — hanya bisa PNS", color: C.red },
        ].map(({ label, val, sub, color }) => (
          <div key={label} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
            <p className="text-[11px] text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-black leading-none" style={{ color, fontFamily: "var(--font-display)" }}>{val}</p>
            <p className="text-[10px] text-gray-400 mt-1 leading-snug">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        {/* Jabatan breakdown */}
        <div className="col-span-3 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">Jabatan Berisiko per Rentang Waktu</p>
          <div className="space-y-4">
            {([
              { label: "0–6 Bulan — Tindakan Segera", entries: detail.pensiun06,  pillCls: "text-red-700 bg-red-50"    },
              { label: "6–12 Bulan — Perlu Disiapkan", entries: detail.pensiun612, pillCls: "text-amber-700 bg-amber-50" },
            ] as const).map(({ label, entries, pillCls }) => (
              <div key={label}>
                <p className={`text-[11px] font-bold px-2 py-0.5 rounded-full w-fit mb-2 ${pillCls}`}>{label}</p>
                <div className="space-y-2">
                  {entries.filter(e => e.count > 0).map(e => (
                    <div key={e.jabatan} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${JENIS_STYLE[e.jenis]}`}>
                          {e.jenis.slice(0, 3)}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{e.jabatan}</span>
                      </div>
                      <span className="text-sm font-black flex-shrink-0"
                        style={{ fontFamily: "var(--font-mono)", color: e.jenis === "Struktural" ? C.coral : "#374151" }}>
                        {e.count} orang
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {detail.strukturalKosong > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-red-600 flex-shrink-0" />
              <p className="text-[11px] text-red-700 font-semibold leading-snug">
                {detail.strukturalKosong} jabatan struktural berisiko kosong — hanya bisa diisi PNS, tidak bisa PPPK.
              </p>
            </div>
          )}
        </div>

        {/* Skor per kriteria */}
        <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">Kontribusi Skor per Kriteria</p>
          <div className="space-y-3.5">
            {detail.kriteriaScore.map(({ label, val, max }, i) => {
              const color = KRITERIA_COLORS[i];
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-gray-600 leading-tight">{label}</span>
                    <span className="text-xs font-black" style={{ fontFamily: "var(--font-mono)", color }}>
                      {val}/{max}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(val / max) * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-700">Total Skor Risiko</span>
                <span className="text-lg font-black" style={{ fontFamily: "var(--font-display)", color: riskColor(opd.skor) }}>
                  {opd.skor}/100
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${opd.skor}%`, backgroundColor: riskColor(opd.skor) }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rekomendasi Tindak Lanjut */}
      <div className="flex items-start gap-3 bg-slate-800 rounded-xl p-4">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ArrowRight size={13} className="text-white" />
        </div>
        <div>
          <p className="text-white text-xs font-bold mb-1.5">Rekomendasi Tindak Lanjut</p>
          <p className="text-slate-300 text-sm leading-relaxed">{detail.rekDetail}</p>
        </div>
      </div>
    </div>
  );
};

// ── Operational Tab (Level 1 + 2) ─────────────────────────────────────────────

const OperasionalTab = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const kritisItems = ENHANCED_DATA
    .map(opd => ({ ...opd, skor: gaOptScore(opd.id) }))
    .filter(opd => riskLabel(opd.skor) === "Kritis");

  return (
    <div>
      {/* Context note */}
      <div className="mb-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-snug">
          Menampilkan <strong>{kritisItems.length} OPD berstatus Kritis</strong> berdasarkan skor optimasi GA (pensiun riil, jabatan berisiko, rekomendasi tindak lanjut). Klik baris untuk melihat detail. Untuk daftar lengkap 56 OPD, buka tab <strong>Analitik Lanjutan</strong>.
        </p>
      </div>

      {/* Level 1 table */}
      <Card className="p-0 overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-48">Nama OPD</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-36">Pensiun ≤12 Bulan</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-24">Skor Risiko (GA)</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Alasan Utama</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Rekomendasi Singkat</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {kritisItems.map(opd => {
              const isOpen = expanded === opd.id;
              const label = riskLabel(opd.skor);
              const color = riskColor(opd.skor);
              return (
                <React.Fragment key={opd.id}>
                  <tr className={`border-b transition-colors cursor-pointer group ${isOpen ? "bg-slate-50 border-slate-200" : "border-gray-100 hover:bg-gray-50"}`}
                    onClick={() => setExpanded(isOpen ? null : opd.id)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <StatusBadge status={label} />
                      </div>
                      <p className="text-sm font-bold text-gray-900">{opd.nama}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmt(opd.total)} ASN</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-lg font-black leading-none" style={{ color: opd.pensiun12.pct > 5 ? C.coral : C.amber, fontFamily: "var(--font-display)" }}>
                        {opd.pensiun12.count}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">pegawai ({opd.pensiun12.pct}%)</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xl font-black" style={{ color, fontFamily: "var(--font-display)" }}>{opd.skor}</span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${opd.skor}%`, backgroundColor: color }} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-gray-700 leading-snug line-clamp-2">{opd.alasan}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-gray-700 leading-snug line-clamp-2">{opd.rekomendasi}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 group-hover:text-gray-600">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <Level2Panel opd={opd} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap px-1">
        {[
          { jenis: "Struktural" as JenisJabatan, desc: "Hanya bisa diisi PNS — prioritas darurat" },
          { jenis: "Fungsional" as JenisJabatan, desc: "Bisa diisi PPPK — perlu rekrutmen" },
          { jenis: "Pelaksana"  as JenisJabatan, desc: "Bisa diisi PPPK — antisipasi formasi" },
        ].map(({ jenis, desc }) => (
          <div key={jenis} className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${JENIS_STYLE[jenis]}`}>{jenis.slice(0,3)}</span>
            <span className="text-[11px] text-gray-500">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main OPD Page ─────────────────────────────────────────────────────────────

const OPDPage = () => {
  const [mainTab, setMainTab] = useState<"operasional" | "analitik">("operasional");

  // ── Analitik tab state ────────────────────────────────────────────────────
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState("skor");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [riskView, setRiskView] = useState<"komposit" | "struktural" | "fungsional">("komposit");
  const [riskFilter, setRiskFilter] = useState("Semua");
  const [page, setPage]         = useState(1);

  const filteredRows = OPD_DATA
    .filter(o => o.nama.toLowerCase().includes(search.toLowerCase()))
    .filter(o => {
      if (riskFilter === "Semua") return true;
      const sk = riskView === "struktural" ? o.skorStk : riskView === "fungsional" ? o.skorFnk : gaOptScore(o.id);
      return riskLabel(sk) === riskFilter;
    })
    .sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortKey === "skor") {
        av = riskView === "struktural" ? a.skorStk : riskView === "fungsional" ? a.skorFnk : gaOptScore(a.id);
        bv = riskView === "struktural" ? b.skorStk : riskView === "fungsional" ? b.skorFnk : gaOptScore(b.id);
      } else {
        av = (a as any)[sortKey]; bv = (b as any)[sortKey];
      }
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const rows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(Math.max(TOTAL_OPD, filteredRows.length) / PAGE_SIZE);

  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ k }: { k: string }) => sortKey === k
    ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : <ChevronDown size={12} className="text-gray-300" />;

  const activeSkor = (opd: typeof OPD_DATA[0]) =>
    riskView === "struktural" ? opd.skorStk : riskView === "fungsional" ? opd.skorFnk : gaOptScore(opd.id);

  return (
    <div className="p-6">
      <PageHeader
        title="Perbandingan Antar OPD"
        subtitle="Ranking skor risiko regenerasi — 56 OPD Provinsi Jawa Timur"
        crumbs={["Perbandingan Antar OPD"]}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5 w-fit mb-5">
        {([
          { key: "operasional", label: "Operasional",       desc: "Pensiun, alasan, rekomendasi" },
          { key: "analitik",    label: "Analitik Lanjutan", desc: "Skor komposit 56 OPD" },
        ] as const).map(({ key, label, desc }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`px-4 py-2 rounded-xl transition-all text-left ${mainTab === key ? "bg-white shadow-sm" : "hover:bg-gray-50"}`}>
            <p className={`text-sm font-bold leading-none ${mainTab === key ? "text-blue-700" : "text-gray-600"}`}>{label}</p>
            <p className={`text-[11px] mt-0.5 ${mainTab === key ? "text-blue-500" : "text-gray-400"}`}>{desc}</p>
          </button>
        ))}
      </div>

      {/* ── Operasional Tab ── */}
      {mainTab === "operasional" && <OperasionalTab />}

      {/* ── Analitik Lanjutan Tab ── */}
      {mainTab === "analitik" && (
        <>
          {/* Structural vs Functional callout */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-700 mb-1">Risiko Struktural (JPT · Administrator · Pengawas)</p>
                <p className="text-xs text-blue-600 leading-snug">Jabatan ini <strong>hanya bisa diisi PNS</strong>. PPPK tidak dapat menduduki jabatan struktural, sehingga kekosongan tidak bisa ditutupi meski ada PPPK tersedia.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-2xl p-4">
              <Layers size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-teal-700 mb-1">Risiko Fungsional/Teknis (JF Guru · JF Medis · Pelaksana)</p>
                <p className="text-xs text-teal-600 leading-snug">Jabatan fungsional dan pelaksana <strong>dapat diisi PPPK</strong> sesuai klaster. Kekosongan massal tetap berisiko jika rekrutmen tidak diantisipasi.</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["komposit","struktural","fungsional"] as const).map(v => (
                <button key={v} onClick={() => { setRiskView(v); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${riskView === v ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
                  {v === "komposit" ? "Skor Komposit" : v === "struktural" ? "Risiko Struktural" : "Risiko Fungsional"}
                </button>
              ))}
            </div>
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Cari nama OPD..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30" />
            </div>
            <div className="relative">
              <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 cursor-pointer font-semibold text-gray-700">
                <option value="Semua">Semua Status</option>
                <option value="Kritis">Kritis</option>
                <option value="Waspada">Waspada</option>
                <option value="Aman">Aman</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 min-h-[36px]"
              style={{ background: GRAD.blue }}>
              <Download size={14} /> Unduh Excel
            </button>
          </div>

          {/* Table */}
          <Card className="p-0 overflow-hidden mb-3">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { k: "nama", l: "Nama OPD" },
                    { k: "skor", l: riskView === "struktural" ? "Risiko Struktural" : riskView === "fungsional" ? "Risiko Fungsional" : "Risiko Komposit" },
                  ].map(({ k, l }) => (
                    <th key={k} onClick={() => handleSort(k)}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-500 select-none cursor-pointer hover:text-gray-700">
                      <div className="flex items-center gap-1">{l}<SortIcon k={k} /></div>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map(opd => {
                  const sk    = activeSkor(opd);
                  const label = riskLabel(sk);
                  const color = riskColor(sk);
                  const isOpen = expanded === opd.id;
                  return (
                    <React.Fragment key={opd.id}>
                      <tr className={`border-b border-gray-100 cursor-pointer transition-colors group ${isOpen ? "bg-blue-50 border-blue-100" : "hover:bg-gray-50"}`}
                        onClick={() => setExpanded(isOpen ? null : opd.id)}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900">{opd.nama}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-20">
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                                <div className="h-full rounded-full" style={{ width: `${sk}%`, backgroundColor: color }} />
                              </div>
                            </div>
                            <span className="text-base font-black w-8 text-right flex-shrink-0" style={{ color, fontFamily: "var(--font-mono)" }}>{sk}</span>
                            <StatusBadge status={label} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 group-hover:text-gray-600">
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-blue-100 bg-blue-50">
                          <td colSpan={3} className="px-5 py-4">
                            {/* Detail stats row */}
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              {[
                                { label: "Total ASN",      val: fmt(opd.total),        mono: true  },
                                { label: "Rata-rata Usia", val: `${opd.rataUsia} tahun`, mono: false },
                                { label: "Usia di atas 50 tahun",  val: `${opd.pctTua}%`, mono: false },
                              ].map(({ label, val, mono }) => (
                                <div key={label} className="bg-white rounded-xl p-3 border border-blue-200">
                                  <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
                                  <p className="text-lg font-black text-gray-900" style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)" }}>{val}</p>
                                </div>
                              ))}
                            </div>
                            {/* Skor breakdown */}
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: "Skor Komposit (GA)",    val: gaOptScore(opd.id),    sub: riskLabel(gaOptScore(opd.id))    },
                                { label: "Risiko Struktural (JPT/Administrator/Pengawas)", val: opd.skorStk, sub: riskLabel(opd.skorStk) },
                                { label: "Risiko Fungsional (JF/Pelaksana)", val: opd.skorFnk, sub: riskLabel(opd.skorFnk) },
                              ].map(({ label, val, sub }) => (
                                <div key={label} className="bg-white rounded-xl p-3 border border-blue-200">
                                  <p className="text-[10px] text-gray-500 mb-1 leading-snug">{label}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl font-black" style={{ color: riskColor(val), fontFamily: "var(--font-display)" }}>{val}</span>
                                    <StatusBadge status={sub} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between px-1 mb-6">
            <p className="text-xs text-gray-500">
              Menampilkan {Math.min(rows.length, PAGE_SIZE)} dari {TOTAL_OPD} OPD (halaman {page} dari {totalPages})
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronDown size={14} className="rotate-90" />
              </button>
              {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${page === n ? "text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  style={page === n ? { background: GRAD.blue } : {}}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            </div>
          </div>

          {/* Rekomendasi & Insight */}
          <section className="space-y-3">
            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
              <Shield size={14} className="text-blue-500" />
              Rekomendasi &amp; Insight Utama
            </h2>
            <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield size={15} className="text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-white text-sm font-bold">Prioritaskan PNS untuk Jabatan Struktural</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Ranking flat berbasis jumlah pegawai selalu menyamarkan OPD kecil yang justru lebih rentan — Dinas Kelautan &amp; Perikanan (876 pegawai, skor 51) lebih berisiko secara proporsional dibanding angka absolutnya. Gunakan Skor Komposit untuk perbandingan yang adil.
                </p>
                <div className="border-t border-slate-700 pt-3">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">⚠</span>
                      <span><span className="text-white font-semibold">PPPK tidak bisa mengisi Eselon I–IV.</span> OPD dengan komposisi PPPK tinggi akan kesulitan mengisi posisi Pengawas saat pejabat PNS-nya pensiun.</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">→</span>
                      <span>Prioritaskan formasi <span className="text-white font-semibold">PNS</span> untuk jabatan struktural yang kosong dalam 2–3 tahun ke depan. Gunakan filter "Risiko Struktural" untuk mengidentifikasi OPD paling rentan.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default OPDPage;
