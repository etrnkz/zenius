'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Mic,
  Clock,
  FileText,
  ChevronRight,
  Layers,
  MessageCircle,
  BookOpen,
  Search,
  Globe,
  File,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react';
import type { Note } from '@/lib/note-context';
import type { TabType } from '@/lib/note-context';
import { searchGlobalChat, loadGlobalChat, saveGlobalChat, type GlobalChatMessage } from '@/lib/global-chat-storage';

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods', '.odp'];
const DOCUMENT_TYPES = ['document', 'pdf'];

function getFileIcon(fileName: string) {
  const ext = (fileName || '').toLowerCase().slice((fileName || '').lastIndexOf('.'));
  if (ext === '.pdf') return <FileText className="h-5 w-5 text-red-400" />;
  if (['.ppt', '.pptx'].includes(ext)) return <Presentation className="h-5 w-5 text-orange-400" />;
  if (['.xls', '.xlsx'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (['.doc', '.docx', '.odt'].includes(ext)) return <FileText className="h-5 w-5 text-blue-400" />;
  return <File className="h-5 w-5 text-zinc-400" />;
}

function FileRow({ note, onOpen, useDocViewer = true }: { note: Note; onOpen: () => void; useDocViewer?: boolean }) {
  const fileName = note.fileName || note.title;
  const ext = (fileName || '').toLowerCase().slice((fileName || '').lastIndexOf('.'));
  const isViewableDoc = ['.pdf', '.xlsx', '.xls', '.docx', '.doc'].includes(ext);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // If useDocViewer is false, always go to learning hub (like Library)
    if (!useDocViewer) {
      onOpen();
      return;
    }
    
    // For viewable documents (PDF, Excel, Word), open in the universal viewer
    if (isViewableDoc && note.fileUrl) {
      window.dispatchEvent(new CustomEvent('openDocViewer', { 
        detail: { url: note.fileUrl, name: fileName } 
      }));
      return;
    }
    
    // For other documents (PPTX, PPT, etc), try to open inline or fallback to download
    if (isDocumentFile(note) && note.fileUrl) {
      window.dispatchEvent(new CustomEvent('openDocViewer', { 
        detail: { url: note.fileUrl, name: fileName } 
      }));
      return;
    }
    
    // Fall back to learning hub for non-documents
    onOpen();
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-black px-3 py-3 text-left transition hover:border-zinc-600"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800">
        {getFileIcon(note.fileName || note.title)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{note.fileName || note.title}</span>
      <span className="text-xs text-zinc-500">Open</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
    </button>
  );
}

function isDocumentFile(note: Note): boolean {
  if (DOCUMENT_TYPES.includes(note.type)) return true;
  if (note.fileName) {
    const ext = note.fileName.toLowerCase().slice(note.fileName.lastIndexOf('.'));
    return DOCUMENT_EXTENSIONS.includes(ext);
  }
  return false;
}

function downloadFileNatively(note: Note) {
  const fileUrl = note.fileUrl;
  const fileName = note.fileName || note.title;
  
  if (!fileUrl) {
    return false;
  }
  
  // Check if it's a data URL (base64)
  if (fileUrl.startsWith('data:')) {
    // For base64, create a download link
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
  
  // For regular URLs, open in new tab (triggers download)
  window.open(fileUrl, '_blank');
  return true;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

type FilesSub = 'recent' | 'all';

function openFileNatively(fileUrl: string, fileName: string) {
  const filename = fileName || 'document';
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    return false;
  }

  if (fileUrl.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
  
  window.open(fileUrl, '_blank');
  return true;
}

export function ZeniusHomeTab({
  notes,
  onOpenNote,
  onOpenUpload,
  onOpenLink,
  onOpenAudio,
}: {
  notes: Note[];
  onOpenNote: (n: Note) => void;
  onOpenUpload: () => void;
  onOpenLink: () => void;
  onOpenAudio: () => void;
}) {
  const recent = useMemo(() => [...notes].slice(0, 8), [notes]);

  const actions = [
    { label: 'Upload file', sub: 'PDF, DOC, PPT…', icon: Upload, onClick: onOpenUpload },
    { label: 'Paste link', sub: 'Article or video', icon: LinkIcon, onClick: onOpenLink },
    { label: 'Record audio', sub: 'Lecture or voice', icon: Mic, onClick: onOpenAudio },
  ];

  return (
    <div className="space-y-8 pb-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Start</h2>
        <div className="grid gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-left transition hover:border-zinc-600"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 text-white">
                <a.icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{a.label}</span>
                <span className="text-xs text-zinc-500">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
            No activity yet. Upload a file or paste a link to begin.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((n) => (
              <li key={n.id}>
                <FileRow note={n} onOpen={() => onOpenNote(n)} useDocViewer={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

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
    } catch (err) {
      console.error('[app] Web search error:', err);
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

      {/* Web Search Results */}
      {hasSearched && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Globe className="h-3.5 w-3.5" /> Web Results
          </h3>
          
          {isSearching && (
            <p className="text-sm text-zinc-500">Searching the web...</p>
          )}
          
          {searchError && (
            <p className="text-sm text-amber-500">{searchError}</p>
          )}
          
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
            <iframe
              src={viewingUrl}
              className="flex-1 w-full border-0"
              title="Web content"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ZeniusFilesTab({
  notes,
  onOpenNote,
  onOpenDocViewer,
}: {
  notes: Note[];
  onOpenNote: (n: Note) => void;
  onOpenDocViewer?: (url: string, name: string) => void;
}) {
  const [sub, setSub] = useState<FilesSub>('recent');
  const [fileQuery, setFileQuery] = useState('');

  // Filter to show only document files (no videos, audio, links)
  const documentNotes = useMemo(() => {
    return notes.filter(n => isDocumentFile(n));
  }, [notes]);

  const sorted = useMemo(() => {
    const base =
      sub === 'recent'
        ? [...documentNotes].sort((a, b) => (a.lastOpened < b.lastOpened ? 1 : -1))
        : [...documentNotes].sort((a, b) => a.title.localeCompare(b.title));
    const fq = fileQuery.trim().toLowerCase();
    if (!fq) return base;
    return base.filter(
      (n) =>
        n.title.toLowerCase().includes(fq) ||
        (n.fileName && n.fileName.toLowerCase().includes(fq))
    );
  }, [documentNotes, sub, fileQuery]);

  return (
    <div className="space-y-4 pb-8">
      <label className="block">
        <span className="sr-only">Search files</span>
        <div className="relative">
          <input
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
            className="w-full rounded-full border border-zinc-800 bg-black py-3 pl-4 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            placeholder="Search files…"
          />
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </label>

      <div className="border-b border-zinc-800">
        <div className="-mb-px flex gap-4">
          {(
            [
              ['recent', 'Recent'],
              ['all', 'All files'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                sub === id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">No document files. Upload PDF, Word, PowerPoint files from Home.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => (
            <li key={n.id}>
              <FileRow note={n} onOpen={() => {
                // For document files, open in the document viewer
                if (isDocumentFile(n) && n.fileUrl && onOpenDocViewer) {
                  onOpenDocViewer(n.fileUrl, n.fileName || n.title);
                } else if (isDocumentFile(n) && n.fileUrl) {
                  // Fallback to event if prop not passed
                  window.dispatchEvent(new CustomEvent('openDocViewer', { 
                    detail: { url: n.fileUrl, name: n.fileName || n.title } 
                  }));
                } else {
                  onOpenNote(n);
                }
              }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

export function ZeniusLibraryTab({
  notes,
  onOpenSection,
}: {
  notes: Note[];
  onOpenSection: (note: Note, section: TabType) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const key = n.subject?.trim() || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);

  return (
    <div className="space-y-8 pb-8">
      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-sm text-zinc-500">Nothing processed yet.</p>
      ) : (
        grouped.map(([topic, list]) => (
          <section key={topic}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{topic}</h3>
            <div className="space-y-3">
              {list.map((n) => (
                <div key={n.id} className="rounded-xl border border-zinc-800 p-3">
                  <p className="mb-2 truncate text-sm font-medium text-white">{n.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['note', 'Notes'],
                        ['flashcards', 'Flashcards'],
                        ['quizzes', 'Quizzes'],
                        ['podcast', 'Podcasts'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenSection(n, id)}
                        className="rounded-lg border border-zinc-800 py-2 text-center text-xs font-medium text-zinc-300 hover:border-zinc-600"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
