'use client';

import { useEffect, useState, useRef } from 'react';
import { loadGlobalChat, saveGlobalChat, type GlobalChatMessage } from '@/lib/global-chat-storage';

export function ZeniusGlobalChatTab() {
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadGlobalChat());
  }, []);

  useEffect(() => {
    saveGlobalChat(messages);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    const user: GlobalChatMessage = { role: 'user', content: t };
    setMessages((m) => [...m, user]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: t,
          context: '',
          noteTitle: 'Global',
          history: [...messages.slice(-6), user],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const text = typeof data.response === 'string' ? data.response : 'No response.';
      setMessages((m) => [...m, { role: 'assistant', content: text }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col pb-4">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">Start a conversation. This chat stays separate from Learning Hub.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'border border-zinc-700 bg-zinc-900 text-zinc-100'
                  : 'text-zinc-300'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-2">
        <div className="relative flex items-end gap-2">
          <button type="button" className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center text-zinc-500" aria-label="Attach">
            +
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message…"
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-white disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
