import React, { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { C, GRAD } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip } from "../lib/ui";

// Sesuaikan jika base URL API-mu berbeda / dikelola lewat file .env frontend
// (mis. VITE_API_BASE_URL=https://api.bkd-jatim.example.id)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ============================================================
// Tipe data sesuai response GET /api/dashboard/pensiun-bup
// ============================================================

type StatusFilter = "SEMUA" | "PNS" | "PPPK" | "PPPK PW";

interface KpiBlock {
  pensiun_tahun_ini: { tahun: number; total: number };
  kumulatif_5_tahun: { dari_tahun: number; sampai_tahun: number; total: number };
  opd_tertinggi: { nama: string | null; total_5_tahun: number };
  opd_tertinggi_persen: { nama: string | null; persen: number };
}

interface Lonjakan {
  dari_tahun: number;
  ke_tahun: number;
  pct: number;
}

interface ChartRow {
  year: string;
  opd1?: number;
  opd2?: number;
  opd3?: number;
  opd4?: number;
  opd5?: number;
}

interface YearTile {
  year: string;
  total: number;
}

interface TopCabang {
  nama: string;
  total: number;
}

interface OpdBreakdownRow {
  opd: string;
  kategori: "Dinas" | "RSUD / Kesehatan" | "Sekretariat / Badan";
  years: string[];
  y: number[];
  total: number;
  total_pegawai_opd: number;
  persen_opd: number;
  klaster_dominan: string | null;
  top_cabang: TopCabang | null;
  urgensi: "Kritis" | "Waspada" | "Aman";
}

interface CabangBreakdown {
  opd: string;
  cabang: TopCabang[];
}

interface OpdTopVolumeRow {
  opd: string;
  total: number;
}

interface OpdTopPersenRow {
  opd: string;
  persen_opd: number;
  total_pegawai_opd: number;
}

interface PensiunBupResponse {
  kpi: KpiBlock | null;
  lonjakan: Lonjakan | null;
  filter_status: string | null;
  chart: ChartRow[];
  chart_series_labels: Record<string, string>;
  year_tiles: YearTile[];
  opd_breakdown: OpdBreakdownRow[];
  cabang_breakdown: CabangBreakdown | null;
  opd_top_volume: OpdTopVolumeRow[];
  opd_top_persen: OpdTopPersenRow[];
}

interface AiInsightItem {
  level: "critical" | "warning" | "info";
  text: string;
}

interface AiInsightResponse {
  headline: string;
  insights: AiInsightItem[];
  generated_at: string;
  cached: boolean;
  stale: boolean;
  stale_reason?: string;
}

const numId = (n: number) => n.toLocaleString("id-ID");

// Jumlah baris OPD per "slide" di tabel breakdown — diubah di satu tempat
// kalau suatu saat mau dibuat lebih rapat/lebar.
const OPD_ROWS_PER_PAGE = 5;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "SEMUA", label: "Semua ASN" },
  { value: "PNS", label: "PNS" },
  { value: "PPPK", label: "PPPK" },
  { value: "PPPK PW", label: "PPPK Paruh Waktu" },
];

// Narasi insight yang menyesuaikan karakter OPD teratas — bukan kalimat
// template generik. Guru, tenaga kesehatan, dan struktural punya implikasi
// yang beda saat pensiun, jadi kalimatnya juga beda.
function insightUntukOpd(row: OpdBreakdownRow | undefined): string {
  if (!row) return "";
  const klaster = (row.klaster_dominan || "").toUpperCase();

  if (klaster.includes("GURU")) {
    return `Mayoritas yang pensiun di ${row.opd} adalah Jabatan Fungsional Guru — dampaknya langsung terasa di ruang kelas, bukan sekadar kekosongan kursi kantor. Perlu koordinasi dengan cabang dinas wilayah untuk memastikan distribusi guru pengganti merata, bukan cuma di kota besar.`;
  }
  if (row.kategori === "RSUD / Kesehatan") {
    return `${row.opd} kehilangan tenaga kesehatan yang seringkali butuh waktu lama untuk diganti (dokter spesialis, perawat bersertifikasi). Ini risiko layanan publik langsung ke pasien, bukan cuma administratif — prioritas rekrutmen sebaiknya lebih awal dari OPD lain.`;
  }
  if (klaster.includes("ADMINISTRATOR") || klaster.includes("PENGAWAS") || klaster.includes("JPT")) {
    return `Yang pensiun di ${row.opd} didominasi jabatan struktural (${row.klaster_dominan}) — ini soal suksesi kepemimpinan, bukan cuma pengisian kursi. Perlu disiapkan kader pengganti dari eselon di bawahnya jauh-jauh hari.`;
  }
  return `${row.opd} diproyeksikan kehilangan ${numId(row.total)} pegawai (${row.persen_opd}% dari total pegawainya) dalam 5 tahun ke depan${row.klaster_dominan ? `, mayoritas dari klaster ${row.klaster_dominan}` : ""}.`;
}

const PensiunPage = () => {
  const [data, setData] = useState<PensiunBupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("SEMUA");
  const [opdPage, setOpdPage] = useState(0);

  const [aiInsight, setAiInsight] = useState<AiInsightResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const qs = statusFilter === "SEMUA" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
        const res = await fetch(`${API_BASE_URL}/api/dashboard/pensiun-bup${qs}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Gagal memuat data (status ${res.status})`);
        }
        const json: PensiunBupResponse = await res.json();
        setData(json);
        setOpdPage(0); // reset ke slide pertama tiap kali filter status berganti
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Gagal memuat data dari server");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [statusFilter]);

  // Insight AI dimuat terpisah dari data dashboard — kalau Gemini lambat/gagal,
  // bagian atas halaman tetap tampil normal, dan kartu Rekomendasi & Insight
  // jatuh balik ke narasi rule-based (insightUntukOpd) di bawah.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setAiLoading(true);
        setAiError(false);
        const qs = statusFilter === "SEMUA" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
        const res = await fetch(`${API_BASE_URL}/api/insights/pensiun-bup${qs}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Gagal memuat insight (status ${res.status})`);
        }
        const json: AiInsightResponse = await res.json();
        setAiInsight(json.headline || json.insights.length > 0 ? json : null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAiInsight(null);
          setAiError(true);
        }
      } finally {
        setAiLoading(false);
      }
    })();

    return () => controller.abort();
  }, [statusFilter]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Memuat data proyeksi pensiun…</span>
      </div>
    );
  }

  if (error || !data || !data.kpi) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 leading-snug">
            {error || "Data proyeksi pensiun belum tersedia."}
          </p>
        </div>
      </div>
    );
  }

  const { kpi, lonjakan, chart, chart_series_labels, year_tiles, opd_breakdown, cabang_breakdown, opd_top_volume } = data;

  const opd1Label = chart_series_labels.opd1 || "OPD Teratas 1";
  const opd2Label = chart_series_labels.opd2 || "OPD Teratas 2";
  const opd3Label = chart_series_labels.opd3 || "OPD Teratas 3";
  const opd4Label = chart_series_labels.opd4 || "OPD Teratas 4";
  const opd5Label = chart_series_labels.opd5 || "OPD Teratas 5";

  const namaOpdVolume = kpi.opd_tertinggi.nama || "—";
  const namaOpdPersen = kpi.opd_tertinggi_persen?.nama || "—";
  const opdTeratasRow = opd_breakdown[0];

  const opdTotalPages = Math.max(1, Math.ceil(opd_breakdown.length / OPD_ROWS_PER_PAGE));
  const opdPageSafe = Math.min(opdPage, opdTotalPages - 1);
  const opdRowsSlide = opd_breakdown.slice(
    opdPageSafe * OPD_ROWS_PER_PAGE,
    opdPageSafe * OPD_ROWS_PER_PAGE + OPD_ROWS_PER_PAGE
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Proyeksi Pensiun (BUP)"
        subtitle={`Estimasi ASN memasuki batas usia pensiun berdasarkan kolom bup (${kpi.pensiun_tahun_ini.tahun}–${chart[chart.length - 1]?.year ?? ""})`}
        crumbs={["Proyeksi Pensiun (BUP)"]}
      />

      {/* Filter jenis kepegawaian — PNS, PPPK, dan PPPK Paruh Waktu punya
          mekanisme penggantian yang beda, jadi layak dilihat terpisah */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          {
            label: `Pensiun Tahun Ini (${kpi.pensiun_tahun_ini.tahun})`,
            val: numId(kpi.pensiun_tahun_ini.total),
            sub: "Estimasi ASN · tahun berjalan",
            color: C.blue,
          },
          {
            label: `Kumulatif 5 Tahun (${kpi.kumulatif_5_tahun.dari_tahun}–${kpi.kumulatif_5_tahun.sampai_tahun})`,
            val: numId(kpi.kumulatif_5_tahun.total),
            sub: `Total kumulatif ${kpi.kumulatif_5_tahun.dari_tahun}–${kpi.kumulatif_5_tahun.sampai_tahun}`,
            color: C.coral,
          },
          {
            label: "OPD Paling Berisiko (% Pegawai)",
            val: namaOpdPersen,
            sub: `${kpi.opd_tertinggi_persen?.persen ?? 0}% dari total pegawainya pensiun dalam 5 tahun`,
            color: C.amber,
          },
        ].map(({ label, val, sub, color }) => (
          <Card key={label} hover>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-display)" }}>{val}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
            <div className="mt-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
          </Card>
        ))}
      </div>

      {/* Catatan: OPD tertinggi secara volume beda dari OPD paling berisiko
          secara persentase — keduanya penting, jadi disebut eksplisit */}
      {namaOpdVolume !== namaOpdPersen && (
        <p className="text-xs text-gray-400 mb-4 px-1">
          Secara jumlah absolut, <span className="font-semibold text-gray-600">{namaOpdVolume}</span> tetap yang terbanyak
          (±{numId(kpi.opd_tertinggi.total_5_tahun)} ASN dalam 5 tahun).
          Tapi secara <em>persentase dari kekuatan pegawainya sendiri</em>, {namaOpdPersen} lebih berisiko kehabisan tenaga.
        </p>
      )}

      {/* Spike callout */}
      {lonjakan && lonjakan.pct > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={15} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800 leading-snug">
            <strong>Lonjakan tajam {lonjakan.dari_tahun} → {lonjakan.ke_tahun} (+{lonjakan.pct}%)</strong> — kenaikan proyeksi pensiun terbesar pada rentang data ini.
            Cek ulang klaster usia yang mencapai BUP secara bersamaan pada tahun tersebut untuk memastikan ini pola demografis, bukan anomali data.
          </p>
        </div>
      )}

      {/* Chart */}
      <Card className="mb-4">
        <SectionTitle>Jumlah ASN Memasuki Pensiun per Tahun ({chart[0]?.year}–{chart[chart.length - 1]?.year})</SectionTitle>
        <p className="text-[11px] text-gray-400 italic mt-0.5 mb-2">
          Top 5 OPD dengan jumlah pensiun terbanyak (volume absolut) — masing-masing garis sendiri, bukan yang persentasenya tertinggi
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chart} margin={{ top: 24, right: 8, left: 0, bottom: 16 }}>
            <defs>
              {[["g1", C.blue], ["g2", C.teal], ["g3", C.coral], ["g4", C.amber], ["g5", "#8b5cf6"]].map(([id, color]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}   />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.6} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} />
            <Legend iconSize={10} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
            {lonjakan && (
              <ReferenceLine x={String(lonjakan.ke_tahun)} stroke={C.coral} strokeWidth={1.5} strokeDasharray="4 2"
                label={{ value: `+${lonjakan.pct}%`, position: "top", fill: C.coral, fontSize: 11, fontWeight: 700, dy: -6 }} />
            )}
            <Area type="monotone" dataKey="opd1" stroke={C.blue}   strokeWidth={2} fill="url(#g1)" name={opd1Label} />
            <Area type="monotone" dataKey="opd2" stroke={C.teal}   strokeWidth={2} fill="url(#g2)" name={opd2Label} />
            <Area type="monotone" dataKey="opd3" stroke={C.coral}  strokeWidth={2} fill="url(#g3)" name={opd3Label} />
            <Area type="monotone" dataKey="opd4" stroke={C.amber}  strokeWidth={2} fill="url(#g4)" name={opd4Label} />
            <Area type="monotone" dataKey="opd5" stroke="#8b5cf6" strokeWidth={2} fill="url(#g5)" name={opd5Label} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Tabel kecil pendukung: rincian angka per OPD di balik 5 garis
            pada chart di atas — murni volume, bukan persentase (beda
            kriteria dari tabel breakdown di bawah). */}
        {opd_top_volume && opd_top_volume.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Top {opd_top_volume.length} OPD volume pensiun terbanyak ({kpi.kumulatif_5_tahun.dari_tahun}–{kpi.kumulatif_5_tahun.sampai_tahun})
            </p>
            <div className="space-y-1.5">
              {opd_top_volume.map((row, i) => {
                const warnaGaris = [C.blue, C.teal, C.coral, C.amber, "#8b5cf6"][i] ?? "#d3d1c7";
                return (
                  <div key={row.opd} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-600">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: warnaGaris }}
                      />
                      {row.opd}
                    </span>
                    <span className="font-semibold text-gray-800 shrink-0">{numId(row.total)} orang</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Year tiles */}
      <div
        className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden mb-4"
        style={{ gridTemplateColumns: `repeat(${year_tiles.length}, minmax(0, 1fr))` }}
      >
        {year_tiles.map(({ year, total }) => {
          const isPuncak = lonjakan && year === String(lonjakan.ke_tahun);
          return (
            <div key={year} className={`p-4 text-center ${isPuncak ? "bg-orange-50" : "bg-white"}`}>
              <p className="text-xs text-gray-500 mb-1">{year}</p>
              <p className={`text-xl font-black ${isPuncak ? "text-orange-600" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-display)" }}>{numId(total)}</p>
              {isPuncak && <p className="text-[10px] text-orange-500 font-bold mt-0.5">+{lonjakan!.pct}%</p>}
            </div>
          );
        })}
      </div>

      {/* OPD Breakdown Table */}
      <Card className="p-0 overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <SectionTitle>
              OPD Paling Genting — % Pegawai Pensiun Tertinggi ({kpi.kumulatif_5_tahun.dari_tahun}–{kpi.kumulatif_5_tahun.sampai_tahun})
            </SectionTitle>
            <span className="text-[11px] text-gray-400 italic whitespace-nowrap ml-3">
              {opd_breakdown.length} OPD
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Diurutkan berdasarkan <span className="font-semibold text-gray-700">proporsi</span> pegawai OPD yang akan pensiun terhadap total pegawainya — bukan jumlah orang terbanyak.
            OPD kecil bisa lebih genting di sini walau jumlah absolutnya kecil, karena kehilangan sebagian besar pegawainya sekaligus.
          </p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["OPD", "Kategori", "% Pegawai", "Klaster Dominan", "Total 5 Thn", "Urgensi"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {opdRowsSlide.map((row) => (
              <tr key={row.opd} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  {row.opd}
                  <div className="text-[11px] font-normal text-gray-400">
                    {numId(row.total_pegawai_opd)} total pegawai OPD
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{row.kategori}</td>
                <td className="px-4 py-3 text-sm text-right font-black text-gray-900" style={{ fontFamily: "var(--font-mono)" }}>
                  {row.persen_opd}%
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{row.klaster_dominan ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-black text-gray-900 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                  {numId(row.total)}
                </td>
                <td className="px-4 py-3"><StatusBadge status={row.urgensi} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {opdTotalPages > 1 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setOpdPage(p => Math.max(0, p - 1))}
              disabled={opdPageSafe === 0}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Sebelumnya
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: opdTotalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setOpdPage(i)}
                  aria-label={`Slide ${i + 1} dari ${opdTotalPages}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === opdPageSafe ? "w-5 bg-gray-900" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setOpdPage(p => Math.min(opdTotalPages - 1, p + 1))}
              disabled={opdPageSafe === opdTotalPages - 1}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Selanjutnya <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Data diproyeksikan berdasarkan kolom <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>bup</span> / <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>tmt_bup</span> dari SIMPEG.
            Urgensi dihitung dari persentase pegawai OPD yang pensiun (≥20% Kritis, 10–20% Waspada, &lt;10% Aman), bukan cuma jumlah absolut.
          </p>
        </div>
      </Card>

      {/* Breakdown cabang/wilayah — muncul kalau OPD teratas punya struktur
          cabang dinas (paling sering: Dinas Pendidikan dengan cabang dinas
          wilayah se-Jatim) */}
      {cabang_breakdown && cabang_breakdown.cabang.length > 0 && (
        <Card className="p-0 overflow-hidden mb-6">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <MapPin size={14} className="text-blue-500" />
            <SectionTitle>
              Sebaran Cabang/Wilayah — {cabang_breakdown.opd}
            </SectionTitle>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {cabang_breakdown.cabang.map(({ nama, total }, i) => (
              <div key={nama} className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5">
                <span className="text-xs text-gray-700 font-medium">
                  {i === 0 && <span className="text-orange-500 font-bold mr-1">#1</span>}
                  {nama}
                </span>
                <span className="text-sm font-black text-gray-900" style={{ fontFamily: "var(--font-mono)" }}>
                  {numId(total)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Diambil dari struktur cabang dinas pada data PPPK/PPPK Paruh Waktu (mis. "Cabang Dinas Pendidikan Wilayah X").
              Data PNS tidak punya rincian cabang sehingga tidak ikut terhitung di sini.
            </p>
          </div>
        </Card>
      )}

      {/* Rekomendasi & Insight — headline & bullet dari Gemini (lihat
          GET /api/insights/pensiun-bup) selama tersedia; kalau masih
          loading atau gagal, jatuh balik ke narasi rule-based supaya
          kartu ini tidak pernah kosong. */}
      <section className="space-y-3">
        <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle size={14} className="text-orange-500" />
          Rekomendasi &amp; Insight Utama
          {aiInsight && !aiLoading && (
            <span className="text-[10px] font-bold normal-case tracking-normal text-white bg-indigo-500 rounded-full px-2 py-0.5">
              AI
            </span>
          )}
        </h2>
        <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD.blue }}>
            {aiLoading ? (
              <Loader2 size={15} className="text-white animate-spin" />
            ) : (
              <AlertTriangle size={15} className="text-white" />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-white text-sm font-bold mb-1.5">
                Rencanakan Formasi Sekarang{lonjakan ? ` — Puncak Pensiun ${lonjakan.ke_tahun} Sudah Dekat` : ""}
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                {aiInsight?.headline || (
                  <>
                    {insightUntukOpd(opdTeratasRow)}
                    {lonjakan && ` Lonjakan +${lonjakan.pct}% pada ${lonjakan.ke_tahun} perlu diverifikasi apakah merupakan pola demografis (klaster usia yang mencapai BUP bersamaan) atau anomali pada data sumber.`}
                  </>
                )}
              </p>
              {aiInsight?.stale && (
                <p className="text-[11px] text-amber-400 mt-1.5 italic">
                  Insight AI belum diperbarui untuk data terbaru — menampilkan versi terakhir yang tersimpan.
                </p>
              )}
              {aiError && !aiInsight && (
                <p className="text-[11px] text-slate-500 mt-1.5 italic">
                  Insight AI belum tersedia saat ini — menampilkan ringkasan otomatis di bawah.
                </p>
              )}
            </div>
            <div className="border-t border-slate-700 pt-3">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Insight Kunci</p>
              <ul className="space-y-2">
                {aiInsight && aiInsight.insights.length > 0 ? (
                  aiInsight.insights.map((item, i) => {
                    const style =
                      item.level === "critical"
                        ? { icon: "▲", color: "text-red-400" }
                        : item.level === "info"
                        ? { icon: "◆", color: "text-emerald-400" }
                        : { icon: "→", color: "text-orange-400" };
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm">
                        <span className={`${style.color} font-bold flex-shrink-0 mt-0.5`}>{style.icon}</span>
                        <span>{item.text}</span>
                      </li>
                    );
                  })
                ) : (
                  <>
                    <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">▲</span>
                      <span>
                        Total {numId(kpi.kumulatif_5_tahun.total)} ASN diproyeksikan mencapai BUP dalam periode {kpi.kumulatif_5_tahun.dari_tahun}–{kpi.kumulatif_5_tahun.sampai_tahun}.
                        Koordinasi dengan BKN diperlukan untuk mengantisipasi kekosongan jabatan, terutama di OPD dengan persentase pensiun tertinggi seperti {namaOpdPersen}.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                      <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">→</span>
                      <span>
                        PNS, PPPK, dan PPPK Paruh Waktu punya jalur penggantian berbeda — pensiun PNS butuh formasi CPNS lewat seleksi nasional (lead time lebih panjang),
                        sementara PPPK relatif lebih fleksibel. Gunakan filter status di atas untuk memisahkan kebutuhan formasi per jalur sebelum diajukan ke BKN.
                      </span>
                    </li>
                    {cabang_breakdown && (
                      <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                        <span className="text-emerald-400 font-bold flex-shrink-0 mt-0.5">◆</span>
                        <span>
                          Untuk {cabang_breakdown.opd}, cabang/wilayah <span className="text-white font-semibold">{cabang_breakdown.cabang[0]?.nama}</span> paling
                          terdampak — pertimbangkan prioritas alokasi formasi baru ke wilayah tersebut lebih dulu, bukan dipukul rata se-provinsi.
                        </span>
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PensiunPage;
