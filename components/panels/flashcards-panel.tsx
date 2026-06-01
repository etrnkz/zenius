'use client';

import { useEffect, useState } from 'react';
import type { Note } from '@/lib/note-context';
import { generateFlashcards } from '@/lib/data-generator';
import type { Flashcard } from '@/lib/data-generator';

function estimateStudyItemCount(_note: Note, sourceContent: string): number {
  const wordCount = sourceContent.split(/\s+/).filter(Boolean).length;
  const fallbackUnits = Math.max(1, Math.ceil(wordCount / 120));
  return Math.max(15, Math.min(30, Math.ceil(fallbackUnits * 1.5)));
}

export function FlashcardsPanel({ note }: { note: Note }) {
  const rawContent = note.content || note.generatedNotes || '';
  const sourceContent = rawContent.trim();
  const targetCount = estimateStudyItemCount(note, sourceContent);
  const [isFlipped, setIsFlipped] = useState(false);
  const [current, setCurrent] = useState(0);
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);

  useEffect(() => {
    let isActive = true;

    const initialCards = sourceContent.length > 20
      ? generateFlashcards(sourceContent, note.title, targetCount)
      : generateFlashcards(`Study topic: ${note.title}`, note.title, targetCount);

    setFlashcards(initialCards);
    setCurrent(0);
    setIsFlipped(false);
    setMastered(new Set());
    setError('');

    if (sourceContent.length < 20) {
      return () => { isActive = false; };
    }

    const loadFlashcards = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/generate-flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: note.title,
            content: sourceContent,
            count: targetCount,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate flashcards');
        }

        if (isActive && Array.isArray(data.flashcards) && data.flashcards.length >= Math.min(15, targetCount)) {
          setFlashcards(data.flashcards);
        }
      } catch (fetchError) {
        console.error('[app] Flashcard API error:', fetchError);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadFlashcards();
    return () => { isActive = false; };
  }, [note.id, note.title, sourceContent, targetCount]);

  useEffect(() => {
    if (current >= flashcards.length) {
      setCurrent(Math.max(0, flashcards.length - 1));
    }
  }, [current, flashcards.length]);

  if (flashcards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
        <p>No source text. Upload a file or generate notes first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Cards: {targetCount}</span>
        <span className="text-zinc-500">{mastered.size}/{flashcards.length} mastered</span>
      </div>

      {isLoading && <p className="text-xs text-zinc-500">Generating...</p>}
      {error && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-400">{error}</p>}

      <button
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full rounded-lg border border-emerald-500/50 bg-emerald-950/30 p-4 text-center text-white"
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-green-300">
          {isFlipped ? 'Answer' : 'Question'}
        </p>
        <p className="text-sm font-medium">
          {isFlipped ? flashcards[current].back : flashcards[current].front}
        </p>
      </button>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => { setCurrent(Math.max(0, current - 1)); setIsFlipped(false); }}
          disabled={current === 0}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-xs text-zinc-500">{current + 1}/{flashcards.length}</span>
        <button
          onClick={() => { setCurrent(Math.min(flashcards.length - 1, current + 1)); setIsFlipped(false); }}
          disabled={current === flashcards.length - 1}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => {
            const newMastered = new Set(mastered);
            newMastered.has(current) ? newMastered.delete(current) : newMastered.add(current);
            setMastered(newMastered);
          }}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            mastered.has(current) ? 'bg-emerald-600 text-white' : 'border border-zinc-700 text-zinc-400'
          }`}
        >
          {mastered.has(current) ? 'Done' : 'Mark'}
        </button>
      </div>
    </div>
  );
}
