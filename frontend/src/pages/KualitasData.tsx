import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CheckCircle, Info, TrendingUp, AlertTriangle } from "lucide-react";
import { C, fmt } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip } from "../lib/ui";

// Warna per sumber data, urutan tetap: PNS -> teal, PPPK Penuh Waktu -> blue, PPPK Paruh Waktu -> amber
const SOURCE_COLOR: Record<string, string> = {
  pns: C.teal,
  pppk_full: C.blue,
  pppk_pw: C.amber,
};

type KpiItem = { key: string; sumber: string; skor: number; lengkap: number; total: number };
type AnomaliItem = {
  field: string; kosong: number; total: number; pct: number; status: string;
  invalid_format?: number; genuinely_kosong?: number;
};
type PrioritasItem = { field: string; pct: number; urgent: boolean; action: string };
type BupBreakdownItem = {
  key: string; sumber: string; valid: number; genuinely_kosong: number;
  invalid_format: number; total: number;
};
type KualitasResponse = {
  periode: string;
  kpi: KpiItem[];
  anomali: AnomaliItem[];
  prioritas: PrioritasItem[];
  bup_breakdown: BupBreakdownItem[];
};

const KualitasPage = () => {
  const [data, setData] = useState<KualitasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/kualitas-data")
      .then((res) => {
        if (!res.ok) throw new Error(`Gagal ambil data (${res.status})`);
        return res.json();
      })
      .then((json: KualitasResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Gagal memuat data kualitas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Kualitas Data" subtitle="Memuat data..." crumbs={["Kualitas Data"]} />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}><div className="h-24 bg-gray-100 rounded-xl animate-pulse" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <PageHeader title="Kualitas Data" subtitle="Kelengkapan dan validasi data kepegawaian ASN Jawa Timur" crumbs={["Kualitas Data"]} />
        <Card>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">{error ?? "Data tidak tersedia"}</p>
          </div>
        </Card>
      </div>
    );
  }

  const { kpi, anomali, prioritas, bup_breakdown } = data;
  // field paling bermasalah, dipakai sekali doang di Insight box (jangan diulang)
  const fieldTerburuk = prioritas[0] ?? null;
  const sumberTerendah = kpi.length ? kpi.reduce((a, b) => (b.skor < a.skor ? b : a)) : null;

  return (
    <div className="p-6">
      <PageHeader
        title="Kualitas Data"
        subtitle="Kelengkapan dan validasi data kepegawaian ASN Jawa Timur"
        crumbs={["Kualitas Data"]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {kpi.map(({ key, sumber, skor, lengkap, total }) => {
          const color = SOURCE_COLOR[key] ?? C.teal;
          return (
            <Card key={key} hover>
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
          );
        })}
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
              Data posisi <strong>{data.periode}</strong>.
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
              {["Field / Kolom", "Jumlah Kosong", "% dari Total", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {anomali.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-5 py-3 text-sm font-bold text-gray-800">
                  {row.field}
                  {typeof row.invalid_format === "number" && row.invalid_format > 0 && (
                    <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                      termasuk {fmt(row.invalid_format)} format tanggal tidak valid
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{fmt(row.kosong)}</td>
                <td className="px-5 py-3 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{row.pct.toFixed(2)}%</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(row.pct * 20, 100)}%`, backgroundColor: row.pct > 4 ? C.red : row.pct > 2 ? C.amber : C.teal }} />
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Prioritas + breakdown TMT BUP per sumber (info baru, bukan re-plot KPI) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionTitle>
            <TrendingUp size={14} className="text-blue-500" />
            Prioritas Perbaikan Data
          </SectionTitle>
          {prioritas.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              Tidak ada field bermasalah saat ini — semua field kunci lengkap.
            </p>
          ) : (
            <div className="space-y-3">
              {prioritas.map(({ field, pct, action, urgent }) => (
                <div key={field} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${urgent ? "bg-red-500" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-bold text-gray-800 truncate">{field}</p>
                      <span className="text-[10px] font-black flex-shrink-0" style={{ fontFamily: "var(--font-mono)", color: pct > 4 ? C.red : C.amber }}>{pct}%</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">{action}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Kondisi Data TMT BUP per Sumber</SectionTitle>
          <p className="text-[11px] text-gray-400 mb-3">
            Ini alasan kenapa PPPK Paruh Waktu skornya lebih rendah — bukan cuma kosong, tapi banyak yang formatnya rusak (bekas 00:00:00 / #N/A di Excel).
          </p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={bup_breakdown} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="sumber" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="valid" stackId="a" name="Valid" fill={C.teal} radius={[0, 0, 0, 0]} />
              <Bar dataKey="genuinely_kosong" stackId="a" name="Kosong asli" fill={C.amber} />
              <Bar dataKey="invalid_format" stackId="a" name="Format tidak valid" fill={C.red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
            {fieldTerburuk ? (
              <p className="text-slate-300 text-sm leading-relaxed">
                Satu-satunya masalah kualitas data yang tercatat saat ini ada di{" "}
                <span className="text-orange-400 font-semibold">{fieldTerburuk.field}</span>. Lihat breakdown per
                sumber di grafik sebelah kiri untuk tau OPD/sumber mana yang paling perlu divalidasi ulang duluan.
              </p>
            ) : (
              <p className="text-slate-300 text-sm leading-relaxed">
                Semua field kunci di 3 sumber data lengkap — tidak ada anomali yang perlu ditindaklanjuti saat ini.
              </p>
            )}
            {sumberTerendah && sumberTerendah.skor < 100 && (
              <p className="text-slate-400 text-xs leading-relaxed border-t border-slate-700 pt-3">
                Rekomendasi tindak lanjut yang lebih spesifik & kontekstual akan ditampilkan lewat fitur Asisten AI.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default KualitasPage;