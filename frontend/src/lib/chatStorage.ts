// Penyimpanan riwayat chat di browser (tanpa login).
// Riwayat bersifat per-perangkat: tidak dibagikan ke pengguna lain.

export interface ChatMsg {
  role: "user" | "bot";
  text: string;
  time: string;
  sources?: string[];
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMsg[]; // tanpa sapaan awal dan tanpa pesan error
}

const CONV_KEY = "siap-asn:chats:v2";
const ACTIVE_KEY = "siap-asn:active-chat";
const LEGACY_KEY = "siap-asn:chat:v1";
const SESSION_KEY = "siap-asn:session-id";

const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 60;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // percakapan dibuang setelah 30 hari

const nowStr = () =>
  new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const newId = uuid;

const isMsg = (m: unknown): m is ChatMsg => {
  const x = m as ChatMsg;
  return (
    !!x &&
    (x.role === "user" || x.role === "bot") &&
    typeof x.text === "string" &&
    typeof x.time === "string"
  );
};

const readAll = (): Conversation[] => {
  try {
    localStorage.removeItem(LEGACY_KEY);
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const now = Date.now();
    return data
      .filter(
        (c): c is Conversation =>
          !!c &&
          typeof c.id === "string" &&
          typeof c.title === "string" &&
          typeof c.updatedAt === "number" &&
          now - c.updatedAt <= TTL_MS &&
          Array.isArray(c.messages),
      )
      .map(c => ({ ...c, messages: c.messages.filter(isMsg) }))
      .filter(c => c.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

const writeAll = (list: Conversation[]) => {
  try {
    localStorage.setItem(CONV_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
  } catch {
    /* storage penuh / diblokir: abaikan, chat tetap jalan tanpa persist */
  }
};

export const listConversations = (): Conversation[] => readAll();

export const getConversation = (id: string): Conversation | undefined =>
  readAll().find(c => c.id === id);

/** Simpan / perbarui percakapan. Percakapan tanpa pertanyaan pengguna tidak disimpan. */
export function upsertConversation(id: string, msgs: ChatMsg[]): void {
  const keep = msgs.filter(m => !m.error).slice(-MAX_MESSAGES);
  const first = keep.find(m => m.role === "user");
  const rest = readAll().filter(c => c.id !== id);
  if (!first) {
    writeAll(rest);
    return;
  }
  const title = first.text.length > 60 ? `${first.text.slice(0, 57)}…` : first.text;
  writeAll([{ id, title, updatedAt: Date.now(), messages: keep }, ...rest]);
}

export function deleteConversation(id: string): void {
  writeAll(readAll().filter(c => c.id !== id));
}

export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* abaikan */
  }
}

/** Jika pertanyaan terakhir belum sempat dijawab (halaman ditutup saat menunggu), beri catatan. */
export function recoverMessages(msgs: ChatMsg[]): ChatMsg[] {
  if (msgs.length && msgs[msgs.length - 1].role === "user") {
    return [
      ...msgs,
      {
        role: "bot",
        text: "Maaf, jawaban untuk pertanyaan sebelumnya terputus. Silakan kirim ulang.",
        error: true,
        time: nowStr(),
      },
    ];
  }
  return msgs;
}

/** ID anonim per browser, untuk korelasi log di server. Bukan identitas pengguna. */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}
