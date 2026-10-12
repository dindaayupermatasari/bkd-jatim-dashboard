import { getSessionId } from "./chatStorage";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  answer: string;
  sources: string[];
}

// Jika proyekmu sudah punya konstanta base URL API untuk dashboard, pakai itu saja.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export class ChatError extends Error {}

export async function sendChat(
  message: string,
  history: ChatHistoryItem[],
  signal?: AbortSignal,
): Promise<ChatResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": getSessionId(),
      },
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch {
    throw new ChatError("Tidak dapat terhubung ke server. Periksa koneksi atau coba lagi.");
  }

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* body bukan JSON */
    }
    // detail berupa array saat validasi gagal (422); tampilkan pesan umum saja
    throw new ChatError(
      typeof detail === "string" && detail
        ? detail
        : `Permintaan gagal (kode ${res.status}).`,
    );
  }
  return (await res.json()) as ChatResult;
}
