import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CheckCircle, Info, TrendingUp } from "lucide-react";
import { C, GRAD, fmt, KUALITAS_DATA, ANOMALI_DATA } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip } from "../lib/ui";

const TREND_DATA = [
  { bln: "Mar", pns: 91.2, pppkf: 85.1, pppkp: 70.3 },
  { bln: "Apr", pns: 92.0, pppkf: 86.3, pppkp: 71.8 },
  { bln: "Mei", pns: 92.8, pppkf: 87.0, pppkp: 73.2 },
  { bln: "Jun", pns: 93.3, pppkf: 87.8, pppkp: 74.5 },
  { bln: "Jul", pns: 93.9, pppkf: 88.2, pppkp: 75.6 },
  { bln: "Ags", pns: 94.2, pppkf: 88.7, pppkp: 76.3 },
];

const KualitasPage = () => (
  <div className="p-6">
    <PageHeader
      title="Kualitas Data"
      subtitle="Kelengkapan dan validasi data kepegawaian ASN Jawa Timur"
      crumbs={["Kualitas Data"]}
    />

    {/* KPI Cards */}
    <div className="grid grid-cols-3 gap-4 mb-5">
      {KUALITAS_DATA.map(({ sumber, skor, lengkap, total, color }) => (
        <Card key={sumber} hover>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{sumber}</p>
              <p className="text-4xl font-black text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                {skor}<span className="text-xl ml-0.5" style={{ color }}>%</span>
              </p>
            </div>
            <CheckCircle size={22} style={{ color }} />
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div className="h-2 rounded-full transition-all" style={{ width: `${skor}%`, backgroundColor: color }} />
          </div>
          <p className="text-xs text-gray-400">{fmt(lengkap)} dari {fmt(total)} lengkap</p>
        </Card>
      ))}
    </div>

    {/* Transparency note */}
    <div className="border-l-4 border-gray-400 bg-gray-50 rounded-r-2xl p-4 mb-5">
      <div className="flex gap-2.5">
        <Info size={15} className="text-gray-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-gray-700 mb-1">Catatan Transparansi Data</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Seluruh data yang ditampilkan merupakan <strong>data agregat</strong> yang telah melalui anonimisasi.
            Tidak ada data individu (nama, NIP, informasi pribadi) yang ditampilkan atau dapat diakses melalui sistem ini.
          </p>
        </div>
      </div>
    </div>

    {/* Anomali Table */}
    <Card className="p-0 overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-gray-100"><SectionTitle>Anomali & Data Tidak Lengkap</SectionTitle></div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {["Field / Kolom","Jumlah Kosong","% dari Total","Status"].map(h => (
              <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANOMALI_DATA.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-5 py-3 text-sm font-bold text-gray-800">{row.field}</td>
              <td className="px-5 py-3 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{fmt(row.kosong)}</td>
              <td className="px-5 py-3 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{row.pct.toFixed(2)}%</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(row.pct * 20, 100)}%`, backgroundColor: row.pct > 3 ? C.red : row.pct > 1.5 ? C.amber : C.teal }} />
                  </div>
                  <StatusBadge status={row.pct > 3 ? "Kritis" : row.pct > 1.5 ? "Waspada" : "Aman"} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>

    {/* Prioritas + Trend */}
    <div className="grid grid-cols-2 gap-4 mb-6">
      <Card>
        <SectionTitle>
          <TrendingUp size={14} className="text-blue-500" />
          Prioritas Perbaikan Data
        </SectionTitle>
        <div className="space-y-3">
          {[
            { field: "Nomor SK Terakhir",  pct: 4.00, action: "Sinkronisasi dengan SAPK BKN · estimasi 3.210 record perlu diperbarui", urgent: true  },
            { field: "Unit Kerja Detail",  pct: 2.62, action: "Konfirmasi langsung ke OPD terkait melalui portal validasi mandiri",     urgent: true  },
            { field: "TMT Jabatan",        pct: 1.94, action: "Rekonsiliasi data dengan sistem SIMPEG masing-masing OPD",               urgent: false },
            { field: "Tingkat Pendidikan", pct: 1.50, action: "Upload ijazah digital ke modul verifikasi dokumen",                      urgent: false },
          ].map(({ field, pct, action, urgent }) => (
            <div key={field} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${urgent ? "bg-red-500" : "bg-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs font-bold text-gray-800 truncate">{field}</p>
                  <span className="text-[10px] font-black flex-shrink-0" style={{ fontFamily: "var(--font-mono)", color: pct > 3 ? C.red : C.amber }}>{pct}%</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">{action}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Tren Kelengkapan Data</SectionTitle>
        <p className="text-[11px] text-gray-400 mb-3">6 bulan terakhir (Mar–Ags 2026)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={TREND_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="bln" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[68, 96]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="pns"   stroke={C.teal}  strokeWidth={2} dot={false} name="PNS"              />
            <Line type="monotone" dataKey="pppkf" stroke={C.blue}  strokeWidth={2} dot={false} name="PPPK Penuh Waktu" />
            <Line type="monotone" dataKey="pppkp" stroke={C.amber} strokeWidth={2} dot={false} name="PPPK Paruh Waktu" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {[["PNS", C.teal], ["PPPK Penuh Waktu", C.blue], ["PPPK Paruh Waktu", C.amber]].map(([n, c]) => (
            <div key={n} className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: c as string }} />
              <span className="text-[10px] text-gray-500">{n}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>

    {/* Rekomendasi & Insight */}
    <section className="space-y-3">
      <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
        <TrendingUp size={14} className="text-blue-500" />
        Rekomendasi &amp; Insight Utama
      </h2>
      <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle size={15} className="text-white" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-white text-sm font-bold mb-1.5">Data Tidak Lengkap = Skor Risiko Tidak Akurat</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Kolom dengan kekosongan tinggi — terutama <span className="text-orange-400 font-semibold">Nomor SK Terakhir (4,00% kosong, 3.210 record)</span> — langsung memengaruhi keakuratan proyeksi pensiun dan skor risiko regenerasi. Prioritaskan sinkronisasi dengan SAPK BKN dalam 30 hari ke depan.
            </p>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Insight Kunci</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">↑</span>
                <span>Kelengkapan data meningkat konsisten sejak Maret 2026: PNS (91,2% → 94,2%), PPPK Penuh Waktu (85,1% → 88,7%). <span className="text-white font-semibold">PPPK Paruh Waktu masih tertinggal</span> (70,3% → 76,3%) — target 80% pada akhir 2026 perlu akselerasi.</span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">→</span>
                <span>Tetapkan batas waktu validasi mandiri per OPD setiap kuartal. Gunakan portal validasi untuk konfirmasi kolom Unit Kerja Detail dan rekonsiliasi TMT Jabatan langsung dengan SIMPEG masing-masing OPD.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </div>
);

export default KualitasPage;
