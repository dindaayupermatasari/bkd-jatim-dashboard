import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { GRAD, QUICK_TOPICS, getBotResponse } from "../lib/constants";

interface ChatMsg { role: "user" | "bot"; text: string; time: string }

const RIWAYAT_SESSIONS = [
  { group: "Hari Ini", items: [
    { label: "Proyeksi pensiun 2027", time: "14:23" },
    { label: "OPD risiko tertinggi",  time: "10:05" },
  ]},
  { group: "Kemarin", items: [
    { label: "Total ASN Jawa Timur",   time: "16:41" },
    { label: "Algoritma terbaik SPK",  time: "09:12" },
  ]},
  { group: "Minggu Lalu", items: [
    { label: "Rekrutmen Dinas Kesehatan", time: "Sel" },
    { label: "Distribusi generasi PPPK",  time: "Sen" },
  ]},
];

const ChatbotPage = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([{
    role: "bot",
    text: "Halo! Saya Asisten AI SIAP-ASN. Saya dapat membantu menganalisis data kepegawaian, proyeksi pensiun, dan rekomendasi formasi ASN Jawa Timur. Silakan ajukan pertanyaan.",
    time: "08.00",
  }]);
  const [input, setInput]               = useState("");
  const [activeSession, setActiveSession] = useState(0);
  const [riwayatOpen, setRiwayatOpen]   = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const now = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const sendMsg = (text: string) => {
    if (!text.trim()) return;
    setMessages(p => [...p, { role: "user", text, time: now() }]);
    setInput("");
    setTimeout(() => setMessages(p => [...p, { role: "bot", text: getBotResponse(text), time: now() }]), 700);
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="h-full flex">

      {/* ── Riwayat Panel (collapsible) ── */}
      <div className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200 ${riwayatOpen ? "w-56" : "w-10"}`}>
        {riwayatOpen ? (
          <>
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-black text-gray-700">Riwayat</p>
              <div className="flex items-center gap-2">
                <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">+ Baru</button>
                <button onClick={() => setRiwayatOpen(false)} title="Tutup riwayat"
                  className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={12} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {RIWAYAT_SESSIONS.map((group, gi) => (
                <div key={group.group} className="mb-3">
                  <p className="px-4 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider">{group.group}</p>
                  {group.items.map((item, ii) => {
                    const idx = gi * 10 + ii;
                    return (
                      <button key={item.label} onClick={() => setActiveSession(idx)}
                        className={`w-full text-left px-4 py-2.5 transition-colors ${activeSession === idx ? "bg-blue-50 border-r-2 border-blue-500" : "hover:bg-gray-50"}`}>
                        <p className={`text-xs font-semibold truncate ${activeSession === idx ? "text-blue-700" : "text-gray-700"}`}>{item.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.time}</p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-3 gap-2">
            <button onClick={() => setRiwayatOpen(true)} title="Buka riwayat"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: GRAD.blue }}>
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">Asisten AI SIAP-ASN</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Aktif · Data Agustus 2026
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
            <Database size={10} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-600">80.277 ASN</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "bot" ? "" : "bg-gray-200"}`}
                style={msg.role === "bot" ? { background: GRAD.blue } : {}}>
                {msg.role === "bot"
                  ? <Bot size={14} className="text-white" />
                  : <User size={14} className="text-gray-600" />}
              </div>
              <div className={`max-w-[72%] flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "bot" ? "bg-white border border-gray-200 text-gray-800 rounded-bl-sm" : "text-white rounded-br-sm"}`}
                  style={msg.role === "user" ? { background: GRAD.blue } : {}}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Topik Cepat — above input, shown only before conversation starts */}
        {messages.length <= 1 && (
          <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-0 flex-shrink-0">
            <p className="text-[11px] font-bold text-gray-500 mb-2">Topik Cepat — klik untuk langsung bertanya</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOPICS.map(t => (
                <button key={t} onClick={() => sendMsg(t)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors font-semibold">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex gap-2 mb-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMsg(input)}
              placeholder="Tanyakan tentang data kepegawaian ASN..."
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-gray-50"
            />
            <button onClick={() => sendMsg(input)}
              className="px-4 py-3 rounded-xl text-white transition-all hover:opacity-90"
              style={{ background: GRAD.blue }}>
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">Jawaban dihasilkan AI dari data agregat. Selalu verifikasi untuk keputusan resmi.</p>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
