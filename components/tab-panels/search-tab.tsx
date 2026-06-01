'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  FileText, BookOpen, Layers, MessageCircle, Globe, Search,
} from 'lucide-react';
import type { Note } from '@/lib/note-context';
import { searchGlobalChat, type GlobalChatMessage } from '@/lib/global-chat-storage';
import { FileRow } from '@/components/tab-panels/shared';
import type { WebSearchResult } from '@/components/tab-panels/shared';

export function ZeniusSearchTab({
  notes,
  query,
  onQuery,
  onOpenNote,
}: {
  notes: Note[];
  query: string;
  onQuery: (q: string) => void;
  onOpenNote: (n: Note) => void;
}) {
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const { fileHits, noteHits, flashHits, chatHits } = useMemo(() => {
    if (!q) {
      return { fileHits: [] as Note[], noteHits: [] as Note[], flashHits: [] as Note[], chatHits: [] as GlobalChatMessage[] };
    }
    const fileHits = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.fileName && n.fileName.toLowerCase().includes(q))
    );
    const textBlob = (n: Note) => `${n.generatedNotes || ''} ${n.content || ''}`.toLowerCase();
    const noteHits = notes.filter((n) => textBlob(n).includes(q) && !fileHits.some((f) => f.id === n.id));
    const flashHits = notes.filter(
      (n) =>
        Boolean(n.generatedNotes?.trim()) &&
        (n.generatedNotes || '').toLowerCase().includes(q) &&
        !fileHits.some((f) => f.id === n.id) &&
        !noteHits.some((x) => x.id === n.id)
    );
    const chatHits = searchGlobalChat(q);
    return { fileHits, noteHits: noteHits.slice(0, 12), flashHits, chatHits: chatHits.slice(0, 8) };
  }, [notes, q]);

  const hasLocalResults = q && (fileHits.length > 0 || noteHits.length > 0 || flashHits.length > 0 || chatHits.length > 0);
  const hasWebResults = webResults.length > 0;

  const handleWebSearch = async () => {
    if (!query.trim() || isSearching) return;
    setIsSearching(true);
    setSearchError('');
    setWebResults([]);
    setHasSearched(true);
    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data.results)) {
        setWebResults(data.results);
      } else {
        setSearchError(data.error || 'Search failed');
      }
    } catch {
      setSearchError('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setWebResults([]);
      setHasSearched(false);
      setSearchError('');
      return;
    }
    const timer = setTimeout(() => {
      handleWebSearch();
    }, 1500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-6 pb-8">
      <label className="block">
        <span className="sr-only">Search</span>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Browse the web..."
            className="w-full rounded-full border border-zinc-800 bg-black py-3 pl-4 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </label>

      {!q && <p className="text-center text-sm text-zinc-500">Browse the web instantly.</p>}
      {q && !hasLocalResults && !hasWebResults && !isSearching && <p className="text-sm text-zinc-500">No results.</p>}

      {q && fileHits.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <FileText className="h-3.5 w-3.5" /> Files
          </h3>
          <ul className="space-y-2">
            {fileHits.map((n) => (
              <li key={n.id}>
                <FileRow note={n} onOpen={() => onOpenNote(n)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && noteHits.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <BookOpen className="h-3.5 w-3.5" /> Notes
          </h3>
          <ul className="space-y-2">
            {noteHits.map((n) => (
              <li key={n.id}>
                <FileRow note={n} onOpen={() => onOpenNote(n)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && flashHits.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Layers className="h-3.5 w-3.5" /> Flashcards
          </h3>
          <ul className="space-y-2">
            {flashHits.map((n) => (
              <li key={n.id}>
                <FileRow note={n} onOpen={() => onOpenNote(n)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && chatHits.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <MessageCircle className="h-3.5 w-3.5" /> Chat history
          </h3>
          <ul className="space-y-2 rounded-xl border border-zinc-800 p-3">
            {chatHits.map((m, i) => (
              <li key={i} className="text-xs text-zinc-400 line-clamp-2">
                <span className="text-zinc-600">{m.role === 'user' ? 'You: ' : 'AI: '}</span>
                {m.content}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasSearched && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Globe className="h-3.5 w-3.5" /> Web Results
          </h3>
          {isSearching && <p className="text-sm text-zinc-500">Searching the web...</p>}
          {searchError && <p className="text-sm text-amber-500">{searchError}</p>}
          {hasWebResults && (
            <ul className="space-y-2">
              {webResults.map((result, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setViewingUrl(result.url)}
                    className="flex w-full items-center gap-3 rounded-lg border border-zinc-800 p-3 text-left hover:border-zinc-700"
                  >
                    <Globe className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{result.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{result.url}</p>
                      {result.snippet && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{result.snippet}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {viewingUrl && (
        <div className="fixed inset-0 z-50 bg-black/90">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="truncate text-sm text-zinc-400">{viewingUrl}</span>
              <button
                type="button"
                onClick={() => setViewingUrl(null)}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
            <iframe src={viewingUrl} className="flex-1 w-full border-0" title="Web content" />
          </div>
        </div>
      )}
    </div>
  );
}
