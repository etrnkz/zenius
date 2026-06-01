'use client';

import { useEffect, useState } from 'react';
import type { Note } from '@/lib/note-context';
import { generateQuizQuestions } from '@/lib/data-generator';
import type { QuizQuestion } from '@/lib/data-generator';

function estimateStudyItemCount(_note: Note, sourceContent: string): number {
  const wordCount = sourceContent.split(/\s+/).filter(Boolean).length;
  const fallbackUnits = Math.max(1, Math.ceil(wordCount / 120));
  return Math.max(15, Math.min(30, Math.ceil(fallbackUnits * 1.5)));
}

export function QuizzesPanel({ note }: { note: Note }) {
  const rawContent = note.content || note.generatedNotes || '';
  const sourceContent = rawContent.trim();
  const targetCount = estimateStudyItemCount(note, sourceContent);
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selfScore, setSelfScore] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let isActive = true;

    const loadQuestions = async () => {
      setIsLoading(true);

      try {
        if (sourceContent.length > 50) {
          const response = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: note.title,
              content: sourceContent,
              count: targetCount,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (isActive && Array.isArray(data.questions) && data.questions.length >= 5) {
              setQuestions(data.questions);
              setAnswers(new Array(data.questions.length).fill(null));
              setCurrent(0);
              setCompleted(false);
              setIsLoading(false);
              return;
            }
          }
        }

        const fallbackContent = sourceContent.length > 20 ? sourceContent : `Study topic: ${note.title}`;
        const fallback = generateQuizQuestions(fallbackContent, note.title, targetCount);
        setQuestions(fallback);
        setAnswers(new Array(fallback.length).fill(null));
        setCurrent(0);
        setCompleted(false);
        setError('');
      } catch (err) {
        console.error('[app] Quiz load error:', err);
        if (isActive) {
          const fallbackContent = sourceContent.length > 20 ? sourceContent : `Study topic: ${note.title}`;
          const fallback = generateQuizQuestions(fallbackContent, note.title, targetCount);
          setQuestions(fallback);
          setAnswers(new Array(fallback.length).fill(null));
          setCurrent(0);
          setCompleted(false);
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadQuestions();
    return () => { isActive = false; };
  }, [note.id, note.title, sourceContent, targetCount]);

  const score = Object.values(selfScore).filter(Boolean).length;
  const progress = ((current + 1) / questions.length) * 100;

  if (questions.length === 0) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-zinc-400">Generating quiz...</p>
          <p className="mt-1 text-xs text-zinc-500">This may take a moment</p>
        </div>
      );
    }

    const fallbackQuestions = generateQuizQuestions(`Study topic: ${note.title}`, note.title, targetCount);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Question 1/{fallbackQuestions.length}</span>
          <div className="h-1.5 w-20 rounded-full bg-zinc-800">
            <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: '0%' }} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="mb-3 text-sm font-medium text-zinc-200">{fallbackQuestions[0]?.question}</p>
          <button
            onClick={() => {
              const q = fallbackQuestions[0];
              if (q) alert(`${q.question}\n\nAnswer: ${q.answer}`);
            }}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700"
          >
            Reveal Answer
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    const finalScore = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-lg border border-green-600 bg-gradient-to-br from-green-600 to-emerald-600 p-4 text-center text-white">
        <div className="mb-2 text-4xl font-bold">{finalScore}%</div>
        <p className="mb-3 text-sm text-green-200">{score}/{questions.length} self-evaluated correct</p>
        <button
          onClick={() => {
            setCurrent(0);
            setRevealed({});
            setSelfScore({});
            setCompleted(false);
          }}
          className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-green-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isRevealed = !!revealed[current];
  const typeLabel = questions[current]?.type
    ? { core: 'Core Understanding', process: 'Process / Mechanism', application: 'Application', confusion: 'Confusion Test', edge: 'Deep Thinking' }[questions[current].type]
    : 'Question';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Question {current + 1}/{questions.length}</span>
        <div className="h-1.5 w-20 rounded-full bg-zinc-800">
          <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isLoading && <p className="text-xs text-zinc-500">Generating...</p>}
      {error && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-400">{error}</p>}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <span className="mb-2 inline-block rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{typeLabel}</span>
        <p className="mb-3 text-sm font-medium text-zinc-200">{questions[current].question}</p>

        {Array.isArray(questions[current].options) && questions[current].options.length === 4 ? (
          <div className="space-y-2">
            {questions[current].options.map((option: string, i: number) => (
              <button
                key={i}
                onClick={() => {
                  const next = [...answers];
                  next[current] = i;
                  setAnswers(next);
                  setRevealed((prev) => ({ ...prev, [current]: true }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                  isRevealed && i === questions[current].correct
                    ? 'border-emerald-600 bg-emerald-900/30 text-emerald-300'
                    : isRevealed && answers[current] === i && i !== questions[current].correct
                    ? 'border-rose-600 bg-rose-900/30 text-rose-300'
                    : 'border-zinc-700 bg-zinc-900/30 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-300">
            This question is missing choices. Regenerate quiz to get full MCQ format.
          </p>
        )}

        <div className="mt-3">
          <button
            onClick={() => setRevealed((prev) => ({ ...prev, [current]: true }))}
            disabled={isRevealed || (Array.isArray(questions[current].options) && questions[current].options.length === 4)}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-emerald-600"
          >
            {isRevealed ? 'Answer Revealed' : 'Reveal Answer'}
          </button>
        </div>

        {isRevealed && (
          <div className="mt-3 space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Correct Answer</p>
              <p className="mt-1 text-sm text-zinc-200">
                {Array.isArray(questions[current].options) && typeof questions[current].correct === 'number'
                  ? questions[current].options[questions[current].correct] || questions[current].answer || 'N/A'
                  : questions[current].answer}
              </p>
            </div>
            {questions[current].explanation && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Explanation</p>
                <p className="mt-1 text-xs text-zinc-400">{questions[current].explanation}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSelfScore((prev) => ({ ...prev, [current]: true }))}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selfScore[current] === true
                    ? 'bg-emerald-600 text-white'
                    : 'border border-zinc-700 text-zinc-400 hover:border-emerald-600 hover:text-emerald-400'
                }`}
              >
                Got it
              </button>
              <button
                onClick={() => setSelfScore((prev) => ({ ...prev, [current]: false }))}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selfScore[current] === false
                    ? 'bg-rose-600 text-white'
                    : 'border border-zinc-700 text-zinc-400 hover:border-rose-600 hover:text-rose-400'
                }`}
              >
                Need review
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => { if (current > 0) setCurrent(current - 1); }}
          disabled={current === 0}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
        >
          Prev
        </button>
        <button
          onClick={() => {
            if (current === questions.length - 1) setCompleted(true);
            else setCurrent(current + 1);
          }}
          className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
        >
          {current === questions.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}
