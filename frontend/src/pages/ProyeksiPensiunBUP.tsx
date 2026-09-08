import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AlertTriangle, Info } from "lucide-react";
import { C, GRAD, PROYEKSI_PENSIUN } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip } from "../lib/ui";

const PensiunPage = () => (
  <div className="p-6">
    <PageHeader
      title="Proyeksi Pensiun (BUP)"
      subtitle="Estimasi ASN memasuki batas usia pensiun berdasarkan kolom bup — 2026–2035"
      crumbs={["Proyeksi Pensiun (BUP)"]}
    />

    {/* KPI Cards */}
    <div className="grid grid-cols-3 gap-4 mb-5">
      {[
        { label: "Pensiun Tahun Ini (2026)",    val: "423",             sub: "Estimasi ASN · tahun berjalan",    color: C.blue  },
        { label: "Kumulatif 5 Tahun (2026–30)", val: "9.405",           sub: "Total kumulatif 2026–2030",        color: C.coral },
        { label: "OPD Proyeksi Tertinggi",       val: "Dinas Pendidikan",sub: "±3.889 ASN dalam 5 tahun",        color: C.amber },
      ].map(({ label, val, sub, color }) => (
        <Card key={label} hover>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-black text-gray-900 leading-tight" style={{ fontFamily: "var(--font-display)" }}>{val}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
          <div className="mt-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
        </Card>
      ))}
    </div>

    {/* Spike callout */}
    <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
      <AlertTriangle size={15} className="text-orange-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-orange-800 leading-snug">
        <strong>Lonjakan tajam 2026 → 2027 (+215%)</strong> — banyak klaster usia 57–58 tahun yang secara bersamaan mencapai BUP 58/60 pada 2027.
        Ini bukan anomali data, melainkan pola demografis akibat rekrutmen massal era 1990-an.
      </p>
    </div>

    {/* Chart */}
    <Card className="mb-4">
      <SectionTitle>Jumlah ASN Memasuki Pensiun per Tahun (2026–2035)</SectionTitle>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={PROYEKSI_PENSIUN} margin={{ top: 24, right: 8, left: 0, bottom: 16 }}>
          <defs>
            {[["g1", C.blue], ["g2", C.teal], ["g3", C.coral]].map(([id, color]) => (
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
          <ReferenceLine x="2027" stroke={C.coral} strokeWidth={1.5} strokeDasharray="4 2"
            label={{ value: "+215%", position: "top", fill: C.coral, fontSize: 11, fontWeight: 700, dy: -6 }} />
          <Area type="monotone" dataKey="pendidikan" stroke={C.blue}  strokeWidth={2} fill="url(#g1)" name="Dinas Pendidikan" />
          <Area type="monotone" dataKey="kesehatan"  stroke={C.teal}  strokeWidth={2} fill="url(#g2)" name="Dinas Kesehatan"  />
          <Area type="monotone" dataKey="lainnya"    stroke={C.coral} strokeWidth={2} fill="url(#g3)" strokeDasharray="4 2" name="OPD Lainnya" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>

    {/* Year tiles */}
    <div className="grid grid-cols-5 gap-px bg-gray-200 rounded-2xl overflow-hidden mb-4">
      {[["2026","423"],["2027","1.332"],["2028","2.100"],["2029","2.750"],["2030","2.800"]].map(([yr,val]) => (
        <div key={yr} className={`p-4 text-center ${yr === "2027" ? "bg-orange-50" : "bg-white"}`}>
          <p className="text-xs text-gray-500 mb-1">{yr}</p>
          <p className={`text-xl font-black ${yr === "2027" ? "text-orange-600" : "text-gray-900"}`}
            style={{ fontFamily: "var(--font-display)" }}>{val}</p>
          {yr === "2027" && <p className="text-[10px] text-orange-500 font-bold mt-0.5">+215%</p>}
        </div>
      ))}
    </div>

    {/* OPD Breakdown Table */}
    <Card className="p-0 overflow-hidden mb-6">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <SectionTitle>Breakdown Pensiun per OPD Utama (2026–2030)</SectionTitle>
        <span className="text-[11px] text-gray-400 italic">5 OPD dengan proyeksi tertinggi</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {["OPD", "2026", "2027", "2028", "2029", "2030", "Total 5 Thn", "Urgensi"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { opd: "Dinas Pendidikan",    y: [241,  758, 1200, 1580, 1620], total: 5399, urg: "Kritis"  },
            { opd: "Dinas Kesehatan",     y: [ 98,  334,  540,  710,  720], total: 2402, urg: "Kritis"  },
            { opd: "Dinas PU Bina Marga", y: [ 28,   89,  140,  185,  188], total:  630, urg: "Waspada" },
            { opd: "Dinas Perhubungan",   y: [ 21,   67,  105,  138,  141], total:  472, urg: "Waspada" },
            { opd: "OPD Lainnya (51)",    y: [ 35,   84,  115,  137,  131], total:  502, urg: "Aman"    },
          ].map(({ opd, y, total, urg }) => (
            <tr key={opd} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-bold text-gray-900">{opd}</td>
              {y.map((v, i) => (
                <td key={i} className={`px-4 py-3 text-sm text-right ${i === 1 ? "font-black text-orange-600" : "text-gray-700"}`}
                  style={{ fontFamily: "var(--font-mono)" }}>
                  {v.toLocaleString("id-ID")}
                  {i === 1 && <span className="ml-1 text-[9px] font-black text-orange-400">▲</span>}
                </td>
              ))}
              <td className="px-4 py-3 text-sm font-black text-gray-900 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                {total.toLocaleString("id-ID")}
              </td>
              <td className="px-4 py-3"><StatusBadge status={urg} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500">Data diproyeksikan berdasarkan kolom <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>bup</span> dari SIMPEG. Kolom 2027 disorot karena lonjakan +215% dibanding 2026.</p>
      </div>
    </Card>

    {/* Rekomendasi & Insight */}
    <section className="space-y-3">
      <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
        <AlertTriangle size={14} className="text-orange-500" />
        Rekomendasi &amp; Insight Utama
      </h2>
      <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: GRAD.blue }}>
          <AlertTriangle size={15} className="text-white" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-white text-sm font-bold mb-1.5">Rencanakan Formasi Sekarang — Puncak Pensiun 2027 Sudah Dekat</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              <span className="text-orange-400 font-semibold">Dinas Pendidikan</span> mendominasi proyeksi dengan ±3.889 guru pensiun dalam 5 tahun (2026–2030). Lonjakan +215% pada 2027 bukan anomali data — ini pola demografis dari rekrutmen massal era 1990-an yang kini mencapai BUP secara bersamaan. Setelah 2030, jumlah pensiun menurun bertahap hingga 870 di 2035, memberi ruang pemulihan jika rekrutmen dimulai segera.
            </p>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Insight Kunci</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">▲</span>
                <span>3.855 ASN memasuki BUP dalam 3 tahun (2026–2028). Koordinasi dengan BKN dan Kemendikbud diperlukan untuk mengantisipasi kekosongan JF Guru secara massal.</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">→</span>
                <span>Tetapkan kuota formasi tahunan sesuai proyeksi ini. Prioritaskan <span className="text-white font-semibold">2026 (423 ASN)</span> dan <span className="text-white font-semibold">2027 (1.332 ASN)</span>. Gunakan kolom <span className="font-mono text-[11px] text-blue-300">bup</span> dan <span className="font-mono text-[11px] text-blue-300">klaster</span> dari SIMPEG untuk validasi individual sebelum pengajuan formasi ke BKN.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
);

export default PensiunPage;
