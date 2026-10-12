import React, { useEffect, useRef, useState } from "react";
import {
  BarChart as ReBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  AlertTriangle, Download,
  Bot, FileText, ArrowRight, Loader2, RefreshCw,
  Users, Briefcase, Clock, Hourglass,
} from "lucide-react";
import { C, GRAD, fmt } from "../lib/constants";
import { Card, SectionTitle, PageHeader, ChartTip } from "../lib/ui";
import { exportBerandaToPdf } from "../lib/pdfExport";

// ── Palet warna dashboard: dibatasi jadi 4 warna kontras yang dipakai
//    berulang secara konsisten di semua chart (bukan warna-warni), supaya
//    tiap warna punya makna yang sama di seluruh halaman:
//    biru = kategori utama, teal = kategori kedua, ungu = kategori ketiga,
//    amber = penanda "perlu perhatian" / nilai tertinggi, abu = netral/kecil.
const PALETTE = {
  blue: C.blue,
  teal: C.teal,
  purple: C.purple,
  amber: C.amber,
  neutral: "#94a3b8", // slate-400, untuk kategori kecil/tidak signifikan
};

// ── Konfigurasi API ────────────────────────────────────────────────────────────
// Set VITE_API_BASE_URL di file .env frontend jika backend tidak jalan di
// localhost:8000, misalnya: VITE_API_BASE_URL=https://api-bkd.jatimprov.go.id
const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

// ── Tipe data sesuai response backend (main.py) ────────────────────────────────
interface SummaryGroup { total: number; pct: number }

interface SummaryData {
  total_asn: number;
  total_opd: number;
  avg_usia: number;
  akan_pensiun_3_tahun: number;
  pns: SummaryGroup;
  pppk_full: SummaryGroup;
  pppk_pw: SummaryGroup;
}

interface StatusItem { name: string; value: number; pct: number }
interface GenerasiItem { name: string; value: number }
interface GenerasiByStatusItem {
  status: string;
  BabyBoom: number;
  GenX: number;
  Milenial: number;
  GenZ: number;
}
interface PensiunItem { year: string; total: number }
interface TopOpdItem { opd: string; total: number }
interface EselonRiskItem { eselon: string; jumlah: number; label: string }
interface OpdRiskItem {
  id: number;
  nama: string;
  total: number;
  rataUsia: number;
  pctTua: number;
  pctS1: number;
  skor: number;
  kategori: string;
  detail: string;
}

interface DashboardData {
  summary: SummaryData;
  status: StatusItem[];
  generasi: GenerasiItem[];
  generasi_by_status: GenerasiByStatusItem[];
  pensiun: PensiunItem[];
  top_opd: TopOpdItem[];
  eselon_risk: EselonRiskItem[];
  opd_risk: OpdRiskItem[];
}

// ── Tipe data untuk insight hasil AI (backend: GET /api/insights) ─────────────
interface AiInsightItem { level: "critical" | "warning" | "info"; text: string }
interface AiInsightsResponse {
  headline: string;
  insights: AiInsightItem[];
  generated_at: string;
  cached: boolean;
  stale?: boolean;
  stale_reason?: string;
}

// ── Palet warna turunan (biar konsisten dgn styling lama tanpa perlu field
//    "color" dari backend) ───────────────────────────────────────────────────
function statusColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("paruh")) return PALETTE.purple;
  if (n.includes("pppk")) return PALETTE.teal;
  if (n === "cpns") return PALETTE.neutral;
  return PALETTE.blue; // PNS / default
}

function generasiColor(name: string): string {
  switch (name) {
    case "BabyBoom": return PALETTE.amber;
    case "GenX": return PALETTE.blue;
    case "Milenial": return PALETTE.teal;
    case "GenZ": return PALETTE.purple;
    default: return PALETTE.blue;
  }
}

// Chart peringkat satu-seri (Eselon, Top OPD): 2 warna saja — item dengan
// urutan tertinggi diberi warna highlight (biru, warna utama palet di atas),
// sisanya warna netral yang sama supaya tetap konsisten dengan chart lain
// tanpa memakai amber/biru-muda yang terpisah sendiri.
function rankBarColor(index: number): { fill: string; opacity: number } {
  return index === 0
    ? { fill: PALETTE.blue, opacity: 1 }
    : { fill: PALETTE.neutral, opacity: 0.7 };
}

// ── Generator Insight (rule-based, dari data live — tanpa panggilan AI/LLM) ────
// Semua insight di bawah dihitung langsung dari DashboardData yang sudah
// diambil dari /api/dashboard. Tidak butuh API key atau endpoint tambahan:
// begitu backend punya data, insight-insight ini otomatis berubah mengikuti
// data terbaru. Kalau nanti mau upgrade ke narasi generated-AI, tinggal
// tambah 1 insight baru dari endpoint /api/insights tanpa mengubah yang lain.
type InsightLevel = "critical" | "warning" | "info";
interface Insight { level: InsightLevel; text: React.ReactNode }

const LEVEL_STYLE: Record<InsightLevel, { mark: string; color: string }> = {
  critical: { mark: "●", color: "text-red-400" },
  warning: { mark: "▲", color: "text-amber-400" },
  info: { mark: "→", color: "text-blue-400" },
};

function buildInsights(data: DashboardData): Insight[] {
  const { summary, generasi, pensiun, eselon_risk, opd_risk } = data;
  const insights: Insight[] = [];

  // 1) Urgensi gelombang pensiun 3 tahun ke depan, relatif terhadap total ASN
  const pensiunPct = summary.total_asn ? (summary.akan_pensiun_3_tahun / summary.total_asn) * 100 : 0;
  if (summary.akan_pensiun_3_tahun > 0) {
    insights.push({
      level: pensiunPct >= 8 ? "critical" : "warning",
      text: (
        <>
          <span className="text-white font-semibold">
            {fmt(summary.akan_pensiun_3_tahun)} ASN ({pensiunPct.toFixed(1).replace(".", ",")}%)
          </span>{" "}
          akan memasuki BUP dalam 3 tahun ke depan, sehingga perencanaan rekrutmen dan alih
          pengetahuan (knowledge transfer) perlu dimulai dari sekarang, bukan menunggu tahun puncak pensiun.
        </>
      ),
    });
  }

  // 2) Tahun puncak pensiun
  const highestPensiunYear = pensiun.reduce(
    (max, cur) => (cur.total > (max?.total ?? -1) ? cur : max),
    null as PensiunItem | null
  );
  if (highestPensiunYear) {
    insights.push({
      level: "warning",
      text: (
        <>
          <span className="text-white font-semibold">
            {fmt(highestPensiunYear.total)} ASN diproyeksikan pensiun pada {highestPensiunYear.year}
          </span>{", "}
          periode dengan proyeksi pensiun tertinggi berdasarkan data saat ini.
        </>
      ),
    });
  }

  // 3) Jabatan struktural paling berisiko kosong (BUP ≤ 2 tahun) — diambil dari
  //    jumlah tertinggi di eselon_risk, tidak hardcode ke label tertentu, supaya
  //    tetap benar walau susunan data eselon berubah.
  const topEselonRisk = [...eselon_risk].sort((a, b) => b.jumlah - a.jumlah)[0];
  if (topEselonRisk && topEselonRisk.jumlah > 0) {
    insights.push({
      level: "critical",
      text: (
        <>
          <span className="text-white font-semibold">
            {fmt(topEselonRisk.jumlah)} pejabat {topEselonRisk.label} ({topEselonRisk.eselon})
          </span>{" "}
          mendekati BUP dalam ≤2 tahun, jabatan struktural yang tidak bisa diisi PPPK, sehingga kaderisasi
          harus dimulai segera agar tidak terjadi kekosongan jabatan yang berdampak pada layanan publik.
        </>
      ),
    });
  }

  // 4) Komposisi generasi: Milenial dominan vs Gen X yang paling banyak menduduki
  //    jabatan struktural dan akan lebih dulu pensiun.
  const milenial = generasi.find(g => g.name === "Milenial");
  const milenialPct = milenial && summary.total_asn ? (milenial.value / summary.total_asn) * 100 : null;
  if (milenialPct !== null) {
    insights.push({
      level: "info",
      text: (
        <>
          Milenial mendominasi komposisi ({milenialPct.toFixed(1).replace(".", ",")}%), namun Generasi X,
          yang paling banyak menempati jabatan struktural, akan lebih dulu menghadapi gelombang pensiun. Gunakan
          skor komposit per OPD, bukan sekadar ranking jumlah pegawai, untuk membandingkan risiko secara proporsional.
        </>
      ),
    });
  }

  // 5) Jumlah OPD dengan kategori risiko "Tinggi" menurut skor komposit backend
  const tinggiRisk = opd_risk.filter(o => o.kategori?.toLowerCase().includes("tinggi"));
  if (tinggiRisk.length > 0) {
    insights.push({
      level: "warning",
      text: (
        <>
          <span className="text-white font-semibold">{tinggiRisk.length} OPD</span> berada pada kategori
          risiko regenerasi "Tinggi" (skor komposit dari usia rata-rata, proporsi pegawai senior, dan
          tingkat pendidikan), termasuk{" "}
          <span className="text-orange-300 font-semibold">
            {tinggiRisk.slice(0, 3).map(o => o.nama).join(", ")}
          </span>
          . Lihat halaman Proyeksi Pensiun &amp; BUP untuk daftar lengkap dan detail per OPD.
        </>
      ),
    });
  }

  return insights;
}

// ── Beranda Page ──────────────────────────────────────────────────────────────

const BerandaPage = ({ onNav }: { onNav: (id: string) => void }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // ── Insight AI (Gemini, di-cache di database backend) ──
  // Dipisah dari loadDashboard supaya kartu chart tetap tampil cepat
  // walau insight AI-nya masih loading (atau gagal).
  const [aiInsights, setAiInsights] = useState<AiInsightItem[] | null>(null);
  const [aiHeadline, setAiHeadline] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [aiStale, setAiStale] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Ref ke tiap blok visual di halaman ini, dipakai untuk "difoto" langsung
  // ke gambar saat diekspor ke PDF (lihat handleExportLaporan di bawah),
  // supaya laporan PDF-nya identik dengan tampilan dashboard di layar.
  const heroRef = useRef<HTMLElement>(null);
  const row1Ref = useRef<HTMLElement>(null);
  const row2Ref = useRef<HTMLElement>(null);
  const row3Ref = useRef<HTMLElement>(null);
  const insightRef = useRef<HTMLElement>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Gagal memuat data (HTTP ${res.status})`);
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // ── Insight AI ──
  // Backend yang memutuskan generate baru atau pakai cache (berdasarkan
  // apakah data ASN berubah sejak insight terakhir dibuat) — di sini
  // cukup panggil endpoint-nya. force_refresh=true dipakai saat pengguna
  // menekan tombol refresh manual.
  const loadAiInsights = async (forceRefresh = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const url = `${API_BASE_URL}/api/insights${forceRefresh ? "?force_refresh=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Gagal memuat insight AI (HTTP ${res.status})`);
      }
      const json: AiInsightsResponse = await res.json();
      setAiInsights(json.insights);
      setAiHeadline(json.headline || null);
      setAiGeneratedAt(json.generated_at);
      setAiStale(!!json.stale);
    } catch (err: any) {
      setAiError(err?.message || "Tidak dapat memuat insight AI.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadAiInsights();
  }, []);

  // ── Ekspor laporan PDF ──
  // Mengambil "foto" dari hero, tiap baris chart, dan kartu insight yang
  // sedang tampil di layar, lalu menyusunnya jadi PDF rapi multi-halaman
  // lengkap dengan header/footer. Karena sumbernya langsung DOM yang sudah
  // dirender, hasil PDF akan sama persis dengan tampilan Beranda saat ini.
  const handleExportLaporan = async () => {
    if (!data || isExporting) return;
    setIsExporting(true);
    try {
      await exportBerandaToPdf(
        {
          hero: heroRef.current,
          row1: row1Ref.current,
          row2: row2Ref.current,
          row3: row3Ref.current,
          insight: insightRef.current,
        },
        {
          reportTitle: "Laporan Dashboard Kepegawaian ASN",
          reportSubtitle: "Provinsi Jawa Timur",
          summaryLine: `Total ${fmt(data.summary.total_asn)} ASN terdaftar di ${data.summary.total_opd} OPD`,
        }
      );
    } catch (err) {
      console.error("Gagal mengekspor laporan PDF:", err);
      alert("Gagal membuat PDF laporan. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">Memuat dashboard...</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 min-h-[60vh] text-center">
        <AlertTriangle size={28} className="text-red-500" />
        <p className="text-sm font-semibold text-gray-700">Gagal memuat data dashboard</p>
        <p className="text-xs text-gray-400 max-w-md">{error}</p>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors mt-2"
        >
          <RefreshCw size={12} /> Coba lagi
        </button>
      </div>
    );
  }

  const { summary, status, generasi, generasi_by_status, pensiun, top_opd, eselon_risk, opd_risk } = data;

  // opd_risk sudah terurut dari backend (skor risiko tertinggi lebih dulu)
  const topRiskOpd = opd_risk[0];
  const highestPensiunYear = pensiun.reduce(
    (max, cur) => (cur.total > (max?.total ?? -1) ? cur : max),
    null as PensiunItem | null
  );
  // Jabatan struktural dengan jumlah pejabat mendekati BUP terbanyak (dinamis,
  // tidak hardcode ke label "Pengawas" — mengikuti data eselon_risk apa adanya)
  const topEselonRisk = [...eselon_risk].sort((a, b) => b.jumlah - a.jumlah)[0];

  // Insight kunci: utamakan hasil AI (dari /api/insights, di-cache di database).
  // Selama AI belum selesai loading (atau kalau gagal), tampilkan insight
  // berbasis aturan dari data live (buildInsights()) supaya bagian ini tidak
  // pernah kosong.
  const ruleBasedInsights = buildInsights(data);
  const displayedInsights: Insight[] =
    aiInsights && aiInsights.length > 0
      ? aiInsights.map((ins) => ({ level: ins.level, text: ins.text }))
      : ruleBasedInsights;

  return (
    <div className="p-6 space-y-5">

      {/* ── Hero: Total ASN + KPI Ringkasan ── */}
      <section ref={heroRef} className="relative rounded-2xl overflow-hidden" style={{ background: GRAD.hero }}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative p-8">
          {/* Header: label kontekstual kiri, aksi ekspor kanan */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Ringkasan Kepegawaian</p>
            <button
              onClick={handleExportLaporan}
              disabled={isExporting}
              data-pdf-ignore="true"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {isExporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {isExporting ? "Membuat PDF..." : "Ekspor Laporan"}
            </button>
          </div>

          <div className="flex items-stretch gap-6 flex-wrap">
            {/* Hero content — Total ASN Aktif, langsung di atas background biru */}
            <div className="flex-[1.3] min-w-[300px] flex flex-col justify-between">
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Total ASN Aktif</p>
                <p className="font-black text-white leading-none mb-3"
                  style={{ fontSize: "clamp(44px,6vw,64px)", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(summary.total_asn)}
                </p>
                <p className="text-blue-100 text-sm">Pegawai terdaftar di {summary.total_opd} OPD Provinsi Jawa Timur</p>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white border border-white/20 w-fit"
                style={{ background: "rgba(249,115,22,0.25)", backdropFilter: "blur(8px)" }}>
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
                {fmt(summary.akan_pensiun_3_tahun)} pegawai akan memasuki BUP dalam 3 tahun ke depan
              </div>
            </div>

            {/* KPI ringkas — 4 kartu, gaya glass senada dengan tombol Ekspor Laporan.
                Proporsi ditunjukkan lewat bar tipis di bawah angka (bukan badge
                mengambang), supaya lebar kartu terisi dan persentasenya kebaca
                langsung sebagai bagian dari total, bukan angka lepas. */}
            <div className="flex-[2] min-w-[420px] grid grid-cols-2 gap-4">
              {[
                { label: "PNS", icon: Users, val: fmt(summary.pns.total), total: summary.total_asn, pct: summary.pns.pct, color: C.blue },
                { label: "PPPK Penuh Waktu", icon: Briefcase, val: fmt(summary.pppk_full.total), total: summary.total_asn, pct: summary.pppk_full.pct, color: C.teal },
                { label: "PPPK Paruh Waktu", icon: Clock, val: fmt(summary.pppk_pw.total), total: summary.total_asn, pct: summary.pppk_pw.pct, color: C.purple },
              ].map(({ label, icon: Icon, val, total, pct, color }) => (
                <div key={label} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={12} className="text-blue-300 flex-shrink-0" />
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide truncate">{label}</p>
                  </div>
                  <p className="text-white font-black text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>{val}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-blue-300 text-[11px] mt-1.5">
                    {val} dari {fmt(total)} ASN <span className="font-bold text-white/90">({`${pct}`.replace(".", ",")}%)</span>
                  </p>
                </div>
              ))}

              {/* Kartu usia — polanya tetap konsisten (icon, angka, bar) tapi
                  bar-nya jadi skala rentang usia kerja s.d. BUP, dengan
                  penanda posisi rata-rata usia saat ini. */}
              {(() => {
                const usiaMin = 25, usiaBup = 60;
                const posPct = Math.min(100, Math.max(0, ((summary.avg_usia - usiaMin) / (usiaBup - usiaMin)) * 100));
                return (
                  <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Hourglass size={12} className="text-blue-300 flex-shrink-0" />
                      <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide truncate">Rata-rata Usia ASN</p>
                    </div>
                    <p className="text-white font-black text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                      {`${summary.avg_usia}`.replace(".", ",")} thn
                    </p>
                    <div className="mt-3 relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-900"
                        style={{ left: `calc(${posPct}% - 5px)`, backgroundColor: C.coral }} />
                    </div>
                    <p className="text-blue-300 text-[11px] mt-1.5">
                      Posisi antara {usiaMin} thn dan BUP {usiaBup} thn
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── KOMPOSISI & DISTRIBUSI GENERASI ── */}
      <div className="flex items-center justify-between px-1">
        <SectionTitle>Komposisi &amp; Distribusi Generasi</SectionTitle>
        <span className="text-xs text-gray-400 italic">Data langsung dari database</span>
      </div>

      {/* Baris 1: Status Kepegawaian + Komposisi Generasi per Status */}
      <section ref={row1Ref} className="grid grid-cols-2 gap-5">
        <Card>
          <SectionTitle>Status Kepegawaian</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={status} barSize={40} margin={{ top: 16, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={v => v.replace("PPPK ","").replace("Penuh Waktu","PW").replace("Paruh Waktu","PP")} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}rb`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" name="Jumlah ASN" radius={[5, 5, 0, 0]}>
                {status.map((d, i) => <Cell key={i} fill={statusColor(d.name)} />)}
                <LabelList dataKey="pct" position="top" formatter={(v: any) => `${v}%`}
                  style={{ fontSize: 10, fontWeight: 700, fill: "#374151" }} />
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>Komposisi Generasi per Status</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={generasi_by_status} layout="vertical" barSize={26} margin={{ top: 16, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: 10, color: "#6b7280", top: -4 }} />
              <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 9 }}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}rb` : `${v}`}
                axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={58}
                tickFormatter={v => v.replace("PPPK Penuh Waktu","PPPK FT").replace("PPPK Paruh Waktu","PPPK PW")} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="BabyBoom" stackId="s" fill={PALETTE.amber}  name="Baby Boomer" />
              <Bar dataKey="GenX"     stackId="s" fill={PALETTE.blue}   name="Generasi X"  />
              <Bar dataKey="Milenial" stackId="s" fill={PALETTE.teal}   name="Milenial"    />
              <Bar dataKey="GenZ"     stackId="s" fill={PALETTE.purple} name="Gen Z" radius={[0,4,4,0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* Baris 2: Distribusi Generasi (donut) + Risiko Kekosongan Jabatan Struktural */}
      <section ref={row2Ref} className="grid grid-cols-2 gap-5">
        <Card>
          <SectionTitle>Distribusi Generasi (Total)</SectionTitle>
          <div className="flex items-center justify-center gap-6">
            <div style={{ width: "58%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={generasi} cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={2} dataKey="value"
                    label={({ cx, cy, midAngle, outerRadius: or, percent }: any) => {
                      const RAD = Math.PI / 180;
                      const r = or + 16;
                      const x = cx + r * Math.cos(-midAngle * RAD);
                      const y = cy + r * Math.sin(-midAngle * RAD);
                      const pctLabel = percent * 100 < 1
                        ? `${(percent * 100).toFixed(1)}%`
                        : `${(percent * 100).toFixed(0)}%`;
                      return (
                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                          style={{ fontSize: 10, fontWeight: 700, fill: "#374151", fontFamily: "var(--font-mono)" }}>
                          {pctLabel}
                        </text>
                      );
                    }}
                    labelLine={false}>
                    {generasi.map((d, i) => <Cell key={i} fill={generasiColor(d.name)} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {generasi.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: generasiColor(d.name) }} />
                  <span className="text-[11px] text-gray-600 whitespace-nowrap">{d.name}: {fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>
            Top 5 Sebaran Pegawai per OPD
          </SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={top_opd.slice(0, 5)} layout="vertical" barSize={24} margin={{ top: 8, left: 0, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}rb` : `${v}`} />
              <YAxis type="category" dataKey="opd" tick={{ fontSize: 9.5 }} axisLine={false} tickLine={false} width={148} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total" name="Jumlah Pegawai" radius={[0, 4, 4, 0]}>
                {top_opd.slice(0, 5).map((d, i) => {
                  const { fill, opacity } = rankBarColor(i);
                  return <Cell key={i} fill={fill} fillOpacity={opacity} />;
                })}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* Baris 3: Proyeksi Pensiun per Tahun + Risiko Kekosongan Jabatan Struktural */}
      <section ref={row3Ref} className="grid grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>
              Proyeksi Pensiun per Tahun
            </SectionTitle>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE.neutral, opacity: 0.7 }} />
                  <span className="text-[10px] text-gray-500">Tahun normal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE.blue }} />
                  <span className="text-[10px] text-gray-500">Puncak{highestPensiunYear ? ` (${highestPensiunYear.year})` : ""}</span>
                </div>
              </div>
              <button onClick={() => onNav("pensiun")} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                Detail <ArrowRight size={11} />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={pensiun.slice(0, 6)} barSize={34} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total" name="Total Pensiun" radius={[5, 5, 0, 0]}>
                {pensiun.slice(0, 6).map((d, i) => (
                  <Cell key={i} fill={d.year === highestPensiunYear?.year ? PALETTE.blue : PALETTE.neutral}
                    fillOpacity={d.year === highestPensiunYear?.year ? 1 : 0.7} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>
            Risiko Kekosongan Jabatan Struktural (BUP ≤ 2 Tahun)
          </SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={eselon_risk} layout="vertical" barSize={24} margin={{ top: 8, left: 0, right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="eselon" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="jumlah" name="Pejabat mendekati BUP" radius={[0, 4, 4, 0]}>
                {eselon_risk.map((d, i) => {
                  const { fill, opacity } = rankBarColor(i);
                  return <Cell key={i} fill={fill} fillOpacity={opacity} />;
                })}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>
      </section>

  

      {/* ── REKOMENDASI AI & INSIGHT UTAMA ── */}
      {/* "Rekomendasi AI — Genetic Algorithm" (paragraf di atas "Insight Kunci")
          merujuk pada skor komposit (kolom skor/kategori di opd_risk) yang
          sudah dihitung backend via algoritma genetika — bukan dari LLM.
          "Insight Kunci" di bawahnya dihasilkan Gemini lewat GET /api/insights
          (di-cache di database backend, hanya generate ulang kalau data ASN
          berubah). buildInsights() jadi fallback: dipakai selama insight AI
          masih loading atau kalau endpoint-nya gagal, supaya bagian ini tidak
          pernah kosong. */}
      <section ref={insightRef} className="space-y-3">
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <Bot size={14} className="text-blue-500" />
          Rekomendasi &amp; Insight Utama
        </h2>
        <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD.blue }}>
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-white text-sm font-bold mb-1.5">Rekomendasi AI — Skor Komposit Risiko Regenerasi</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                {aiHeadline ? (
                  // Headline dari Gemini (GET /api/insights), sudah merujuk data
                  // dashboard terbaru — dipakai selama tersedia.
                  aiHeadline
                ) : (
                  // Fallback: dirakit dari data live selama headline AI belum ada
                  // (masih loading pertama kali, atau endpoint /api/insights gagal
                  // total tanpa ada cache lama sama sekali).
                  <>
                    Berdasarkan analisis skor komposit risiko regenerasi terhadap {fmt(summary.total_asn)} ASN,{" "}
                    {topRiskOpd && (
                      <>
                        <span className="text-orange-400 font-bold">{topRiskOpd.nama}</span> menunjukkan risiko regenerasi tertinggi
                        (skor komposit {topRiskOpd.skor}/100){highestPensiunYear ? `, dengan puncak pensiun pada ${highestPensiunYear.year} (${fmt(highestPensiunYear.total)} pegawai)` : ""}.
                      </>
                    )}
                    {" "}Prioritaskan rekrutmen dan kaderisasi struktural untuk mengisi
                    {topEselonRisk ? ` ${fmt(topEselonRisk.jumlah)} jabatan ${topEselonRisk.label} (${topEselonRisk.eselon})` : " jabatan struktural"} yang akan kosong dalam waktu dekat.
                  </>
                )}
              </p>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Insight Kunci</p>
                <div className="flex items-center gap-2">
                  {aiGeneratedAt && !aiLoading && (
                    <span className="text-slate-500 text-[10px]">
                      {aiStale && (
                        <span className="text-amber-400/80 mr-1" title={aiError || "Layanan AI sedang gangguan, menampilkan hasil terakhir yang tersimpan"}>
                          (belum terbaru)
                        </span>
                      )}
                      Diperbarui AI{" "}
                      {new Date(aiGeneratedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                  <button
                    onClick={() => loadAiInsights(true)}
                    disabled={aiLoading}
                    title="Generate ulang insight AI"
                    className="text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-wait"
                  >
                    <RefreshCw size={11} className={aiLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              {displayedInsights.length > 0 ? (
                <ul className="space-y-2">
                  {displayedInsights.map((ins, i) => {
                    const { mark, color } = LEVEL_STYLE[ins.level];
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm">
                        <span className={`${color} font-bold flex-shrink-0 mt-0.5`}>{mark}</span>
                        <span>{ins.text}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm italic">Belum cukup data untuk menghasilkan insight.</p>
              )}
              {aiError && (
                <p className="text-amber-400/80 text-[11px] mt-2 italic">
                  Insight AI belum tersedia ({aiError}) — menampilkan insight berbasis aturan sementara.
                </p>
              )}
            </div>
            <p className="text-slate-500 text-xs flex items-center gap-1.5">
              <FileText size={10} />
              Berdasarkan Pergub Jatim No. 45/2022 tentang Manajemen Kepegawaian Daerah
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default BerandaPage;
