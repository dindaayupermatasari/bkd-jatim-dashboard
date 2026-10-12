import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Database, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { GRAD, QUICK_TOPICS } from "../lib/constants";
import { sendChat, type ChatHistoryItem } from "../lib/chatApi";
import {
  type ChatMsg,
  type Conversation,
  newId,
  listConversations,
  getConversation,
  upsertConversation,
  deleteConversation,
  getActiveId,
  setActiveId as storeActiveId,
  recoverMessages,
} from "../lib/chatStorage";

const nowStr = () =>
  new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

const greeting = (): ChatMsg => ({
  role: "bot",
  text: "Halo! Saya Asisten AI SIAP-ASN. Saya dapat menjawab pertanyaan seputar data kepegawaian ASN Jawa Timur (PNS, PPPK, dan PPPK paruh waktu), seperti jumlah, komposisi, dan proyeksi pensiun. Silakan ajukan pertanyaan.",
  time: nowStr(),
});

// Riwayat percakapan yang dikirim ke server: tanpa sapaan awal dan tanpa pesan error.
const toHistory = (msgs: ChatMsg[]): ChatHistoryItem[] =>
  msgs
    .slice(1)
    .filter(m => !m.error)
    .slice(-10)
    .map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text.slice(0, 4000),
    }));

const fmtWhen = (ts: number) => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const groupConvs = (list: Conversation[]) => {
  const today = dayStart(Date.now());
  const DAY = 86_400_000;
  const groups = [
    { group: "Hari Ini", items: [] as Conversation[] },
    { group: "Kemarin", items: [] as Conversation[] },
    { group: "Sebelumnya", items: [] as Conversation[] },
  ];
  for (const c of list) {
    const d = dayStart(c.updatedAt);
    (d >= today ? groups[0] : d >= today - DAY ? groups[1] : groups[2]).items.push(c);
  }
  return groups.filter(g => g.items.length > 0);
};

const MD: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left font-bold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-gray-200 px-2.5 py-1.5">{children}</td>,
};

const ChatbotPage = () => {
  // Pulihkan percakapan aktif terakhir (tetap ada saat pindah halaman / refresh).
  const [initial] = useState(() => {
    const id = getActiveId();
    const conv = id ? getConversation(id) : undefined;
    return conv
      ? { id: conv.id, msgs: recoverMessages(conv.messages) }
      : { id: newId(), msgs: [] as ChatMsg[] };
  });

  const [activeId, setActiveId] = useState(initial.id);
  const [messages, setMessages] = useState<ChatMsg[]>(() => [greeting(), ...initial.msgs]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [riwayatOpen, setRiwayatOpen] = useState(true);
  const [convs, setConvs]       = useState<Conversation[]>(() => listConversations());
  const endRef = useRef<HTMLDivElement>(null);

  const sendMsg = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    const history = toHistory(messages);
    setMessages(p => [...p, { role: "user", text, time: nowStr() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChat(text, history);
      setMessages(p => [...p, { role: "bot", text: res.answer, sources: res.sources, time: nowStr() }]);
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : "Terjadi kesalahan.";
      setMessages(p => [...p, { role: "bot", text: `Maaf, ${reason}`, error: true, time: nowStr() }]);
    } finally {
      setLoading(false);
    }
  };

  // Percakapan lama tetap tersimpan di riwayat; chat baru hanya membuka percakapan kosong.
  const newChat = () => {
    if (loading) return;
    setActiveId(newId());
    setMessages([greeting()]);
    setInput("");
  };

  const openConversation = (id: string) => {
    if (loading) return;
    const conv = getConversation(id);
    if (!conv) return;
    setActiveId(conv.id);
    setMessages([greeting(), ...recoverMessages(conv.messages)]);
    setInput("");
  };

  const removeConversation = (id: string) => {
    if (loading) return;
    deleteConversation(id);
    if (id === activeId) newChat();
    else setConvs(listConversations());
  };

  // Simpan percakapan aktif setiap ada perubahan.
  useEffect(() => {
    upsertConversation(activeId, messages.slice(1));
    setConvs(listConversations());
  }, [messages, activeId]);
  useEffect(() => { storeActiveId(activeId); }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  return (
    <div className="h-full flex">

      {/* ── Riwayat Panel (collapsible) ── */}
      <div className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-200 ${riwayatOpen ? "w-56" : "w-10"}`}>
        {riwayatOpen ? (
          <>
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-black text-gray-700">Riwayat</p>
              <div className="flex items-center gap-2">
                <button onClick={newChat} disabled={loading}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-40">+ Baru</button>
                <button onClick={() => setRiwayatOpen(false)} title="Tutup riwayat"
                  className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={12} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {convs.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">Belum ada riwayat percakapan.</p>
              ) : groupConvs(convs).map(g => (
                <div key={g.group} className="mb-3">
                  <p className="px-4 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider">{g.group}</p>
                  {g.items.map(c => (
                    <div key={c.id}
                      className={`group flex items-center transition-colors ${c.id === activeId ? "bg-blue-50 border-r-2 border-blue-500" : "hover:bg-gray-50"}`}>
                      <button onClick={() => openConversation(c.id)} disabled={loading}
                        className="flex-1 min-w-0 text-left pl-4 pr-1 py-2.5 disabled:opacity-60">
                        <p className={`text-xs font-semibold truncate ${c.id === activeId ? "text-blue-700" : "text-gray-700"}`}>{c.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmtWhen(c.updatedAt)}</p>
                      </button>
                      <button onClick={() => removeConversation(c.id)} disabled={loading} title="Hapus percakapan"
                        className="p-1.5 mr-2 rounded text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
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
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
            <Database size={10} className="text-blue-500" />
            <span className="text-[10px] font-bold text-blue-600">80.277 ASN</span>
          </div>

        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "bot" ? "" : "bg-gray-200"}`}
                style={msg.role === "bot" ? { background: GRAD.blue } : {}}>
                {msg.role === "bot"
                  ? <Bot size={14} className="text-white" />
                  : <User size={14} className="text-gray-600" />}
              </div>
              <div className={`max-w-[88%] min-w-0 flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "bot"
                      ? `bg-white border text-gray-800 rounded-bl-sm ${msg.error ? "border-red-200 text-red-700" : "border-gray-200"}`
                      : "text-white rounded-br-sm whitespace-pre-wrap break-words"}`}
                  style={msg.role === "user" ? { background: GRAD.blue } : {}}>
                  {msg.role === "bot" && !msg.error ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{msg.text}</ReactMarkdown>
                  ) : msg.text}
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      <summary className="cursor-pointer select-none font-semibold">Sumber data ({msg.sources.length})</summary>
                      <ul className="mt-1 space-y-0.5 list-disc pl-4 break-words">
                        {msg.sources.map((s, k) => <li key={k}>{s}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-end gap-2" role="status" aria-label="Asisten sedang mengetik">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: GRAD.blue }}>
                <Bot size={14} className="text-white" />
              </div>
              <div className="px-4 py-3.5 rounded-2xl rounded-bl-sm bg-white border border-gray-200 flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Topik Cepat — hanya tampil sebelum percakapan dimulai */}
      {messages.length <= 1 && (
        <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-0 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-1.5">
            {QUICK_TOPICS.map(t => (
              <button key={t} onClick={() => sendMsg(t)} disabled={loading}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors font-semibold disabled:opacity-50">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 mb-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendMsg(input); }}
              maxLength={1000}
              placeholder="Tanyakan tentang data kepegawaian ASN..."
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-gray-50"
            />
            <button onClick={() => sendMsg(input)} disabled={loading || !input.trim()} aria-label="Kirim"
              className="px-4 py-3 rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: GRAD.blue }}>
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">Jawaban dihasilkan AI dari data agregat. Selalu verifikasi untuk keputusan resmi.</p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
