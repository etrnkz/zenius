'use client';

import { useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import type { Note } from '@/lib/note-context';

function stripAiMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ChatPanel({ note }: { note: Note }) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    const userMessage = { role: 'user', content: userInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const fullContext = (note.content?.trim() || note.generatedNotes || '').trim();
      const contextForChat = fullContext.length > 10
        ? fullContext.substring(0, 12000)
        : '';
      const historyForRequest = [...messages.slice(-7), userMessage];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userInput,
          context: contextForChat,
          noteTitle: note.title,
          history: historyForRequest,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallbackMessage = typeof data.error === 'string'
          ? `Chat service error: ${data.error}`
          : `Chat service error: ${response.status}`;
        setMessages((prev) => [...prev, { role: 'assistant', content: fallbackMessage }]);
        return;
      }

      const assistantMessage = data.response || 'No response received';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error('[app] Chat error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[50vh] flex-col">
      <div className="mb-2 flex flex-wrap gap-2">
        {['Give me a 5-point recap', 'What should I memorize first?'].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] font-medium text-zinc-400 transition hover:border-zinc-500"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-zinc-200">Ask anything about "{note.title}"</p>
            <p className="mt-1 text-xs text-zinc-500">I'll answer from your material.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'border border-zinc-700 bg-zinc-900 text-zinc-200'
                  : 'text-zinc-300'
              }`}>
                {msg.role === 'assistant' ? stripAiMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="text-xs text-zinc-500">Thinking...</div>}
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-zinc-300 disabled:opacity-40"
        >
          <SendHorizontal className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
