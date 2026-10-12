import React, { useState, useEffect } from "react";
import {
  Search, Download, Info, ChevronUp, ChevronDown, Shield, Layers,
  AlertTriangle, Sparkles, Loader2,
} from "lucide-react";
import { C, GRAD, fmt } from "../lib/constants";
import { Card, SectionTitle, PageHeader, StatusBadge } from "../lib/ui";

const PAGE_SIZE = 10;

// ── Tipe data, PERSIS mengikuti field yang dikirim backend
// (app/services/opd_service.py -> compute_perbandingan_opd) ──────────────────

type Kategori = "Kritis" | "Waspada" | "Aman";
type JabatanBadge = "Str" | "Fun" | "Pel" | "Lainnya";

interface JabatanRisiko { badge: JabatanBadge; nama: string; jumlah: number }

interface OpdRow {
  id: number;
  nama: string;
  total_asn: number;
  rata_usia: number;
  pensiun_0_6: number;
  pensiun_6_12: number;
  pensiun_12_bulan: number;
  pensiun_12_bulan_pct: number;

  skor_komposit: number;
  kategori: Kategori;

  skor_struktural: number;
  kategori_struktural: Kategori;
  jumlah_struktural_kosong_12bln: number;

  skor_fungsional: number;
  kategori_fungsional: Kategori;
  perlu_perhatian: boolean;

  kontribusi_skor: { usia: number; bup: number; jenis_jabatan: number; klaster: number; generasi: number };
  komposisi_generasi: { baby_boom: number; gen_x: number; milenial: number; gen_z: number };
  jabatan_berisiko: { "0-6": JabatanRisiko[]; "6-12": JabatanRisiko[] };
}

// Konsisten dengan threshold di backend (_kategori() di opd_service.py):
// Kritis < 60, Waspada < 75, Aman >= 75. Kalau threshold backend berubah,
// ubah juga di sini biar warna gak salah baca.
const kategoriColor = (k: Kategori) =>
  k === "Kritis" ? C.coral : k === "Waspada" ? C.amber : C.teal;

const JENIS_LABEL: Record<JabatanBadge, string> = {
  Str: "Struktural", Fun: "Fungsional", Pel: "Pelaksana", Lainnya: "Lainnya",
};
const JENIS_STYLE: Record<JabatanBadge, string> = {
  Str: "bg-red-50 text-red-700 border border-red-200",
  Fun: "bg-blue-50 text-blue-700 border border-blue-200",
  Pel: "bg-gray-100 text-gray-600 border border-gray-200",
  Lainnya: "bg-gray-100 text-gray-600 border border-gray-200",
};

const KRITERIA_LABELS: Record<string, string> = {
  usia: "Usia Pegawai",
  bup: "Kepadatan Pensiun (12 Bulan)",
  jenis_jabatan: "Ketergantungan Jabatan Struktural",
  klaster: "Keragaman Klaster SDM",
  generasi: "Komposisi Generasi Ideal",
};
const KRITERIA_COLORS = [C.coral, C.amber, C.blue, C.teal, C.blue];

// Ringkasan faktual dari angka yang ada — BUKAN rekomendasi bisnis detail.
// Rekomendasi yang lebih kontekstual (formasi spesifik, dsb) rencananya
// dari fitur Asisten AI, sesuai keputusan sebelumnya.
function buildAlasan(o: OpdRow): string {
  const parts = [
    `${o.pensiun_12_bulan} pegawai (${o.pensiun_12_bulan_pct}%) diprediksi pensiun dalam 12 bulan`,
  ];
  if (o.jumlah_struktural_kosong_12bln > 0) {
    parts.push(`${o.jumlah_struktural_kosong_12bln} jabatan struktural berisiko kosong dalam periode sama`);
  }
  return parts.join("; ");
}

function buildRekomendasi(o: OpdRow): string {
  if (o.jumlah_struktural_kosong_12bln > 0) {
    return `Prioritaskan penyiapan pengganti untuk ${o.jumlah_struktural_kosong_12bln} jabatan struktural (hanya bisa diisi PNS). Detail rekomendasi lengkap tersedia di Asisten AI.`;
  }
  return "Pantau kebutuhan rekrutmen untuk jabatan fungsional/pelaksana yang akan pensiun.";
}

// ── AI Insight per OPD ─────────────────────────────────────────────────────
// Endpoint: GET /api/insights/opd/{id}. Backend yang mengurus cache di Supabase
// (tabel ai_insights_opd_cache) dan hanya generate ulang kalau data OPD berubah.

type InsightLevel = "critical" | "warning" | "info";

interface OpdInsight {
  headline: string;
  insights: { level: InsightLevel; text: string }[];
  generated_at: string;
  cached: boolean;
  stale?: boolean;
}

// Cache sementara selama halaman terbuka, supaya buka-tutup baris OPD yang
// sama tidak memanggil backend berulang. Dikosongkan tiap halaman dimuat ulang.
const insightRequests = new Map<number, Promise<OpdInsight>>();

function fetchOpdInsight(id: number): Promise<OpdInsight> {
  let req = insightRequests.get(id);
  if (!req) {
    req = fetch(`/api/insights/opd/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<OpdInsight>;
      })
      .catch(err => {
        insightRequests.delete(id);
        throw err;
      });
    insightRequests.set(id, req);
  }
  return req;
}

function useOpdInsight(id: number) {
  const [state, setState] = useState<{ data: OpdInsight | null; loading: boolean; error: string | null }>(
    { data: null, loading: true, error: null },
  );

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchOpdInsight(id)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err.message || "Gagal memuat insight" }); });
    return () => { cancelled = true; };
  }, [id]);

  return state;
}

const LEVEL_DOT: Record<InsightLevel, string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-blue-400",
};

const formatWaktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const AiInsightCard = ({ opd }: { opd: OpdRow }) => {
  const { data, loading, error } = useOpdInsight(opd.id);

  return (
    <div className="flex items-start gap-3 bg-slate-800 rounded-xl p-4">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-bold mb-1.5">Insight AI</p>

        {loading && (
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span>Menyusun insight untuk OPD ini...</span>
          </div>
        )}

        {!loading && (error || !data) && (
          <>
            <p className="text-slate-300 text-sm leading-relaxed">{buildRekomendasi(opd)}</p>
            <p className="text-[10px] text-slate-500 mt-2">Insight AI belum bisa dimuat, menampilkan ringkasan standar.</p>
          </>
        )}

        {!loading && data && (
          <>
            {data.headline && <p className="text-slate-200 text-sm leading-relaxed">{data.headline}</p>}
            {data.insights.length > 0 && (
              <ul className="space-y-2 mt-3 pt-3 border-t border-slate-700">
                {data.insights.map((it, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-slate-300 text-sm leading-relaxed">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${LEVEL_DOT[it.level] ?? LEVEL_DOT.info}`} />
                    <span>{it.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-slate-500 mt-3">
              Dibuat AI pada {formatWaktu(data.generated_at)}
              {data.stale ? " · AI sedang tidak tersedia, menampilkan hasil terakhir" : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ── Fetch hook ─────────────────────────────────────────────────────────────

function usePerbandinganOpd() {
  const [data, setData] = useState<OpdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    insightRequests.clear();
    fetch("/api/perbandingan-opd", { cache: "no-store" })
      .then(res => {
        if (!res.ok) throw new Error(`Gagal memuat data (status ${res.status})`);
        return res.json();
      })
      .then((json: OpdRow[]) => { if (!cancelled) setData(json); })
      .catch(err => { if (!cancelled) setError(err.message || "Gagal memuat data"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

const LoadingState = () => (
  <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
    <Loader2 size={18} className="animate-spin" />
    <span className="text-sm">Memuat data OPD...</span>
  </div>
);

const ErrorState = ({ message }: { message: string }) => (
  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
    <AlertTriangle size={16} className="flex-shrink-0" />
    <span>Gagal memuat data: {message}. Pastikan backend berjalan dan endpoint /api/perbandingan-opd bisa diakses.</span>
  </div>
);

// Legend threshold — biar user gak nebak-nebak batasan Kritis/Waspada/Aman
const ThresholdLegend = () => (
  <div className="flex items-center gap-4 flex-wrap px-1 py-2 text-[11px] text-gray-500">
    <span className="font-semibold text-gray-600">Ambang batas skor:</span>
    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C.coral }} />Kritis: &lt; 60</span>
    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C.amber }} />Waspada: 60–74</span>
    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C.teal }} />Aman: ≥ 75</span>
  </div>
);

// ── Level 2 detail panel (dipakai di kedua tab) ───────────────────────────────

const Level2Panel = ({ opd }: { opd: OpdRow }) => {
  const kriteriaEntries = Object.entries(opd.kontribusi_skor) as [keyof OpdRow["kontribusi_skor"], number][];

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-5 pb-5 pt-3">

      {/* KPI mini-cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Pegawai", val: fmt(opd.total_asn), sub: "aktif saat ini", color: C.blue },
          { label: "Pensiun 0–6 Bulan", val: String(opd.pensiun_0_6), sub: "segera — perlu tindakan kini", color: C.coral },
          { label: "Pensiun 6–12 Bulan", val: String(opd.pensiun_6_12), sub: "perlu disiapkan pengganti", color: C.amber },
          { label: "Jabatan Struktural ⚠", val: String(opd.jumlah_struktural_kosong_12bln), sub: "posisi kritis — hanya bisa PNS", color: C.red },
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
              { label: "0–6 Bulan — Tindakan Segera", entries: opd.jabatan_berisiko["0-6"], pillCls: "text-red-700 bg-red-50" },
              { label: "6–12 Bulan — Perlu Disiapkan", entries: opd.jabatan_berisiko["6-12"], pillCls: "text-amber-700 bg-amber-50" },
            ] as const).map(({ label, entries, pillCls }) => (
              <div key={label}>
                <p className={`text-[11px] font-bold px-2 py-0.5 rounded-full w-fit mb-2 ${pillCls}`}>{label}</p>
                {entries.length === 0 && <p className="text-[11px] text-gray-400 italic">Tidak ada jabatan berisiko di rentang ini.</p>}
                <div className="space-y-2">
                  {entries.map(e => (
                    <div key={e.nama} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${JENIS_STYLE[e.badge]}`}>
                          {e.badge}
                        </span>
                        <span className="text-xs text-gray-700 truncate">{e.nama}</span>
                      </div>
                      <span className="text-sm font-black flex-shrink-0"
                        style={{ fontFamily: "var(--font-mono)", color: e.badge === "Str" ? C.coral : "#374151" }}>
                        {e.jumlah} orang
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {opd.jumlah_struktural_kosong_12bln > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-red-600 flex-shrink-0" />
              <p className="text-[11px] text-red-700 font-semibold leading-snug">
                {opd.jumlah_struktural_kosong_12bln} jabatan struktural berisiko kosong — hanya bisa diisi PNS, tidak bisa PPPK.
              </p>
            </div>
          )}
        </div>

        {/* Kontribusi per kriteria */}
        <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-700 mb-1">Kontribusi Skor per Kriteria</p>
          <p className="text-[10px] text-gray-400 mb-3">Setiap kriteria dinormalisasi 0–100, makin tinggi makin aman.</p>
          <div className="space-y-3.5">
            {kriteriaEntries.map(([key, val], i) => {
              const color = KRITERIA_COLORS[i];
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-gray-600 leading-tight">{KRITERIA_LABELS[key]}</span>
                    <span className="text-xs font-black" style={{ fontFamily: "var(--font-mono)", color }}>
                      {val}/100
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: color }} />
                  </div>
                  {key === "generasi" && (
                    <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                      Riil: Boomers {opd.komposisi_generasi.baby_boom}% · GenX {opd.komposisi_generasi.gen_x}% ·
                      Milenial {opd.komposisi_generasi.milenial}% · GenZ {opd.komposisi_generasi.gen_z}%
                      &nbsp;(ideal: 5/10/50/35%)
                    </p>
                  )}
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-700">Skor Ketahanan Regenerasi</span>
                <span className="text-lg font-black" style={{ fontFamily: "var(--font-display)", color: kategoriColor(opd.kategori) }}>
                  {opd.skor_komposit}/100
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${opd.skor_komposit}%`, backgroundColor: kategoriColor(opd.kategori) }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insight AI per OPD (cache di backend, fallback ke ringkasan standar) */}
      <AiInsightCard opd={opd} />
    </div>
  );
};

// ── Tab "Prioritas Tindakan" (dulu "Operasional") ─────────────────────────────

const PrioritasTab = ({ data }: { data: OpdRow[] }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const kritisItems = data.filter(o => o.perlu_perhatian);

  return (
    <div>
      <div className="mb-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
        <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-snug">
          Menampilkan <strong>{kritisItems.length} OPD yang perlu perhatian</strong>: OPD dengan skor ketahanan keseluruhan
          rendah, <strong>atau</strong> yang jabatan pimpinannya (struktural) berisiko kosong meski skor keseluruhannya
          masih aman — karena posisi ini cuma bisa diisi PNS, jadi tetap perlu ditindaklanjuti. Klik baris untuk lihat detail.
          Untuk daftar lengkap 56 OPD, buka tab <strong>Semua OPD</strong>.
        </p>
      </div>

      {kritisItems.length === 0 ? (
        <Card className="p-6 text-center text-sm text-gray-500">Tidak ada OPD berstatus Kritis saat ini.</Card>
      ) : (
        <Card className="p-0 overflow-hidden mb-3">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-48">Nama OPD</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-36">Pensiun ≤12 Bulan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 w-32">Skor Ketahanan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Ringkasan</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {kritisItems.map(opd => {
                const isOpen = expanded === opd.id;
                const color = kategoriColor(opd.kategori);
                return (
                  <React.Fragment key={opd.id}>
                    <tr className={`border-b transition-colors cursor-pointer group ${isOpen ? "bg-slate-50 border-slate-200" : "border-gray-100 hover:bg-gray-50"}`}
                      onClick={() => setExpanded(isOpen ? null : opd.id)}>
                      <td className="px-4 py-3.5">
                        <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={opd.kategori} />
                          {opd.kategori !== "Kritis" && opd.kategori_struktural === "Kritis" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                              Struktural Kritis
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900">{opd.nama}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmt(opd.total_asn)} ASN</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-lg font-black leading-none" style={{ color: opd.pensiun_12_bulan_pct > 5 ? C.coral : C.amber, fontFamily: "var(--font-display)" }}>
                          {opd.pensiun_12_bulan}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">pegawai ({opd.pensiun_12_bulan_pct}%)</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xl font-black" style={{ color, fontFamily: "var(--font-display)" }}>{opd.skor_komposit}</span>
                          <span className="text-xs text-gray-400">/100</span>
                        </div>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${opd.skor_komposit}%`, backgroundColor: color }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-gray-700 leading-snug line-clamp-2">{buildAlasan(opd)}</p>
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 group-hover:text-gray-600">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={5} className="p-0"><Level2Panel opd={opd} /></td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ThresholdLegend />

      <div className="flex items-center gap-6 flex-wrap px-1 mt-2">
        {(["Str", "Fun", "Pel"] as JabatanBadge[]).map(badge => (
          <div key={badge} className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${JENIS_STYLE[badge]}`}>{badge}</span>
            <span className="text-[11px] text-gray-500">
              {badge === "Str" ? "Struktural — hanya bisa diisi PNS" : `${JENIS_LABEL[badge]} — bisa diisi PPPK`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Tab "Semua OPD" (dulu "Analitik Lanjutan") ────────────────────────────────

const SemuaOpdTab = ({ data }: { data: OpdRow[] }) => {
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [riskView, setRiskView] = useState<"komposit" | "struktural" | "fungsional">("komposit");
  const [riskFilter, setRiskFilter] = useState("Semua");
  const [page, setPage] = useState(1);

  const getSkor = (o: OpdRow) =>
    riskView === "struktural" ? o.skor_struktural : riskView === "fungsional" ? o.skor_fungsional : o.skor_komposit;
  const getKategori = (o: OpdRow) =>
    riskView === "struktural" ? o.kategori_struktural : riskView === "fungsional" ? o.kategori_fungsional : o.kategori;

  const filteredRows = data
    .filter(o => o.nama.toLowerCase().includes(search.toLowerCase()))
    .filter(o => riskFilter === "Semua" || getKategori(o) === riskFilter)
    .sort((a, b) => {
      const cmp = getSkor(a) - getSkor(b);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const rows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const headerLabel = riskView === "struktural" ? "Risiko Struktural" : riskView === "fungsional" ? "Risiko Fungsional" : "Skor Ketahanan (Komposit)";

  return (
    <>
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
            <p className="text-xs font-bold text-teal-700 mb-1">Risiko Fungsional/Teknis (JF · Pelaksana)</p>
            <p className="text-xs text-teal-600 leading-snug">Jabatan fungsional dan pelaksana <strong>dapat diisi PPPK</strong> sesuai klaster. Kekosongan massal tetap berisiko jika rekrutmen tidak diantisipasi.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["komposit", "struktural", "fungsional"] as const).map(v => (
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

      <ThresholdLegend />

      <Card className="p-0 overflow-hidden mb-3 mt-2">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Nama OPD</th>
              <th onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                className="px-4 py-3 text-left text-xs font-bold text-gray-500 select-none cursor-pointer hover:text-gray-700">
                <div className="flex items-center gap-1">{headerLabel}
                  {sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </div>
              </th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map(opd => {
              const sk = getSkor(opd);
              const kat = getKategori(opd);
              const color = kategoriColor(kat);
              const isOpen = expanded === opd.id;
              return (
                <React.Fragment key={opd.id}>
                  <tr className={`border-b border-gray-100 cursor-pointer transition-colors group ${isOpen ? "bg-blue-50 border-blue-100" : "hover:bg-gray-50"}`}
                    onClick={() => setExpanded(isOpen ? null : opd.id)}>
                    <td className="px-4 py-3"><p className="text-sm font-bold text-gray-900">{opd.nama}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full" style={{ width: `${sk}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <span className="text-base font-black w-8 text-right flex-shrink-0" style={{ color, fontFamily: "var(--font-mono)" }}>{sk}</span>
                        <StatusBadge status={kat} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 group-hover:text-gray-600">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-blue-100 bg-blue-50">
                      <td colSpan={3} className="px-5 py-4">
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          {[
                            { label: "Total ASN", val: fmt(opd.total_asn), mono: true },
                            { label: "Rata-rata Usia", val: `${opd.rata_usia} tahun`, mono: false },
                            { label: "Pensiun ≤12 Bulan", val: `${opd.pensiun_12_bulan_pct}%`, mono: false },
                          ].map(({ label, val, mono }) => (
                            <div key={label} className="bg-white rounded-xl p-3 border border-blue-200">
                              <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
                              <p className="text-lg font-black text-gray-900" style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)" }}>{val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Skor Ketahanan (Komposit)", val: opd.skor_komposit, kat: opd.kategori },
                            { label: "Risiko Struktural (JPT/Administrator/Pengawas)", val: opd.skor_struktural, kat: opd.kategori_struktural },
                            { label: "Risiko Fungsional (JF/Pelaksana)", val: opd.skor_fungsional, kat: opd.kategori_fungsional },
                          ].map(({ label, val, kat }) => (
                            <div key={label} className="bg-white rounded-xl p-3 border border-blue-200">
                              <p className="text-[10px] text-gray-500 mb-1 leading-snug">{label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-black" style={{ color: kategoriColor(kat), fontFamily: "var(--font-display)" }}>{val}</span>
                                <StatusBadge status={kat} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 leading-snug">
                          Catatan: Skor Komposit, Struktural, dan Fungsional dihitung dari data yang sama (kriteria berbeda),
                          jadi wajar kalau angkanya tidak sama persis — masing-masing menyorot sudut pandang berbeda.
                        </p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between px-1 mb-6">
        <p className="text-xs text-gray-500">
          Menampilkan {rows.length} dari {filteredRows.length} OPD (halaman {page} dari {totalPages})
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
              Ranking berbasis skor komposit sengaja tidak dibobotkan oleh jumlah pegawai — OPD kecil dengan proporsi pensiun tinggi
              bisa jadi lebih rentan dibanding OPD besar dengan proporsi kecil. Gunakan Skor Komposit untuk perbandingan yang adil antar OPD.
            </p>
            <div className="border-t border-slate-700 pt-3">
              <ul className="space-y-2">
                <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                  <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">⚠</span>
                  <span><span className="text-white font-semibold">PPPK tidak bisa mengisi Eselon I–IV.</span> OPD dengan komposisi PPPK tinggi akan kesulitan mengisi posisi struktural saat pejabat PNS-nya pensiun.</span>
                </li>
                <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                  <span className="text-blue-400 font-bold flex-shrink-0 mt-0.5">→</span>
                  <span>Gunakan filter <span className="text-white font-semibold">"Risiko Struktural"</span> untuk mengidentifikasi OPD paling rentan kehilangan jabatan struktural.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

// ── Main OPD Page ─────────────────────────────────────────────────────────────

const OPDPage = () => {
  const [mainTab, setMainTab] = useState<"prioritas" | "semua">("prioritas");
  const { data, loading, error } = usePerbandinganOpd();

  return (
    <div className="p-6">
      <PageHeader
        title="Perbandingan Antar OPD"
        subtitle={`Ranking skor ketahanan regenerasi — ${data.length || "..."} OPD Provinsi Jawa Timur`}
        crumbs={["Perbandingan Antar OPD"]}
      />

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5 w-fit mb-5">
        {([
          { key: "prioritas", label: "Prioritas Tindakan", desc: "OPD Kritis, ringkasan, tindak lanjut" },
          { key: "semua", label: "Semua OPD", desc: "Skor komposit & detail 56 OPD" },
        ] as const).map(({ key, label, desc }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`px-4 py-2 rounded-xl transition-all text-left ${mainTab === key ? "bg-white shadow-sm" : "hover:bg-gray-50"}`}>
            <p className={`text-sm font-bold leading-none ${mainTab === key ? "text-blue-700" : "text-gray-600"}`}>{label}</p>
            <p className={`text-[11px] mt-0.5 ${mainTab === key ? "text-blue-500" : "text-gray-400"}`}>{desc}</p>
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        mainTab === "prioritas" ? <PrioritasTab data={data} /> : <SemuaOpdTab data={data} />
      )}
    </div>
  );
};

export default OPDPage;