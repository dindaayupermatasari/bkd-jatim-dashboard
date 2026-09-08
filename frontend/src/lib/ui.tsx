import React, { useState, useEffect } from "react";
import { Home, ChevronRight } from "lucide-react";
import { fmt } from "./constants";

// ── Hooks ──────────────────────────────────────────────────────────────────────

export const useCountUp = (end: number, duration = 2000) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * end));
      if (p < 1) requestAnimationFrame(step);
    };
    const t = setTimeout(() => requestAnimationFrame(step), 300);
    return () => clearTimeout(t);
  }, [end, duration]);
  return val;
};

// ── Shared Components ─────────────────────────────────────────────────────────

export const Breadcrumb = ({ items }: { items: string[] }) => (
  <nav className="flex items-center gap-1 text-xs text-gray-500 mb-1">
    <Home size={11} className="text-gray-400" />
    {items.map((item, i) => (
      <React.Fragment key={i}>
        <ChevronRight size={11} className="text-gray-400" />
        <span className={i === items.length - 1 ? "text-gray-800 font-semibold" : ""}>{item}</span>
      </React.Fragment>
    ))}
  </nav>
);

export const PageHeader = ({ title, subtitle, crumbs }: { title: string; subtitle?: string; crumbs: string[] }) => (
  <div className="mb-6">
    <Breadcrumb items={crumbs} />
    <h1 className="text-xl font-bold text-gray-900 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

export const Card = ({ children, className = "", hover = false, style }: { children: React.ReactNode; className?: string; hover?: boolean; style?: React.CSSProperties }) => (
  <div
    className={`bg-white border border-gray-200 rounded-2xl p-5 ${hover ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300" : ""} ${className}`}
    style={style}>
    {children}
  </div>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">{children}</h3>
);

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; text: string }> = {
    Aman:    { bg: "bg-teal-100",   text: "text-teal-700"   },
    Waspada: { bg: "bg-amber-100",  text: "text-amber-700"  },
    Kritis:  { bg: "bg-orange-100", text: "text-orange-700" },
  };
  const { bg, text } = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>{status}</span>;
};

export const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      {label && <p className="font-bold text-gray-700 mb-1.5 border-b border-gray-100 pb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4 mt-1">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-bold text-gray-800">{typeof p.value === "number" ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const InsightBox = ({ children, variant = "blue" }: { children: React.ReactNode; variant?: "blue" | "orange" | "teal" | "gray" }) => {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-200 text-blue-800 border-l-blue-500",
    orange: "bg-orange-50 border-orange-200 text-orange-800 border-l-orange-500",
    teal:   "bg-teal-50 border-teal-200 text-teal-800 border-l-teal-500",
    gray:   "bg-gray-50 border-gray-200 text-gray-800 border-l-gray-400",
  };
  return (
    <div className={`border border-l-4 rounded-r-2xl p-4 text-sm leading-relaxed ${colors[variant]}`}>
      {children}
    </div>
  );
};

export const GRAD = {
  blue:  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
  coral: "linear-gradient(135deg, #EA6F02 0%, #FB923C 100%)",
  teal:  "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
  hero:  "linear-gradient(to bottom right, #0F172A 0%, #1E3A8A 60%, #1D4ED8 100%)",
};

export const PrimaryBtn = ({ children, onClick, icon: Icon, size = "default" }: { children: React.ReactNode; onClick?: () => void; icon?: React.ElementType; size?: "sm" | "default" | "lg" }) => {
  const sz = { sm: "px-4 py-2 text-sm min-h-[36px]", default: "px-5 py-2.5 text-sm min-h-[44px]", lg: "px-6 py-3 text-base min-h-[52px]" };
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl font-bold text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg ${sz[size]}`}
      style={{ background: GRAD.blue }}>
      {Icon && <Icon size={size === "lg" ? 18 : 16} />}
      {children}
    </button>
  );
};

export const GhostBtn = ({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick?: () => void; icon?: React.ElementType }) => (
  <button onClick={onClick}
    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm min-h-[44px] transition-all duration-200 hover:border-blue-300 hover:text-blue-600 hover:-translate-y-0.5">
    {Icon && <Icon size={16} />}
    {children}
  </button>
);
