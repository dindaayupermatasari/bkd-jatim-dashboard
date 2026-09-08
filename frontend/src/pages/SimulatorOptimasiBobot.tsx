import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { Play, Info, Award, Sliders } from "lucide-react";
import {
  C, GRAD, riskLabel, riskColor,
  OPD_DATA, KONVERGENSI, ALGO_DATA, DEFAULT_WEIGHTS, OPT_WEIGHTS, OPD_SKOR_OPT, ALGO_DEFAULTS_SUMMARY,
} from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge, ChartTip } from "../lib/ui";

type AlgoKey = "GA" | "PSO" | "SA";
type TabKey  = AlgoKey | "all";

const ALGO_PARAMS: Record<AlgoKey, { label: string; min: number; max: number; default: number; unit: string }[]> = {
  GA: [
    { label: "Ukuran Populasi",     min: 20,  max: 500, default: 100, unit: "individu" },
    { label: "Jumlah Iterasi",      min: 50,  max: 500, default: 200, unit: "generasi" },
    { label: "Tingkat Mutasi",      min: 1,   max: 30,  default: 10,  unit: "%"        },
  ],
  PSO: [
    { label: "Jumlah Partikel",     min: 10,  max: 200, default: 50,  unit: "partikel" },
    { label: "Jumlah Iterasi",      min: 50,  max: 500, default: 180, unit: "iterasi"  },
    { label: "Bobot Inersia (×10)", min: 1,   max: 9,   default: 7,   unit: ""         },
  ],
  SA: [
    { label: "Suhu Awal (×100)",    min: 1,   max: 100, default: 10,  unit: ""         },
    { label: "Laju Pendinginan",    min: 80,  max: 99,  default: 95,  unit: "%"        },
    { label: "Jumlah Iterasi",      min: 50,  max: 500, default: 250, unit: "iterasi"  },
  ],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const WeightsPanel = ({ algo, label }: { algo: AlgoKey; label: string }) => {
  const optWeights = OPT_WEIGHTS[algo];
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Bobot Kriteria — {label}</SectionTitle>
        <span className="text-[11px] text-gray-400">vs. bobot default manual</span>
      </div>
      <div className="space-y-3">
        {optWeights.map((w, i) => {
          const def  = DEFAULT_WEIGHTS[i].pct;
          const diff = w.pct - def;
          return (
            <div key={w.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-700">{w.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Default: {def}%</span>
                  <span className="text-xs font-black" style={{ color: diff > 0 ? C.teal : diff < 0 ? C.coral : "#9CA3AF" }}>
                    {diff > 0 ? `+${diff}%` : `${diff}%`}
                  </span>
                  <span className="text-sm font-black text-gray-900 w-10 text-right" style={{ fontFamily: "var(--font-mono)" }}>{w.pct}%</span>
                </div>
              </div>
              <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute h-full rounded-full opacity-25" style={{ width: `${def}%`, backgroundColor: w.color }} />
                <div className="absolute h-full rounded-full" style={{ width: `${w.pct}%`, backgroundColor: w.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-start gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <Info size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-500 leading-snug">
          {label} menemukan bahwa kolom <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>umur</span> memiliki korelasi lebih kuat terhadap risiko regenerasi.
          Kolom <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>klaster</span> mendapat bobot lebih rendah karena distribusinya kurang diskriminatif antar OPD.
        </p>
      </div>
    </Card>
  );
};

const OPDRankingPanel = ({ algo }: { algo: AlgoKey }) => {
  const optScoreMap = OPD_SKOR_OPT[algo];
  const rankedOPDs  = [...OPD_DATA]
    .map(opd => ({ ...opd, skorOpt: optScoreMap[opd.id] ?? opd.skor }))
    .sort((a, b) => a.skorOpt - b.skorOpt);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <SectionTitle>Ranking Risiko OPD — Bobot Dioptimasi vs Default</SectionTitle>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: C.teal }}>▲</span>
            <span className="text-xs text-gray-500">Skor naik = risiko berkurang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: C.coral }}>▼</span>
            <span className="text-xs text-gray-500">Skor turun = risiko meningkat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            <span className="text-xs text-gray-500">Baris kuning = perubahan kategori</span>
          </div>
        </div>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {["Nama OPD", "Skor Default", "Skor Optimasi", "Pergeseran", "Status Baru"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankedOPDs.map(opd => {
            const diff      = opd.skorOpt - opd.skor;
            const statusNew = riskLabel(opd.skorOpt);
            const statusOld = riskLabel(opd.skor);
            const changed   = statusNew !== statusOld;
            return (
              <tr key={opd.id} className={`border-b border-gray-100 last:border-0 ${changed ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  {opd.nama}
                  {changed && <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Berubah</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500" style={{ fontFamily: "var(--font-mono)" }}>
                  {opd.skor} <span className="text-xs text-gray-400">({statusOld})</span>
                </td>
                <td className="px-4 py-3 text-sm font-black" style={{ fontFamily: "var(--font-mono)", color: riskColor(opd.skorOpt) }}>
                  {opd.skorOpt}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-bold" style={{ color: diff > 0 ? C.teal : diff < 0 ? C.coral : "#9CA3AF" }}>
                    {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : "—"}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={statusNew} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
};

// ── SPK Page ──────────────────────────────────────────────────────────────────

const SPKPage = ({ onNav }: { onNav?: (id: string) => void }) => {
  const [tab, setTab]       = useState<TabKey>("GA");
  const [params, setParams] = useState<Record<AlgoKey, number[]>>({
    GA:  [100, 200, 10],
    PSO: [50,  180, 7 ],
    SA:  [10,  95,  250],
  });
  const [loading, setLoading]     = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const isAll   = tab === "all";
  const algoTab = isAll ? "GA" : (tab as AlgoKey);

  const setParam = (algo: AlgoKey, i: number, v: number) =>
    setParams(p => ({ ...p, [algo]: p[algo].map((x, j) => (j === i ? v : x)) }));

  const handleRun = () => {
    setLoading(true);
    setHasResult(false);
    setTimeout(() => { setLoading(false); setHasResult(true); }, 2200);
  };

  const singleConvData = KONVERGENSI.map(d => ({ iter: d.iter, fitness: d[algoTab as keyof typeof d] as number }));
  const bestAlgoRow    = ALGO_DATA.find(a => a.terbaik);
  const bestAlgoKey    = (bestAlgoRow?.algo.includes("GA") ? "GA" : bestAlgoRow?.algo.includes("PSO") ? "PSO" : "SA") as AlgoKey;

  return (
    <div className="p-6">
      <PageHeader
        title="Simulator Optimasi Bobot Kriteria"
        subtitle="Algoritma mencari kombinasi bobot kriteria terbaik untuk menghasilkan ranking risiko OPD yang paling akurat"
        crumbs={["Simulator Optimasi Bobot Kriteria"]}
      />

      {/* Analyst caption */}
      <p className="text-xs text-gray-500 mb-4 max-w-2xl leading-relaxed">
        Halaman ini untuk tim analis yang menyesuaikan cara sistem menghitung skor.
        Untuk kebutuhan sehari-hari, gunakan halaman{" "}
        <button onClick={() => onNav?.("opd")}
          className="font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          Perbandingan Antar OPD →
        </button>
      </p>

      {/* Link-to-OPD context note */}
      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 w-fit">
        <Info size={13} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Bobot hasil optimasi ini dipakai untuk menghitung skor di halaman{" "}
          <button onClick={() => onNav?.("opd")} className="font-bold hover:underline">Perbandingan Antar OPD →</button>
        </p>
      </div>

      {/* Algo tab bar — single source of algorithm selection */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5 w-fit mb-5">
        {(["GA", "PSO", "SA", "all"] as TabKey[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setHasResult(false); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab === t ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-800"}`}>
            {t === "all" ? "Bandingkan Semua" : t}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {isAll ? (
            <>
              <Card>
                <SectionTitle>Parameter Default</SectionTitle>
                <p className="text-[11px] text-gray-400 mb-4 leading-snug">
                  Semua algoritma dijalankan dengan parameter standar yang telah dikalibrasi untuk dataset kepegawaian Jawa Timur.
                </p>
                <div className="space-y-4">
                  {ALGO_DEFAULTS_SUMMARY.map(({ algo, items }) => (
                    <div key={algo}>
                      <p className="text-xs font-black text-gray-700 mb-1.5">{algo}</p>
                      <div className="space-y-1">
                        {items.map(item => (
                          <div key={item} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                            <span className="text-[11px] text-gray-500">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-1.5 bg-blue-50 rounded-xl p-3">
                  <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-600 leading-snug">
                    Jalankan algoritma secara individual untuk mengatur parameter masing-masing secara khusus.
                  </p>
                </div>
              </Card>
              <button onClick={handleRun} disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60 min-h-[52px]"
                style={{ background: GRAD.blue }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Menjalankan Semua...</>
                  : <><Play size={16} />Jalankan Perbandingan Semua Algoritma</>}
              </button>
            </>
          ) : (
            <>
              <Card>
                <SectionTitle>Parameter {tab}</SectionTitle>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4 leading-snug">
                  {tab === "GA"  && "Genetic Algorithm — simulasi seleksi alam untuk menemukan bobot optimal secara evolusioner."}
                  {tab === "PSO" && "Particle Swarm Optimization — kawanan partikel bergerak menuju bobot terbaik secara kolektif."}
                  {tab === "SA"  && "Simulated Annealing — penurunan suhu bertahap untuk keluar dari solusi lokal dan menemukan optimum global."}
                </p>
                <div className="space-y-5">
                  {ALGO_PARAMS[algoTab].map((p, i) => (
                    <div key={p.label}>
                      <div className="flex justify-between mb-1.5">
                        <label className="text-xs text-gray-600">{p.label}</label>
                        <span className="text-xs font-black text-blue-700" style={{ fontFamily: "var(--font-mono)" }}>
                          {params[algoTab][i]}{p.unit ? ` ${p.unit}` : ""}
                        </span>
                      </div>
                      <input type="range" min={p.min} max={p.max} value={params[algoTab][i]}
                        onChange={e => setParam(algoTab, i, +e.target.value)} className="w-full accent-blue-600" />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>{p.min}</span><span>{p.max}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-1.5 bg-blue-50 rounded-xl p-3">
                  <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[10px] text-blue-600 leading-snug space-y-0.5">
                    <p className="font-bold mb-1">4 kriteria dari kolom SIMPEG:</p>
                    {DEFAULT_WEIGHTS.map(w => (
                      <p key={w.key}><span className="font-semibold">{w.label}</span> <span className="opacity-70" style={{ fontFamily: "var(--font-mono)" }}>({w.kolom})</span></p>
                    ))}
                  </div>
                </div>
              </Card>
              <button onClick={handleRun} disabled={loading}
                className="w-full py-3.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60 min-h-[52px]"
                style={{ background: GRAD.blue }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Menjalankan {tab}...</>
                  : <><Play size={16} />Jalankan Optimasi {tab}</>}
              </button>
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-4 min-w-0">
          {hasResult ? (
            isAll ? (
              <>
                <Card>
                  <SectionTitle>Kurva Konvergensi — GA · PSO · SA</SectionTitle>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={KONVERGENSI}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="iter" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                        label={{ value: "Iterasi", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[60, 100]}
                        label={{ value: "Fitness", angle: -90, position: "insideLeft", fontSize: 11, fill: "#9ca3af" }} />
                      <Tooltip content={<ChartTip />} />
                      <Legend iconSize={10} formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
                      <Line type="monotone" dataKey="GA"  stroke={C.blue}   strokeWidth={2.5} dot={false} name="Genetic Algorithm"    />
                      <Line type="monotone" dataKey="PSO" stroke={C.teal}   strokeWidth={2.5} dot={false} name="Particle Swarm"        />
                      <Line type="monotone" dataKey="SA"  stroke={C.purple} strokeWidth={2}   dot={false} strokeDasharray="5 3" name="Simulated Annealing" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="flex items-center gap-4" style={{ borderColor: "#DBEAFE", background: "#EFF6FF" }}>
                    <Award size={28} className="text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-600 mb-0.5">Algoritma Terbaik</p>
                      <p className="text-lg font-black text-blue-900" style={{ fontFamily: "var(--font-display)" }}>{bestAlgoRow?.algo}</p>
                      <p className="text-xs text-blue-600">Fitness {bestAlgoRow?.fitness} · {bestAlgoRow?.iter} iterasi · {bestAlgoRow?.waktu}</p>
                    </div>
                  </Card>
                  <Card>
                    <p className="text-xs font-bold text-gray-500 mb-2">Kesimpulan</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      GA menghasilkan solusi terbaik dengan selisih 2,6 poin di atas PSO dan 4,2 poin di atas SA untuk dataset kepegawaian ini.
                    </p>
                  </Card>
                </div>
                <Card className="p-0 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100"><SectionTitle>Tabel Perbandingan</SectionTitle></div>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Algoritma", "Waktu Eksekusi", "Nilai Fitness", "Konvergen (Iterasi)", ""].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALGO_DATA.map((a, i) => (
                        <tr key={i} className={`border-b border-gray-100 last:border-0 ${a.terbaik ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                          <td className="px-5 py-3.5 text-sm font-bold text-gray-900">{a.algo}</td>
                          <td className="px-5 py-3.5 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{a.waktu}</td>
                          <td className="px-5 py-3.5 text-sm font-black" style={{ fontFamily: "var(--font-mono)", color: a.terbaik ? C.blue : "#374151" }}>{a.fitness}</td>
                          <td className="px-5 py-3.5 text-sm text-gray-700" style={{ fontFamily: "var(--font-mono)" }}>{a.iter}</td>
                          <td className="px-5 py-3.5">
                            {a.terbaik && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                                <Award size={11} />Terbaik
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <WeightsPanel algo={bestAlgoKey} label={`${bestAlgoRow?.algo} (Terbaik)`} />
                <OPDRankingPanel algo={bestAlgoKey} />
              </>
            ) : (
              <>
                <Card>
                  <SectionTitle>Kurva Konvergensi — {tab}</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={singleConvData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="iter" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                        label={{ value: "Iterasi", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[60, 100]}
                        label={{ value: "Fitness", angle: -90, position: "insideLeft", fontSize: 11, fill: "#9ca3af" }} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="fitness" stroke={C.blue} strokeWidth={2.5} dot={false} name={`Fitness ${tab}`} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-3 gap-4 border-t border-gray-100 pt-3">
                    {[
                      { label: "Nilai Fitness Terbaik",  val: ALGO_DATA.find(a => a.algo.includes(`(${tab})`))?.fitness?.toFixed(1), accent: true },
                      { label: "Konvergen pada Iterasi", val: ALGO_DATA.find(a => a.algo.includes(`(${tab})`))?.iter },
                      { label: "Waktu Eksekusi",         val: ALGO_DATA.find(a => a.algo.includes(`(${tab})`))?.waktu },
                    ].map(({ label, val, accent }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                        <p className="text-xl font-black" style={{ fontFamily: "var(--font-display)", color: accent ? C.blue : "#1f2937" }}>
                          {val ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
                <WeightsPanel algo={algoTab} label={tab} />
                <OPDRankingPanel algo={algoTab} />
              </>
            )
          ) : (
            <Card className="flex items-center justify-center" style={{ minHeight: 400 }}>
              <div className="text-center">
                <Sliders size={40} className="text-gray-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-gray-500 mb-1">
                  {isAll ? "Belum ada hasil perbandingan" : `Siap Menjalankan ${tab}`}
                </p>
                <p className="text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                  {isAll
                    ? "Klik \"Jalankan Perbandingan Semua Algoritma\" untuk melihat hasil GA, PSO, dan SA secara berdampingan."
                    : <>Atur parameter di panel kiri, lalu klik <strong>"Jalankan Optimasi {tab}"</strong> untuk mencari bobot kriteria terbaik secara otomatis.</>}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Insight — shown after run */}
      {hasResult && (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
            <Award size={14} className="text-blue-500" />
            Rekomendasi &amp; Insight Utama
          </h2>
          <div className="flex items-start gap-4 bg-slate-800 rounded-2xl p-5">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Award size={15} className="text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-white text-sm font-bold mb-1.5">GA Terbaik untuk Dataset Kepegawaian Jawa Timur</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="text-blue-300 font-semibold">Genetic Algorithm</span> menghasilkan fitness tertinggi (97,8) dalam 200 iterasi — unggul 2,6 poin di atas PSO dan 4,2 poin di atas SA. Untuk dataset 80.277 ASN dan 56 OPD, GA direkomendasikan sebagai algoritma utama dalam menentukan bobot kriteria ranking risiko.
                </p>
              </div>
              <div className="border-t border-slate-700 pt-3">
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">Insight Kunci</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">↑</span>
                    <span>Kolom <span className="font-mono text-[11px] text-blue-300">umur</span> mendapat bobot tertinggi dari semua algoritma (GA: 38%, PSO: 35%, SA: 36%) — di atas default 30%. Distribusi usia adalah faktor paling diskriminatif untuk risiko regenerasi antar OPD.</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <span className="text-orange-400 font-bold flex-shrink-0 mt-0.5">→</span>
                    <span>Gunakan bobot hasil GA untuk ranking OPD prioritas rekrutmen. <span className="text-white font-semibold">Perbarui setiap siklus anggaran</span> — validasi dengan data SIMPEG terbaru sebelum pengajuan formasi ke BKN.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default SPKPage;
