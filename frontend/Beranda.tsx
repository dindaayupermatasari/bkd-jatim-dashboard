import React, { useState } from "react";
import {
  BarChart as ReBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Download, Calendar,
  Bot, FileText, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { C, GRAD, fmt, riskLabel, riskColor, STATUS_DATA, GENERASI_DATA, GENERASI_BY_STATUS, PROYEKSI_PENSIUN, OPD_DATA } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip, GhostBtn } from "../lib/ui";

// ── Eselon risk data ──────────────────────────────────────────────────────────
const ESELON_RISK = [
  { eselon: "Eselon I",   jumlah: 2,   label: "JPT Madya"     },
  { eselon: "Eselon II",  jumlah: 18,  label: "JPT Pratama"   },
  { eselon: "Eselon III", jumlah: 94,  label: "Administrator" },
  { eselon: "Eselon IV",  jumlah: 312, label: "Pengawas"      },
];

// ── Top 10 OPD by headcount ───────────────────────────────────────────────────
const TOP_OPD_BY_SIZE = [
  { opd: "Dinas Pendidikan",           total: 52809 },
  { opd: "Dinas Kesehatan",            total:  8920 },
  { opd: "Dinas PU Bina Marga",        total:  3120 },
  { opd: "Satuan Polisi PP",           total:  2780 },
  { opd: "Dinas Sosial",               total:  2340 },
  { opd: "Dinas Perhubungan",          total:  1560 },
  { opd: "Badan Pendapatan Daerah",    total:  1840 },
  { opd: "Dinas Kelautan & Perikanan", total:   876 },
  { opd: "Badan Kesbangpol",           total:   312 },
  { opd: "Badan Kepegawaian Daerah",   total:   245 },
];

// ── Beranda Page ──────────────────────────────────────────────────────────────

const BerandaPage = ({ onNav }: { onNav: (id: string) => void }) => {
  const [expandedOPD, setExpandedOPD] = useState<number | null>(null);
  const sortedOPD = [...OPD_DATA].sort((a, b) => a.skor - b.skor);

  return (
    <div className="p-6 space-y-5">

      {/* ── KPI Cards ── */}
      <section className="relative rounded-2xl overflow-hidden" style={{ background: GRAD.hero }}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative p-8">
          <div className="flex items-start justify-between gap-8 flex-wrap mb-5">
            <div>
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Total ASN Aktif · Agustus 2026</p>
              <p className="font-black text-white leading-none mb-3"
                style={{ fontSize: "clamp(48px,7vw,72px)", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>
                80.277
              </p>
              <p className="text-blue-100 text-sm">Pegawai terdaftar di 56 OPD Provinsi Jawa Timur</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white border border-white/20"
                style={{ background: "rgba(249,115,22,0.25)", backdropFilter: "blur(8px)" }}>
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
                3.855 pegawai akan memasuki BUP dalam 3 tahun ke depan (2026–2028)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              {[
                { label: "PNS",               val: "35.744",    sub: "44,5%" },
                { label: "PPPK Penuh Waktu",  val: "23.310",    sub: "29,0%" },
                { label: "PPPK Paruh Waktu",  val: "21.223",    sub: "26,5%" },
                { label: "Rata-rata Usia",     val: "41,2 thn",  sub: "Seluruh ASN" },
              ].map(({ label, val, sub }) => (
                <div key={label} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3">
                  <p className="text-blue-200 text-[11px] mb-1">{label}</p>
                  <p className="text-white font-black text-xl leading-none" style={{ fontFamily: "var(--font-display)" }}>{val}</p>
                  <p className="text-blue-300 text-[11px] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── KOMPOSISI & DISTRIBUSI GENERASI ── */}
      <section>
        <Card>
          <div className="flex items-center justify-between mb-5">
            <SectionTitle>Komposisi &amp; Distribusi Generasi</SectionTitle>
            <span className="text-xs text-gray-400 italic">Data agregat per Agustus 2026</span>
          </div>
          <div className="grid grid-cols-3 gap-5">

            {/* Status Kepegawaian */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Status Kepegawaian</p>
              <ResponsiveContainer width="100%" height={190}>
                <ReBarChart data={STATUS_DATA} barSize={40} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.replace("PPPK ","").replace("Penuh Waktu","PW").replace("Paruh Waktu","PP")} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}rb`} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="value" name="Jumlah ASN" radius={[5, 5, 0, 0]}>
                    {STATUS_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {STATUS_DATA.map(d => (
                  <div key={d.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Komposisi Generasi per Status */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Komposisi Generasi per Status</p>
              <ResponsiveContainer width="100%" height={190}>
                <ReBarChart data={GENERASI_BY_STATUS} layout="vertical" barSize={26} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 9 }}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}rb` : `${v}`}
                    axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={58}
                    tickFormatter={v => v.replace("PPPK Penuh Waktu","PPPK FT").replace("PPPK Paruh Waktu","PPPK PW")} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="BabyBoom" stackId="s" fill={C.coral}  name="Baby Boomer" />
                  <Bar dataKey="GenX"     stackId="s" fill={C.blue}   name="Generasi X"  />
                  <Bar dataKey="Milenial" stackId="s" fill={C.teal}   name="Milenial"    />
                  <Bar dataKey="GenZ"     stackId="s" fill={C.purple} name="Gen Z" radius={[0,4,4,0]} />
                </ReBarChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {[["Baby Boomer",C.coral],["Generasi X",C.blue],["Milenial",C.teal],["Gen Z",C.purple]].map(([n,c]) => (
                  <div key={n} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: c as string }} />
                    <span className="text-[10px] text-gray-500">{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribusi Generasi (Donut) */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Distribusi Generasi (Total)</p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={GENERASI_DATA} cx="50%" cy="48%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value"
                    label={({ cx, cy, midAngle, outerRadius: or, percent }: any) => {
                      if (percent < 0.03) return null;
                      const RAD = Math.PI / 180;
                      const r = or + 18;
                      const x = cx + r * Math.cos(-midAngle * RAD);
                      const y = cy + r * Math.sin(-midAngle * RAD);
                      return (
                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                          style={{ fontSize: 10, fontWeight: 700, fill: "#374151", fontFamily: "var(--font-mono)" }}>
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}>
                    {GENERASI_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-1">
                {GENERASI_DATA.map(d => (
                  <div key={d.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[11px] text-gray-600">{d.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-gray-800" style={{ fontFamily: "var(--font-mono)" }}>{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ── 2-col row: Proyeksi Pensiun + Sebaran Pegawai per OPD ── */}
      <section className="grid grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle>
              <Calendar size={14} className="text-orange-500" />
              Proyeksi Pensiun per Tahun (2026–2031)
            </SectionTitle>
            <button onClick={() => onNav("pensiun")} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
              Detail <ArrowRight size={11} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ReBarChart data={PROYEKSI_PENSIUN.slice(0, 6)} barSize={34} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total" name="Total Pensiun" radius={[5, 5, 0, 0]}>
                {PROYEKSI_PENSIUN.slice(0, 6).map((d, i) => (
                  <Cell key={i} fill={d.year === "2027" ? C.coral : C.blue} fillOpacity={d.year === "2027" ? 1 : 0.75} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: C.blue, opacity: 0.75 }} />
              <span className="text-[10px] text-gray-500">Tahun normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: C.coral }} />
              <span className="text-[10px] text-gray-500">Lonjakan 2027 (+215%)</span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>
            <TrendingUp size={14} className="text-blue-500" />
            Sebaran Pegawai per OPD — Top 10
          </SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ReBarChart data={TOP_OPD_BY_SIZE} layout="vertical" barSize={16} margin={{ left: 0, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}rb` : `${v}`} />
              <YAxis type="category" dataKey="opd" tick={{ fontSize: 9.5 }} axisLine={false} tickLine={false} width={148} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="total" name="Jumlah Pegawai" radius={[0, 4, 4, 0]}>
                {TOP_OPD_BY_SIZE.map((d, i) => (
                  <Cell key={i} fill={i === 0 ? C.coral : C.blue} fillOpacity={i === 0 ? 1 : 0.65} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ── Risiko Kekosongan Jabatan Struktural (chart only) ── */}
      <section>
        <Card>
          <SectionTitle>
            <AlertTriangle size={14} className="text-amber-500" />
            Risiko Kekosongan Jabatan Struktural (BUP ≤ 2 Tahun)
          </SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <ReBarChart data={ESELON_RISK} layout="vertical" barSize={24} margin={{ left: 0, right: 48 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="eselon" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="jumlah" name="Pejabat mendekati BUP" radius={[0, 4, 4, 0]}>
                {ESELON_RISK.map((d, i) => (
                  <Cell key={i} fill={i === 0 ? C.red : i === 1 ? C.coral : i === 2 ? C.amber : C.blue} />
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ── OPD RISK RANKING ── */}
      <section>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>
              <TrendingUp size={14} className="text-orange-500" />
              Profil Risiko Regenerasi OPD
            </SectionTitle>
            <button onClick={() => onNav("opd")} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
              Lihat semua 56 OPD <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {sortedOPD.slice(0, 5).map(opd => {
              const label = riskLabel(opd.skor);
              const color = riskColor(opd.skor);
              const isOpen = expandedOPD === opd.id;
              return (
                <div key={opd.id}>
                  <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors group"
                    onClick={() => setExpandedOPD(isOpen ? null : opd.id)}>
                    <div className="w-32 flex-shrink-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{opd.nama}</p>
                      <p className="text-[10px] text-gray-400">{fmt(opd.total)} pegawai</p>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${opd.skor}%`, backgroundColor: color }} />
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-sm font-black" style={{ color, fontFamily: "var(--font-mono)" }}>{opd.skor}</span>
                    </div>
                    <StatusBadge status={label} />
                    {isOpen ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />}
                  </div>
                  {isOpen && (
                    <div className="mx-3 mb-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        {[
                          { label: "Rata-rata Usia", val: `${opd.rataUsia} thn`, bar: (opd.rataUsia / 60) * 100 },
                          { label: "Pendidikan S1+", val: `${opd.pctS1}%`,       bar: opd.pctS1 },
                          { label: "Usia >50 Tahun", val: `${opd.pctTua}%`,      bar: opd.pctTua },
                        ].map(({ label, val, bar }) => (
                          <div key={label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-500">{label}</span>
                              <span className="text-xs font-bold text-gray-700">{val}</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(bar, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{opd.detail}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Menampilkan 5 OPD risiko tertinggi dari total 56 OPD</p>
            <button onClick={() => onNav("opd")} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
              Selengkapnya <ArrowRight size={11} />
            </button>
          </div>
        </Card>
      </section>

      {/* ── ACTIONS ── */}
      <section className="flex items-center gap-3 flex-wrap">
        <GhostBtn icon={Download}>Ekspor Laporan</GhostBtn>
      </section>

      {/* ── REKOMENDASI AI & INSIGHT UTAMA ── */}
      <section className="space-y-3">
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
              <p className="text-white text-sm font-bold mb-1.5">Rekomendasi AI — Genetic Algorithm</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Berdasarkan analisis GA terhadap 80.277 ASN, <span className="text-orange-400 font-bold">Dinas Pendidikan</span> menunjukkan risiko regenerasi tertinggi (skor komposit 42/100) — 65,8% ASN provinsi terkonsentrasi di sini, dengan puncak pensiun massal pada 2027 (+215%).
                Alokasikan <span className="text-blue-300 font-bold">420 formasi JF Guru</span> sebagai prioritas rekrutmen 2025–2026, dikombinasikan dengan kaderisasi struktural untuk mengisi 312 jabatan Eselon IV yang akan kosong dalam 2 tahun ke depan.
              </p>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Insight Kunci</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                  <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">▲</span>
                  <span><span className="text-white font-semibold">1.332 ASN pensiun pada 2027</span> — lonjakan +215% dari 423 di 2026. Dinas Pendidikan (758) dan Dinas Kesehatan (334) sebagai penyumbang terbesar.</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                  <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">⚠</span>
                  <span><span className="text-white font-semibold">312 pejabat Eselon IV (Pengawas)</span> mendekati BUP — jabatan struktural yang tidak bisa diisi PPPK. Kaderisasi harus dimulai segera agar tidak terjadi kekosongan jabatan yang berdampak pada layanan publik.</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                  <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">→</span>
                  <span>Milenial mendominasi komposisi (54,8%) namun Gen X — yang paling banyak menempati jabatan struktural — akan pensiun massal mulai 2027. Gunakan skor komposit per OPD, bukan sekadar ranking jumlah pegawai, untuk membandingkan risiko secara proporsional.</span>
                </li>
              </ul>
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
