'use client';

import { useNote } from '@/lib/note-context';
import type { Note } from '@/lib/note-context';
import { ZeniusMark } from '@/components/zenius-shell';
import { formatFileSize, getNoteTypeMeta } from '@/lib/note-display';
import { NotePanel } from '@/components/panels/note-panel';
import { FlashcardsPanel } from '@/components/panels/flashcards-panel';
import { QuizzesPanel } from '@/components/panels/quizzes-panel';
import { PodcastPanel } from '@/components/panels/podcast-panel';

export function LearningHubView({ note, onBack }: { note: Note; onBack: () => void }) {
  const { currentTab, setCurrentTab } = useNote();
  const noteTypeMeta = getNoteTypeMeta(note.type);
  const NoteTypeIcon = noteTypeMeta.icon;

  const tabs = [
    { id: 'note' as const, label: 'Notes' },
    { id: 'flashcards' as const, label: 'Flashcards' },
    { id: 'quizzes' as const, label: 'Quizzes' },
    { id: 'podcast' as const, label: 'Podcast' },
  ];

  return (
    <div className="relative min-h-[100dvh] bg-black pb-8 pt-[max(0.5rem,env(safe-area-inset-top))] text-zinc-100">
      <div className="mx-auto max-w-lg px-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <span aria-hidden>←</span>
          Back
        </button>

        <div className="mb-4 flex items-start gap-3">
          <ZeniusMark className="h-10 w-10 shrink-0 text-white" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-white">Zenius</h1>
            <p className="text-xs text-zinc-500">AI-Powered Learning Platform</p>
            <p className="mt-2 truncate text-sm text-zinc-300">{note.title}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${noteTypeMeta.badgeClass}`}>
                <NoteTypeIcon className="h-3 w-3" />
                {noteTypeMeta.label}
              </span>
              {formatFileSize(note.metadata?.fileSize) ? (
                <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  {formatFileSize(note.metadata?.fileSize)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-3 border-b border-zinc-800">
          <div className="-mb-px flex gap-0 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurrentTab(tab.id)}
                  className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors ${
                    isActive ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[min(70vh,32rem)] rounded-xl border border-zinc-800 bg-black p-3 sm:p-4">
          {currentTab === 'note' && <NotePanel note={note} />}
          {currentTab === 'flashcards' && <FlashcardsPanel note={note} />}
          {currentTab === 'quizzes' && <QuizzesPanel note={note} />}
          {currentTab === 'podcast' && <PodcastPanel note={note} />}
        </div>
      </div>
    </div>
  );
}
