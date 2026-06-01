'use client';

import { useMemo } from 'react';
import { Upload, Link as LinkIcon, Mic, Clock } from 'lucide-react';
import type { Note } from '@/lib/note-context';
import { FileRow } from '@/components/tab-panels/shared';

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
