'use client';

export type GlobalChatMessage = { role: 'user' | 'assistant'; content: string };

const KEY = 'zenius_global_chat_v1';

export function loadGlobalChat(): GlobalChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m) => m as Record<string, unknown>)
      .filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      ) as GlobalChatMessage[];
  } catch {
    return [];
  }
}

export function saveGlobalChat(messages: GlobalChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(messages.slice(-80)));
  } catch {
    /* ignore */
  }
}

export function searchGlobalChat(query: string): GlobalChatMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return loadGlobalChat().filter((m) => m.content.toLowerCase().includes(q));
}
