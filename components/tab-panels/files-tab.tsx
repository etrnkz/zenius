'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { Note } from '@/lib/note-context';
import { isDocumentFile, FileRow, type FilesSub } from '@/components/tab-panels/shared';

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

  const documentNotes = useMemo(() => notes.filter(n => isDocumentFile(n)), [notes]);

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
          {([['recent', 'Recent'], ['all', 'All files']] as const).map(([id, label]) => (
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
              <FileRow
                note={n}
                onOpen={() => {
                  if (isDocumentFile(n) && n.fileUrl && onOpenDocViewer) {
                    onOpenDocViewer(n.fileUrl, n.fileName || n.title);
                  } else if (isDocumentFile(n) && n.fileUrl) {
                    window.dispatchEvent(new CustomEvent('openDocViewer', {
                      detail: { url: n.fileUrl, name: n.fileName || n.title }
                    }));
                  } else {
                    onOpenNote(n);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
