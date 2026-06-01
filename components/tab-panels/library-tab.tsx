'use client';

import { useMemo } from 'react';
import type { Note, TabType } from '@/lib/note-context';

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
                    {([['note', 'Notes'], ['flashcards', 'Flashcards'], ['quizzes', 'Quizzes'], ['podcast', 'Podcasts']] as const).map(([id, label]) => (
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
