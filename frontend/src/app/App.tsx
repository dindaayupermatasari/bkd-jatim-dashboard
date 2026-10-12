import React, { useState, useEffect } from "react";
import {
  Home, BarChart2, Calendar, Sliders, MessageSquare, Database,
  ChevronRight, ArrowRight, Shield, BarChart, Bot,
  FileText, ExternalLink, User, Menu, X, ChevronLeft,
  Users, Building2, Target, CalendarDays, Sparkles,
  Clock, Phone, MapPin, ClipboardList,
} from "lucide-react";
import { SLIDES, C } from "../lib/constants";
import { GRAD, useCountUp } from "../lib/ui";
import BerandaPage   from "../pages/Beranda";
import OPDPage       from "../pages/PerbandinganAntarOPD";
import ABKPage       from "../pages/ABKPage";
import PensiunPage   from "../pages/ProyeksiPensiunBUP";
import SPKPage       from "../pages/SimulatorOptimasiBobot";
import ChatbotPage   from "../pages/AsistenAI";
import KualitasPage  from "../pages/KualitasData";

// ── Nav registry ──────────────────────────────────────────────────────────────

const NAV = [
  { id: "beranda",  label: "Beranda",                          icon: Home          },
  { id: "opd",      label: "Perbandingan Antar OPD",            icon: BarChart2     },
  { id: "abk",      label: "Analisis Beban Kerja (ABK)",        icon: ClipboardList },
  { id: "pensiun",  label: "Proyeksi Pensiun (BUP)",            icon: Calendar      },
  { id: "spk",      label: "Simulator Optimasi Bobot Kriteria", icon: Sliders       },
  { id: "chatbot",  label: "Asisten AI",                        icon: MessageSquare },
  { id: "kualitas", label: "Kualitas Data",                     icon: Database      },
];

const PAGES: Record<string, React.FC<any>> = {
  beranda:  BerandaPage,
  opd:      OPDPage,
  abk:      ABKPage,
  pensiun:  PensiunPage,
  spk:      SPKPage,
  chatbot:  ChatbotPage,
  kualitas: KualitasPage,
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
// FIX: collapsed state (56px) shows ONLY the BKD logo — no hamburger.
// The topbar hamburger is the single toggle source of truth, eliminating
// the double-☰ bug that appeared when sidebar was collapsed.

const Sidebar = ({ active, onNav, onLanding, open, onToggle }: {
  active: string; onNav: (id: string) => void; onLanding: () => void;
  open: boolean; onToggle: () => void;
}) => (
  <aside
    className="flex-shrink-0 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300"
    style={{ width: open ? 240 : 56 }}>

    {/* Header — toggle button at fixed left-edge position in both open and collapsed states */}
    <div className="border-b border-gray-100 flex-shrink-0 flex items-center" style={{ minHeight: 56 }}>
      <button onClick={onToggle} title={open ? "Tutup sidebar" : "Buka sidebar"}
        className="w-14 h-14 flex-shrink-0 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
        {open ? <X size={16} /> : <Menu size={16} />}
      </button>
      {open && (
        <div className="flex items-center gap-2 pr-3 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: GRAD.blue }}>
            <span className="text-white text-[9px] font-black tracking-wide">BKD</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-800 leading-none truncate" style={{ fontFamily: "var(--font-display)" }}>SIAP-ASN</p>
            <p className="text-[10px] font-semibold text-blue-600 leading-tight mt-0.5">BKD Jawa Timur</p>
          </div>
        </div>
      )}
    </div>

    {/* Nav items */}
    <nav className="flex-1 overflow-y-auto py-3 px-1.5 space-y-0.5">
      {open && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Menu Utama</p>}
      {NAV.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={() => onNav(id)} title={!open ? label : undefined}
            className={`w-full flex items-center py-2 rounded-xl transition-all duration-150 text-[13px] font-semibold
              ${open ? "gap-2.5 px-2.5" : "justify-center px-2"}
              ${isActive
                ? open
                  ? "bg-blue-50 text-blue-700 border-l-[3px] border-blue-600 pl-[7px]"
                  : "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900" + (open ? " border-l-[3px] border-transparent" : "")}`}>
            <Icon size={15} className={isActive ? "text-blue-600 flex-shrink-0" : "text-gray-400 flex-shrink-0"} />
            {open && <span className="leading-tight truncate">{label}</span>}
          </button>
        );
      })}
    </nav>

    {/* Footer */}
    <div className={`border-t border-gray-100 flex-shrink-0 ${open ? "px-3 py-3 space-y-1" : "px-1.5 py-2 flex flex-col items-center gap-2"}`}>
      {open ? (
        <>
          <button onClick={onLanding}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-gray-500 hover:bg-gray-50 text-xs font-semibold transition-colors">
            <ExternalLink size={12} /> Kembali ke Beranda Publik
          </button>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User size={13} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-700 truncate">Analis Kepegawaian</p>
              <p className="text-[10px] text-gray-400">Tim SPK · BKD Jatim</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <button onClick={onLanding} title="Beranda Publik"
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <ExternalLink size={14} />
          </button>
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <User size={13} className="text-blue-600" />
          </div>
        </>
      )}
    </div>
  </aside>
);

// ── Topbar ────────────────────────────────────────────────────────────────────
// Single toggle control — icon changes between ☰ and ✕ based on sidebar state.

const Topbar = ({ activePage }: { activePage: string }) => {
  const pageLabel = NAV.find(n => n.id === activePage)?.label ?? "Dashboard";
  return (
    <header className="bg-white border-b border-gray-200 flex items-center gap-3 px-4 flex-shrink-0"
      style={{ height: 56 }}>
      <span className="text-sm font-bold text-gray-700 truncate">{pageLabel}</span>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-bold text-blue-600">Data Agustus 2026</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-blue-600" />
        </div>
      </div>
    </header>
  );
};

// ── Landing Page ──────────────────────────────────────────────────────────────

const LandingPage = ({ onEnter }: { onEnter: (page?: string) => void }) => {
  const [slide, setSlide]   = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, [paused]);

  // Smooth scroll to section by id
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const asnCount   = useCountUp(80277);
  const opdCount   = useCountUp(56);
  const akurasiNum = useCountUp(978);
  const tahunNum   = useCountUp(10);

  const STAT_ITEMS = [
    { label: "ASN Terdaftar",      value: asnCount.toLocaleString("id-ID"),   unit: "",      icon: Users        },
    { label: "OPD Terdampak",      value: opdCount.toLocaleString("id-ID"),   unit: "OPD",   icon: Building2    },
    { label: "Akurasi Prediksi",   value: (akurasiNum / 10).toFixed(1),       unit: "%",     icon: Target       },
    { label: "Jangkauan Proyeksi", value: tahunNum.toLocaleString("id-ID"),   unit: "Tahun", icon: CalendarDays },
  ];

  const FEATURES = [
    { icon: Bot,      title: "Asisten AI",          featured: true,  desc: "Tanya jawab analitik real-time berbasis 80.277 data agregat ASN. Jawaban kontekstual untuk mendukung pengambilan keputusan cepat dan tepat." },
    { icon: BarChart, title: "Analitik Prediktif",  featured: false, desc: "Proyeksi pensiun, distribusi usia, dan tren kepegawaian hingga 10 tahun ke depan berbasis data SIMPEG Agustus 2026." },
    { icon: Sliders,  title: "Simulator Formasi",   featured: false, desc: "Optimasi bobot kriteria ranking OPD menggunakan Genetic Algorithm, PSO, dan Simulated Annealing secara komparatif." },
  ];

  return (
    <div className="min-h-screen" style={{ fontFamily: "var(--font-sans)" }}>

      {/* ── Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-10 py-4"
        style={{ background: "rgba(15,23,42,0.88)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: GRAD.blue }}>
            <span className="text-white text-[11px] font-black">BKD</span>
          </div>
          <span className="text-white font-bold text-sm">SIAP-ASN</span>
          <span className="text-slate-400 text-xs ml-1">Jawa Timur</span>
        </div>
        {/* Nav anchors — ordered top-to-bottom matching page section order */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Statistik", anchor: "statistik" },
            { label: "Fitur",     anchor: "fitur"     },
          ].map(({ label, anchor }) => (
            <button key={label} onClick={() => scrollTo(anchor)}
              className="text-slate-300 hover:text-white text-sm font-semibold transition-colors cursor-pointer hover:underline underline-offset-4">
              {label}
            </button>
          ))}
        </nav>
        {/* Nav CTA — secondary style, smaller than hero primary button */}
        <button onClick={onEnter}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all cursor-pointer">
          Masuk <ArrowRight size={13} />
        </button>
      </header>

      {/* ── Hero — full-bleed image carousel ── */}
      <div className="relative h-screen overflow-hidden"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

        {/* Slide images */}
        {SLIDES.map((s, i) => (
          <div key={i} className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === slide ? 1 : 0 }}>
            <img src={s.img} alt="" className="w-full h-full object-cover"
              style={{ backgroundColor: "#0F172A" }} />
          </div>
        ))}

        {/* Dual gradient overlay — left dark for text + bottom dark for legibility */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.15) 100%)" }} />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }} />

        {/* Slide text — centered-left, above the fold */}
        <div className="absolute inset-0 flex items-center px-10 md:px-20 pt-20">
          <div className="max-w-2xl w-full">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 mb-6">
              <Shield size={12} className="text-blue-300" />
              <span className="text-blue-100 text-xs font-semibold">BKD Provinsi Jawa Timur</span>
            </div>

            {/* Text slides — active is static, others are absolute */}
            <div className="relative">
              {SLIDES.map((s, i) => (
                <div key={i} className="transition-opacity duration-500"
                  style={{
                    opacity: i === slide ? 1 : 0,
                    position: i === slide ? "static" : "absolute",
                    top: 0, left: 0, width: "100%",
                    pointerEvents: i === slide ? "auto" : "none",
                  }}>
                  <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4"
                    style={{ fontFamily: "var(--font-display)", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
                    {s.headline}
                  </h1>
                  <p className="text-slate-200 text-xl mb-8 leading-relaxed">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Single CTA — same for all slides */}
            <button onClick={onEnter}
              className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl font-bold text-white text-base transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-2xl shadow-lg"
              style={{ background: GRAD.blue, minHeight: 52 }}>
              Masuk ke Dashboard <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Bottom row: dots + arrows — keeps arrows away from headline text */}
        <div className="absolute bottom-10 left-10 md:left-20 flex items-center gap-3">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { setSlide(i); setPaused(true); }}
              className={`rounded-full transition-all duration-300 ${i === slide ? "w-8 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`} />
          ))}
          <div className="w-px h-4 bg-white/30 mx-1" />
          <button onClick={() => { setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length); setPaused(true); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/25 hover:border-white/50 hover:scale-105"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button onClick={() => { setSlide(s => (s + 1) % SLIDES.length); setPaused(true); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all backdrop-blur-sm border border-white/25 hover:border-white/50 hover:scale-105"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <section id="statistik" className="py-20 px-10 md:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Data Real-time · Agustus 2026</p>
          <h2 className="text-3xl font-black text-gray-900 mb-12" style={{ fontFamily: "var(--font-display)" }}>Mengelola SDM Terbesar di Jawa</h2>
          <div className="grid grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden">
            {STAT_ITEMS.map(({ label, value, unit, icon: Icon }) => (
              <div key={label} className="bg-white p-8 text-center hover:bg-blue-50/30 transition-colors">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Icon size={22} className="text-blue-600" />
                  </div>
                </div>
                <p className="text-5xl font-black text-gray-900 leading-none mb-1"
                  style={{ fontFamily: "var(--font-display)" }}>
                  {value}<span className="text-2xl text-blue-600 ml-1">{unit}</span>
                </p>
                <p className="text-sm text-gray-500 mt-2 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard Preview ── */}
      <section id="fitur" className="py-20 px-10 md:px-20" style={{ background: "#F0F4FF" }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Lihat dalam Aksi</p>
          <h2 className="text-3xl font-black text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)" }}>Data Nyata, Visualisasi Nyata</h2>
          <p className="text-gray-500 mb-12 max-w-xl text-base">Cuplikan tampilan aktual dashboard — bukan mockup desain, melainkan UI langsung dari data kepegawaian 80.277 ASN Jawa Timur.</p>
          <div className="grid grid-cols-3 gap-5">

            {/* Card 1: Proyeksi Pensiun */}
            <div className="bg-white rounded-2xl overflow-hidden border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-700">Proyeksi Pensiun BUP</p>
                <p className="text-[10px] text-gray-400 mt-0.5">ASN per tahun 2026–2030</p>
              </div>
              <div className="p-4">
                {[
                  { yr: "2026", val: 423,  pct: 15            },
                  { yr: "2027", val: 1332, pct: 48, hot: true },
                  { yr: "2028", val: 2100, pct: 75            },
                  { yr: "2029", val: 2750, pct: 98            },
                  { yr: "2030", val: 2800, pct: 100           },
                ].map(({ yr, val, pct, hot }) => (
                  <div key={yr} className="flex items-center gap-2 mb-2 last:mb-0">
                    <span className="text-[10px] text-gray-500 w-8 text-right">{yr}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded transition-all"
                        style={{ width: `${pct}%`, background: hot ? C.coral : C.blue, opacity: hot ? 1 : 0.65 }} />
                    </div>
                    <span className="text-[10px] font-bold w-12 text-right"
                      style={{ color: hot ? C.coral : "#374151", fontFamily: "var(--font-mono)" }}>
                      {val.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-orange-500 font-bold mt-3">&#9888; Lonjakan +215% pada 2027</p>
              </div>
            </div>

            {/* Card 2: OPD Risk Ranking */}
            <div className="bg-white rounded-2xl overflow-hidden border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-700">Ranking Risiko OPD</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Skor komposit regenerasi ASN</p>
              </div>
              <div className="p-3 space-y-2">
                {[
                  { nama: "Dinas Pendidikan",    skor: 42, risk: "Kritis"  },
                  { nama: "Dinas Kelautan",       skor: 51, risk: "Kritis"  },
                  { nama: "Dinas PU Bina Marga",  skor: 54, risk: "Kritis"  },
                  { nama: "Dinas Kesehatan",      skor: 61, risk: "Waspada" },
                  { nama: "Dinas Perhubungan",    skor: 62, risk: "Waspada" },
                ].map(({ nama, skor, risk }) => (
                  <div key={nama} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                    <span className="text-[10px] text-gray-600 flex-1 truncate">{nama}</span>
                    <span className="text-[10px] font-black flex-shrink-0"
                      style={{ fontFamily: "var(--font-mono)", color: risk === "Kritis" ? C.coral : C.amber }}>{skor}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${risk === "Kritis" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                      {risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Asisten AI preview */}
            <div className="bg-white rounded-2xl overflow-hidden border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: GRAD.blue }}>
                  <Bot size={11} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700 leading-none">Asisten AI SIAP-ASN</p>
                  <p className="text-[10px] text-emerald-500 mt-0.5">Aktif</p>
                </div>
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex justify-end">
                  <div className="max-w-[82%] px-3 py-2 rounded-xl rounded-br-sm text-[10px] text-white leading-snug"
                    style={{ background: GRAD.blue }}>
                    Berapa proyeksi pensiun 2027?
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                    style={{ background: GRAD.blue }}>
                    <Bot size={9} className="text-white" />
                  </div>
                  <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-gray-100 text-[10px] text-gray-700 leading-snug">
                    Diperkirakan 1.332 ASN pensiun pada 2027 — mayoritas Dinas Pendidikan (758).
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                  <div className="flex-1 h-7 rounded-xl bg-gray-100 px-3 flex items-center">
                    <span className="text-[9px] text-gray-400">Tanyakan sesuatu...</span>
                  </div>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: GRAD.blue }}>
                    <ArrowRight size={11} className="text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features — AI card is visually featured ── */}
      <section className="py-20 px-10 md:px-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Kapabilitas Platform</p>
          <h2 className="text-3xl font-black text-gray-900 mb-12" style={{ fontFamily: "var(--font-display)" }}>Tiga Pilar Analitik SIAP-ASN</h2>
          <div className="grid grid-cols-3 gap-6 items-stretch">
            {FEATURES.map(({ icon: Icon, title, desc, featured }) => (
              <div key={title}
                className={`rounded-2xl p-7 border flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${featured ? "border-blue-700/20" : "border-blue-100 bg-white hover:border-blue-200"}`}
                style={featured ? { background: GRAD.blue } : {}}>
                {featured && (
                  <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1 mb-4 w-fit">
                    <Sparkles size={9} className="text-blue-200" />
                    <span className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">Fitur Unggulan</span>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 flex-shrink-0 ${featured ? "bg-white/20" : ""}`}
                  style={!featured ? { background: GRAD.blue } : {}}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className={`font-bold text-lg mb-2 ${featured ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
                <p className={`text-sm leading-relaxed flex-grow ${featured ? "text-blue-100" : "text-gray-600"}`}>{desc}</p>
                {featured && (
                  <button onClick={() => onEnter("chatbot")}
                    className="mt-6 flex items-center gap-2 text-sm font-bold text-white hover:text-blue-100 group transition-colors w-fit cursor-pointer">
                    Coba Sekarang <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer — 3-col, no Navigasi column ── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="py-12 px-10 md:px-20 border-b border-slate-800">
          <div className="max-w-5xl mx-auto grid grid-cols-3 gap-10">

            {/* Brand + description */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                  style={{ background: GRAD.blue }}>BKD</div>
                <span className="text-white font-bold">SIAP-ASN</span>
              </div>
              <p className="text-xs leading-relaxed">
                Sistem Informasi Analitik dan Prediksi ASN untuk perencanaan SDM berbasis data kepegawaian Provinsi Jawa Timur.
              </p>
            </div>

            {/* Contact */}
            <div>
              <p className="text-slate-300 text-xs font-bold mb-4 uppercase tracking-wider">Kontak</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={11} className="flex-shrink-0 text-slate-500" />
                  <span>031-8491008 (Helpdesk BKD Jatim)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock size={11} className="flex-shrink-0 text-slate-500" />
                  <span>Senin–Jumat, 07.30–16.00 WIB</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <MapPin size={11} className="flex-shrink-0 text-slate-500 mt-0.5" />
                  <span>Jl. Pahlawan No.110, Surabaya 60174</span>
                </div>
              </div>
            </div>

            {/* Bantuan links */}
            <div>
              <p className="text-slate-300 text-xs font-bold mb-4 uppercase tracking-wider">Bantuan</p>
              <div className="space-y-2.5">
                {["Panduan Penggunaan", "FAQ / Pertanyaan Umum", "Kebijakan Privasi", "Syarat & Ketentuan", "Kontak Helpdesk", "Portal BKD Jatim"].map(l => (
                  <p key={l} className="text-xs hover:text-slate-200 cursor-pointer transition-colors">{l}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="py-5 px-10 md:px-20">
          <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs">© 2026 Badan Kepegawaian Daerah Provinsi Jawa Timur. Hak cipta dilindungi.</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-slate-500">Sistem aktif · Data Agustus 2026</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ── App Shell ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]               = useState<"landing" | "dashboard">("landing");
  const [activePage, setActivePage]   = useState("beranda");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const Page      = PAGES[activePage] ?? BerandaPage;
  const isChatbot = activePage === "chatbot";

  if (view === "landing") return <LandingPage onEnter={(page = "beranda") => { setActivePage(page); setView("dashboard"); }} />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FAFAF8", fontFamily: "var(--font-sans)" }}>
      <Sidebar
        active={activePage}
        onNav={setActivePage}
        onLanding={() => setView("landing")}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar activePage={activePage} />
        <main className={`flex-1 ${isChatbot ? "overflow-hidden" : "overflow-y-auto"} min-w-0`}>
          {isChatbot
            ? <div className="h-full flex flex-col"><Page onNav={setActivePage} /></div>
            : <Page onNav={setActivePage} />}
        </main>
      </div>
    </div>
  );
}
