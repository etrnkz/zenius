'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNote, type Note } from '@/lib/note-context';
import {
  FileText,
  Mic,
  Sparkles,
  SendHorizontal,
  Play,
  Square,
  Download,
  RefreshCcw,
  Languages,
  SlidersHorizontal,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { generateFlashcards, generateQuizQuestions, type QuizQuestion, type Flashcard } from '@/lib/data-generator';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize, getNoteTypeMeta } from '@/lib/note-display';
import { ZeniusMark } from '@/components/zenius-shell';

function estimateStudyItemCount(note: Note, sourceContent: string): number {
  const sourceUnits = note.metadata?.slideCount || note.metadata?.pageCount || 0;
  const wordCount = note.metadata?.wordCount || sourceContent.split(/\s+/).filter(Boolean).length;
  const fallbackUnits = Math.max(1, Math.ceil(wordCount / 120));
  const baseUnits = sourceUnits > 0 ? sourceUnits : fallbackUnits;

  return Math.max(15, Math.min(30, Math.ceil(baseUnits * 1.5)));
}

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

function parseStructuredNotes(text: string): Array<{ title: string; items: string[] }> {
  const lines = stripAiMarkdown(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (const rawLine of lines) {
    const normalizedLine = rawLine.replace(/\s+/g, ' ').trim();
    const headingMatch = normalizedLine.match(/^([A-Z][A-Z\s]+):?$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), items: [] };
      continue;
    }
    if (current) {
      const cleaned = normalizedLine.replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleaned) current.items.push(cleaned);
    }
  }

  if (current) sections.push(current);
  return sections;
}

type PodcastRole = 'VOICE_A' | 'VOICE_B' | 'NARRATOR';

function splitIntoSentences(value: string): string[] {
  return stripAiMarkdown(value)
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

function extractKeyPoints(value: string, maxPoints = 6): string[] {
  const candidates = splitIntoSentences(value)
    .map((line) =>
      line
        .replace(/^[•\-*]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim()
    )
    .filter((line) => line.length > 28 && line.length < 220)
    .filter((line) => !/^(topic snapshot|high-yield points|structure \/ flow|common confusions|quick recap)\b/i.test(line));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of candidates) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
    if (unique.length >= maxPoints) break;
  }

  return unique;
}

function pickPanelJoke(topic: string): string {
  const jokes = [
    'If this chapter had a gym membership, our brains just did the warm-up.',
    'My notebook is judging me, but at least now it understands the topic.',
    'This is the kind of concept that looks scary first, then becomes your exam best friend.',
    'If confusion had Wi-Fi, this recap just changed the password.',
  ];
  const hash = topic.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return jokes[Math.abs(hash) % jokes.length];
}

function buildSmartPodcastScript(source: string, title: string): string {
  const topic = title?.trim() || 'this topic';
  const points = extractKeyPoints(source, 7);
  const fallbackPoints = points.length > 0
    ? points
    : ['The source notes are short, so let us focus on the most important ideas and definitions first.'];

  const p1 = fallbackPoints[0] || 'Let us begin with the first concept.';
  const p2 = fallbackPoints[1] || p1;
  const p3 = fallbackPoints[2] || p2;
  const p4 = fallbackPoints[3] || p3;
  const p5 = fallbackPoints[4] || p4;
  const recap = [p1, p2, p3, p4, p5].slice(0, 5).map((line, index) => `${index + 1}. ${line}`);
  const joke = pickPanelJoke(topic);

  return [
    `Let us start with why ${topic} matters in real life. If you understand this, decisions become clearer and less random.`,
    `Good, because I do not want to memorize words. I want to know how to think with it.`,
    '',
    'Give me the core idea in one simple line.',
    `Core idea: ${p1}`,
    '',
    'Why does that actually work?',
    `It works because ${p2}`,
    '',
    'Wait, that sounds too clean. What breaks when people use it badly?',
    `Great challenge. A common failure is ${p3}`,
    '',
    'Give me a real-life scenario, not theory.',
    `Imagine this situation: ${p4}`,
    '',
    'I thought this was just a terminology issue.',
    `Not exactly. That is a common confusion. The real point is ${p5}`,
    '',
    'Okay, fair correction. Also, quick joke break before my brain crashes.',
    `${joke}`,
    '',
    'Quick recap, 3 to 5 takeaways, short lines only.',
    'Recap starts now.',
    ...recap,
    '',
    'Nice, now it actually makes sense.',
    'Perfect. If you can explain these takeaways in your own words, you understand it.',
  ].join('\n');
}

function extractDialogueSegments(value: string): Array<{ speaker: PodcastRole; text: string }> {
  const lines = stripAiMarkdown(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: Array<{ speaker: PodcastRole; text: string }> = [];
  let lastSpeaker: PodcastRole = 'NARRATOR';

  for (const line of lines) {
    const match = line.match(/^(VOICE\s*A|VOICE\s*B|EMMA|ALEX)\s*:\s*(.+)$/i);
    if (match) {
      const rawSpeaker = match[1].toUpperCase().replace(/\s+/g, '');
      const speaker: PodcastRole = rawSpeaker === 'VOICEA' || rawSpeaker === 'ALEX'
        ? 'VOICE_A'
        : 'VOICE_B';
      const text = match[2].trim();
      if (text) {
        segments.push({ speaker, text });
        lastSpeaker = speaker;
      }
      continue;
    }

    if (!line) continue;

    if (segments.length > 0 && lastSpeaker !== 'NARRATOR') {
      const last = segments[segments.length - 1];
      segments[segments.length - 1] = { ...last, text: `${last.text} ${line}`.trim() };
    } else {
      segments.push({ speaker: 'NARRATOR', text: line });
    }
  }

  return segments;
}

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
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${noteTypeMeta.badgeClass}`}
              >
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
          {currentTab === 'note' && <NotePageContent note={note} />}
          {currentTab === 'flashcards' && <FlashcardsContent note={note} />}
          {currentTab === 'quizzes' && <QuizzesContent note={note} />}
          {currentTab === 'podcast' && <PodcastContent note={note} />}
        </div>
      </div>
    </div>
  );
}

function NotePageContent({ note }: { note: Note }) {
  const router = useRouter();
  const { updateNote } = useNote();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState(note.generatedNotes || '');
  const [manualContent, setManualContent] = useState(note.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [noteStyle, setNoteStyle] = useState('concise');
  const [noteLength, setNoteLength] = useState('medium');
  const parsedSections = generatedNotes ? parseStructuredNotes(generatedNotes) : [];

  useEffect(() => {
    setGeneratedNotes(note.generatedNotes || '');
    setManualContent(note.content || '');
  }, [note.id, note.generatedNotes, note.content]);

  const hasSourceContent = note.content && note.content.trim().length > 0;
  const showEditor = !hasSourceContent && note.type === 'document';

  const saveManualContent = () => {
    updateNote(note.id, { content: manualContent, lastOpened: 'Just now' });
    setIsEditing(false);
    toast({
      title: 'Content saved',
      description: 'Your notes have been saved.',
    });
  };

  const exportToPDF = async () => {
    const contentToExport = generatedNotes || manualContent;
    if (!contentToExport) {
      toast({
        title: 'No content to export',
        description: 'Generate notes or write content first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create a simple HTML for PDF generation
      const htmlContent = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1e293b; font-size: 24px; }
            h2 { color: #334155; font-size: 18px; margin-top: 20px; }
            p, li { color: #475569; font-size: 14px; line-height: 1.6; }
            ul { padding-left: 20px; }
          </style>
        </head>
        <body>
          <h1>${note.title}</h1>
          <p><strong>Subject:</strong> ${note.subject}</p>
          <hr/>
          ${stripAiMarkdown(contentToExport).replace(/\n/g, '<br/>')}
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('[app] PDF export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export to PDF.',
        variant: 'destructive',
      });
    }
  };

  const exportToDOCX = async () => {
    const contentToExport = generatedNotes || manualContent;
    if (!contentToExport) {
      toast({
        title: 'No content to export',
        description: 'Generate notes or write content first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create a simple HTML that can be opened as .doc
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${note.title}</title></head>
        <body>
          <h1>${note.title}</h1>
          <p><strong>Subject:</strong> ${note.subject}</p>
          <hr/>
          <pre style='font-family: Arial, sans-serif; font-size: 12pt; white-space: pre-wrap;'>
${stripAiMarkdown(contentToExport)}
          </pre>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Exported',
        description: 'Document exported to DOCX.',
      });
    } catch (error) {
      console.error('[app] DOCX export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export to DOCX.',
        variant: 'destructive',
      });
    }
  };

  const generateNotes = async () => {
    const contentSource = note.content || manualContent;
    if (!contentSource || !contentSource.trim()) {
      toast({
        title: 'No content',
        description: 'Write some content or upload a file first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('[app] Generating notes for:', note.title);
      const response = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentSource,
          title: note.title,
          fileType: note.type,
          noteType: noteLength === 'short' && noteStyle !== 'detailed' ? 'short' : 'detailed',
          subject: note.subject,
          style: noteStyle,
          length: noteLength,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const generated = typeof data.notes === 'string' ? data.notes.trim() : '';

      if (!generated) {
        const source = stripAiMarkdown(note.content || manualContent || '').slice(0, 1400);
        const fallback = [
          'TOPIC SNAPSHOT:',
          source
            ? source.slice(0, 260)
            : 'Summary not available from source.',
          '',
          'HIGH-YIELD POINTS:',
          source
            ? `1. ${source.slice(0, 180)}${source.length > 180 ? '...' : ''}`
            : '1. Source content is too limited for extraction.',
          source
            ? `2. ${source.slice(180, 360) || source.slice(0, 140)}${source.length > 360 ? '...' : ''}`
            : '2. Add more source content for better note quality.',
          '',
          'STRUCTURE / FLOW:',
          '1. Not explicitly structured in source.',
          '',
          'COMMON CONFUSIONS:',
          '1. Source does not explicitly list confusion points.',
          '',
          'QUICK RECAP:',
          '1. Re-read the key ideas and terms from the source.',
        ].join('\n');
        setGeneratedNotes(fallback);
        updateNote(note.id, { generatedNotes: fallback, lastOpened: 'Just now' });
        throw new Error((typeof data.error === 'string' && data.error) || 'Failed to generate notes');
      }

      console.log('[app] Notes generated successfully');
      if (!response.ok) {
        console.warn('[app] Notes API returned non-200 with fallback notes:', data.error);
      }
      if (typeof data.warning === 'string' && data.warning) {
        console.warn('[app] Notes warning:', data.warning);
      }

      setGeneratedNotes(generated);
      updateNote(note.id, { generatedNotes: generated, lastOpened: 'Just now' });
    } catch (error) {
      console.error('[app] Generate notes error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generateNotes}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isLoading ? 'Generating...' : generatedNotes ? 'Regenerate' : 'Generate Notes'}
          </button>
          {(generatedNotes || manualContent) && (
            <>
              <button
                onClick={exportToPDF}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
              <button
                onClick={exportToDOCX}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500"
              >
                <Download className="h-3 w-3" /> DOCX
              </button>
            </>
          )}
        </div>
      </div>

      {/* Manual Content Editor for Blank Documents */}
      {showEditor && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your Notes</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setManualContent(note.content || '');
                    setIsEditing(false);
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={saveManualContent}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save
                </button>
              </div>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              placeholder="Write your notes here..."
              className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
            />
          ) : manualContent ? (
            <div className="min-h-[150px] rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-sm whitespace-pre-wrap text-zinc-300">
              {manualContent}
            </div>
          ) : (
            <div className="min-h-[100px] rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
              Write your notes. Click "Edit" to begin.
            </div>
          )}
        </div>
      )}

      {/* AI Generated Notes - Visual Style Display */}
      {generatedNotes ? (
        parsedSections.length >= 2 ? (
          <div className="rounded-lg border border-green-950/40 bg-green-950/10 p-4">
            <h4 className="font-bold uppercase tracking-[0.15em] text-emerald-400 text-xs mb-3">TOPIC SNAPSHOT</h4>
            <div className="text-[10px] text-zinc-400 space-y-2">
              {generatedNotes.split('\n').filter(l => l.trim()).slice(0, 15).map((line, i) => (
                <p key={i} className="leading-relaxed">{line.replace(/^\d+[\.\)]\s*/, '').replace(/^[A-Z\s]+:$/i, '')}</p>
              ))}
            </div>
            <button
              onClick={() => router.push(`/note/${note.id}/full`)}
              className="mt-3 text-[10px] text-emerald-400 hover:text-green-300 transition-colors"
            >
              Read more →
            </button>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-300">
            {stripAiMarkdown(generatedNotes)}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
          Click "Generate" to create AI notes.
        </div>
      )}
    </div>
  );
}

function ChatTutorContent({ note }: { note: Note }) {
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
      console.log('[app] Sending chat request:', {
        title: note.title,
        hasContext: Boolean(contextForChat),
        historyItems: historyForRequest.length,
      });
      
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
      console.log('[app] Chat response:', data);
      
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

function FlashcardsContent({ note }: { note: Note }) {
  // Use content directly OR fall back to generatedNotes
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
    
    // Always generate initial flashcards - even with empty content
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
        } else if (isActive) {
          // Silent fallback to local cards
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
    return () => {
      isActive = false;
    };
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

function QuizzesContent({ note }: { note: Note }) {
  // Use content directly OR fall back to generatedNotes
  const rawContent = note.content || note.generatedNotes || '';
  const sourceContent = rawContent.trim();
  const targetCount = estimateStudyItemCount(note, sourceContent);
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);

  console.log('[app] Quiz - note id:', note.id, 'content length:', note.content?.length, 'generatedNotes length:', note.generatedNotes?.length, 'sourceContent:', sourceContent?.slice(0, 50));

  useEffect(() => {
    let isActive = true;

    // Even if no content, generate local fallback if there's any note
    const loadQuestions = async () => {
      setIsLoading(true);
      console.log('[app] Quiz loading for note:', note.title, 'source length:', sourceContent.length);
      
      try {
        // If we have source content, try AI first
        if (sourceContent.length > 50) {
          console.log('[app] Fetching quiz from API with content length:', sourceContent.length);
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
            console.log('[app] Quiz API response:', { count: data.questions?.length });
            
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
        
        // Generate local fallback - always use note title as content
        console.log('[app] Generating local quiz fallback...');
        const fallbackContent = sourceContent.length > 20 ? sourceContent : `Study topic: ${note.title}`;
        const fallback = generateQuizQuestions(fallbackContent, note.title, targetCount);
        setQuestions(fallback);
        setAnswers(new Array(fallback.length).fill(null));
        setCurrent(0);
        setCompleted(false);
        // Silent fallback - don't show error when local works
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

  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [selfScore, setSelfScore] = useState<Record<number, boolean>>({});

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
    ? { core: '💡 Core Understanding', process: '⚙️ Process / Mechanism', application: '🔧 Application', confusion: '🔍 Confusion Test', edge: '🧠 Deep Thinking' }[questions[current].type]
    : '📝 Question';

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
            onClick={() => {
              setRevealed((prev) => ({ ...prev, [current]: true }));
            }}
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
                ✓ Got it
              </button>
              <button
                onClick={() => setSelfScore((prev) => ({ ...prev, [current]: false }))}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selfScore[current] === false
                    ? 'bg-rose-600 text-white'
                    : 'border border-zinc-700 text-zinc-400 hover:border-rose-600 hover:text-rose-400'
                }`}
              >
                ✗ Need review
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

function PodcastContent({ note }: { note: Note }) {
  const { toast } = useToast();
  const sourceContent = note.content?.trim() ? note.content : (note.generatedNotes || '');
  const hasOriginalAudio = Boolean(note.fileUrl && note.fileMimeType?.startsWith('audio/'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState('English');
  const [speaker, setSpeaker] = useState('Default');
  const [isPlaying, setIsPlaying] = useState(false);
  const [podcastScript, setPodcastScript] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');
  const [generatedAudioExt, setGeneratedAudioExt] = useState<'wav' | 'mp3' | 'ogg'>('wav');
  const [isRenderingAudio, setIsRenderingAudio] = useState(false);
  const playbackTokenRef = useRef(0);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      playbackTokenRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);

  // Map language to speech synthesis language code
  const getLangCode = (lang: string) => {
    const map: Record<string, string> = {
      'English': 'en-US', 'Spanish': 'es-ES', 'French': 'fr-FR',
      'German': 'de-DE', 'Italian': 'it-IT', 'Portuguese': 'pt-BR',
      'Chinese': 'zh-CN', 'Japanese': 'ja-JP', 'Korean': 'ko-KR'
    };
    return map[lang] || 'en-US';
  };

  // Get voice rate based on speaker style
  const getVoiceSettings = (style: string) => {
    const settings: Record<string, { rate: number; pitch: number }> = {
      'Default': { rate: 1, pitch: 1 },
      'Professional': { rate: 0.9, pitch: 1 },
      'Casual': { rate: 1.1, pitch: 1.1 },
      'Academic': { rate: 0.8, pitch: 0.9 },
      'Enthusiastic': { rate: 1.1, pitch: 1.2 }
    };
    return settings[style] || { rate: 1, pitch: 1 };
  };

  const getRoleVoice = (
    voices: SpeechSynthesisVoice[],
    langCode: string,
    role: PodcastRole
  ): SpeechSynthesisVoice | undefined => {
    const baseLang = langCode.split('-')[0].toLowerCase();
    const matchingLang = voices.filter((voice) => voice.lang.toLowerCase().startsWith(baseLang));
    if (matchingLang.length === 0) return undefined;

    const femaleHints = ['female', 'woman', 'girl', 'jenny', 'aria', 'samantha', 'zira', 'emma', 'amy', 'ava', 'serena', 'sara', 'katja', 'elvira', 'nanami'];
    const maleHints = ['male', 'man', 'boy', 'alex', 'david', 'guy', 'daniel', 'tom', 'george', 'liam', 'brian', 'ryan', 'matthew', 'james'];
    const hints = role === 'VOICE_A' ? maleHints : role === 'VOICE_B' ? femaleHints : [];
    const qualityHints = ['google', 'microsoft', 'natural', 'neural', 'enhanced', 'premium', 'studio'];

    const scoreVoice = (voice: SpeechSynthesisVoice) => {
      const name = voice.name.toLowerCase();
      const qualityScore = qualityHints.reduce((acc, hint) => acc + (name.includes(hint) ? 1 : 0), 0);
      const roleScore = hints.reduce((acc, hint) => acc + (name.includes(hint) ? 1 : 0), 0);
      return (qualityScore * 10) + roleScore;
    };

    const sorted = [...matchingLang].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const hinted = sorted.find((voice) => {
      const name = voice.name.toLowerCase();
      return hints.some((hint) => name.includes(hint));
    });

    return hinted || sorted[0];
  };

  const handleGenerate = async () => {
    if (!sourceContent) {
      toast({
        title: 'No source content',
        description: 'Generate notes or upload source content first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setError('');
    setWarning('');
    setGeneratedAudioUrl('');
    setGeneratedAudioExt('wav');
    try {
      const script = buildSmartPodcastScript(sourceContent, note.title);
      setPodcastScript(script);
      setWarning('');
    } catch (error) {
      console.error('[app] Podcast generation error:', error);
      setPodcastScript(sourceContent);
      setError('Using your source text for podcast narration.');
      setWarning('');
    } finally {
      setIsGenerating(false);
    }
  };

  const chunkSpeechText = (value: string): string[] => {
    const sentences = value
      .split(/(?<=[.!?])\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const chunks: string[] = [];

    for (const sentence of sentences) {
      const parts = sentence.length > 220 ? sentence.split(/[,;:]\s+/) : [sentence];
      for (const part of parts) {
        const cleanedPart = part.trim();
        if (!cleanedPart) continue;

        if (cleanedPart.length > 220) {
          const words = cleanedPart.split(/\s+/);
          let rolling = '';
          for (const word of words) {
            if (!word) continue;
            if (!rolling || rolling.length + word.length + 1 <= 220) {
              rolling = rolling ? `${rolling} ${word}` : word;
            } else {
              chunks.push(rolling);
              rolling = word;
            }
          }
          if (rolling) chunks.push(rolling);
          continue;
        }

        const lastIndex = chunks.length - 1;
        if (lastIndex >= 0 && chunks[lastIndex].length + cleanedPart.length + 1 <= 220) {
          chunks[lastIndex] = `${chunks[lastIndex]} ${cleanedPart}`;
        } else {
          chunks.push(cleanedPart);
        }
      }
    }

    return chunks.filter(Boolean);
  };

  const speakChunk = (
    chunk: string,
    langCode: string,
    voiceSettings: { rate: number; pitch: number },
    preferredVoice: SpeechSynthesisVoice | undefined,
    token: number
  ): Promise<'ended' | 'interrupted' | 'failed'> =>
    new Promise((resolve) => {
      if (!('speechSynthesis' in window) || token !== playbackTokenRef.current) {
        resolve('interrupted');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      activeUtteranceRef.current = utterance;
      utterance.lang = langCode;
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        resolve('ended');
      };

      utterance.onerror = (event) => {
        const errorType = event.error || 'unknown';
        if (errorType === 'interrupted' || errorType === 'canceled' || token !== playbackTokenRef.current) {
          resolve('interrupted');
          return;
        }
        console.error('[app] Speech synthesis error:', errorType);
        setError(`Speech playback failed (${errorType}). Try a different voice/language or Chrome.`);
        resolve('failed');
      };

      window.speechSynthesis.speak(utterance);
    });

  const requestServerAudio = async (scriptTextRaw: string): Promise<string> => {
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: scriptTextRaw,
        language,
        speaker,
      }),
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({ error: 'Audio generation failed.' }));
      const messageParts = [payload.error, payload.details].filter((part) => typeof part === 'string' && part.trim());
      throw new Error(messageParts.length > 0 ? messageParts.join(' ') : 'Audio generation failed.');
    }

    const audioBlob = await response.blob();
    if (audioBlob.size < 512 || !audioBlob.type.startsWith('audio/')) {
      throw new Error('Server returned an invalid audio payload.');
    }

    if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
      setGeneratedAudioExt('mp3');
    } else if (audioBlob.type.includes('ogg')) {
      setGeneratedAudioExt('ogg');
    } else {
      setGeneratedAudioExt('wav');
    }

    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
    }
    const nextUrl = URL.createObjectURL(audioBlob);
    setGeneratedAudioUrl(nextUrl);
    return nextUrl;
  };

  // Prefer server TTS playback, fallback to Web Speech API if needed
  const handlePlay = async () => {
    setError('');
    const textToSpeakRaw = stripAiMarkdown(podcastScript || sourceContent);
    const textToSpeak = textToSpeakRaw.length > 14000 ? `${textToSpeakRaw.slice(0, 14000)}...` : textToSpeakRaw;
    if (!textToSpeak) {
      toast({
        title: 'No script content',
        description: 'Generate a podcast script before playback.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const audioUrl = await requestServerAudio(textToSpeak);
      window.speechSynthesis?.cancel();
      activeUtteranceRef.current = null;
      playbackTokenRef.current += 1;
      // Server voice warning removed
      setIsPlaying(true);
      window.setTimeout(() => {
        const el = generatedAudioRef.current;
        if (!el) {
          setIsPlaying(false);
          return;
        }
        if (el.src !== audioUrl) {
          el.src = audioUrl;
        }
        el.currentTime = 0;
        void el.play().catch((playError) => {
          // AbortError is expected when playback is stopped by user
          const errorMessage = playError instanceof Error ? playError.name : String(playError);
          if (errorMessage === 'AbortError' || errorMessage === 'NotAllowedError') {
            // User interrupted playback, this is expected behavior
            setIsPlaying(false);
            return;
          }
          console.error('[app] Audio element play failed:', playError);
          setIsPlaying(false);
        });
      }, 50);
      return;
    } catch (serverAudioError) {
      const message = serverAudioError instanceof Error ? serverAudioError.message : String(serverAudioError);
      console.warn('[app] Server playback fallback to browser TTS:', message);
      setWarning('Server voice unavailable right now; using browser voice.');
    }

    if (!('speechSynthesis' in window)) {
      toast({
        title: 'Text-to-speech unavailable',
        description: 'Your browser does not support speech synthesis.',
        variant: 'destructive',
      });
      return;
    }

    const dialogueSegments = extractDialogueSegments(textToSpeak);
    const chunksWithSpeaker = dialogueSegments.flatMap((segment) =>
      chunkSpeechText(segment.text).map((chunk) => ({
        speaker: segment.speaker,
        text: chunk,
      }))
    );

    if (chunksWithSpeaker.length === 0) {
      toast({
        title: 'Invalid speech content',
        description: 'No valid text chunks found for playback.',
        variant: 'destructive',
      });
      return;
    }

    playbackTokenRef.current += 1;
    const token = playbackTokenRef.current;
    window.speechSynthesis.cancel();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (token !== playbackTokenRef.current) {
      return;
    }

    const langCode = getLangCode(language);
    const voiceSettings = getVoiceSettings(speaker);
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => resolve(), 600);
        const handler = () => {
          window.clearTimeout(timer);
          resolve();
        };
        window.speechSynthesis.onvoiceschanged = handler;
      });
      voices = window.speechSynthesis.getVoices();
    }

    const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(langCode.split('-')[0].toLowerCase()));
    const voiceA = getRoleVoice(voices, langCode, 'VOICE_A') || preferredVoice;
    const voiceB = getRoleVoice(voices, langCode, 'VOICE_B') || preferredVoice;
    setIsPlaying(true);

    let hasRetriedInterrupted = false;
    for (const segment of chunksWithSpeaker) {
      if (token !== playbackTokenRef.current) break;

      const roleVoice = segment.speaker === 'VOICE_A' ? voiceA : segment.speaker === 'VOICE_B' ? voiceB : preferredVoice;
      const roleSettings = segment.speaker === 'VOICE_A'
        ? { ...voiceSettings, rate: Math.max(0.85, voiceSettings.rate - 0.03), pitch: Math.min(1.15, voiceSettings.pitch + 0.03) }
        : segment.speaker === 'VOICE_B'
          ? { ...voiceSettings, rate: Math.max(0.85, voiceSettings.rate - 0.02), pitch: Math.max(0.9, voiceSettings.pitch - 0.03) }
          : voiceSettings;
      const result = await speakChunk(segment.text, langCode, roleSettings, roleVoice, token);
      if (result === 'ended') {
        continue;
      }

      if (result === 'interrupted' && !hasRetriedInterrupted && token === playbackTokenRef.current) {
        hasRetriedInterrupted = true;
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        const retryResult = await speakChunk(segment.text, langCode, roleSettings, roleVoice, token);
        if (retryResult === 'ended') {
          continue;
        }
      }

      if (result === 'interrupted' && token === playbackTokenRef.current) {
        setError('Speech playback was interrupted. Press Play again or try Chrome/Edge.');
      }
      break;
    }

    if (token === playbackTokenRef.current) {
      activeUtteranceRef.current = null;
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    playbackTokenRef.current += 1;
    activeUtteranceRef.current = null;
    window.speechSynthesis?.cancel();
    if (generatedAudioRef.current) {
      generatedAudioRef.current.pause();
      generatedAudioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handleGenerateAudioFile = async () => {
    const scriptTextRaw = stripAiMarkdown(podcastScript || sourceContent);
    if (!scriptTextRaw) {
      setError('No script text available to generate audio.');
      return;
    }

    setIsRenderingAudio(true);
    setError('');
    try {
      if (/^VOICE\s*A:|^VOICE\s*B:|^EMMA:|^ALEX:/mi.test(scriptTextRaw)) {
        setWarning('Saved file currently uses one server voice. Live Play uses male/female panel voices.');
      }
      await requestServerAudio(scriptTextRaw);
    } catch (audioError) {
      console.error('[app] Server TTS generation error:', audioError);
      setError(
        audioError instanceof Error
          ? `Audio file generation failed: ${audioError.message}`
          : 'Audio file generation failed.'
      );
    } finally {
      setIsRenderingAudio(false);
    }
  };

  const hasContent = sourceContent || podcastScript;

  if (!hasContent) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
        <p>No source content. Upload a file or generate notes first.</p>
      </div>
    );
  }

  if (podcastScript) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">{isPlaying ? 'Playing...' : 'Ready'}</span>
            <span className="text-xs text-zinc-500">{language}/{speaker}</span>
          </div>

          <div className="flex gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-3 py-2 text-xs font-medium text-white"
              >
                <Play className="mr-1 inline h-3 w-3" /> Play
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white"
              >
                <Square className="mr-1 inline h-3 w-3" /> Stop
              </button>
            )}
            <button
              onClick={handleGenerateAudioFile}
              disabled={isRenderingAudio}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 disabled:opacity-50"
            >
              <Download className="inline h-3 w-3" /> {isRenderingAudio ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Podcast script content hidden */}
        {/* <div className="max-h-[300px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-xs whitespace-pre-wrap text-zinc-400">
          {stripAiMarkdown(podcastScript).slice(0, 2000)}
        </div> */}

        {warning && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-300">{warning}</p>}

        {generatedAudioUrl && (
          <audio
            ref={generatedAudioRef}
            controls
            className="w-full"
            src={generatedAudioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              // Handle AbortError gracefully - this is expected when user stops playback
              const audioElement = e.target as HTMLAudioElement;
              if (audioElement.error?.code === MediaError.MEDIA_ERR_ABORTED) {
                // User aborted playback, this is expected behavior
                setIsPlaying(false);
                return;
              }
              console.error('[app] Audio element error:', audioElement.error);
              setIsPlaying(false);
              setError('Audio playback failed. Please try again.');
            }}
          >
            Your browser does not support audio.
          </audio>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300"
        >
          <option>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
        </select>
        <select
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300"
        >
          <option>Default</option>
          <option>Professional</option>
          <option>Casual</option>
          <option>Academic</option>
        </select>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !sourceContent}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-500"
      >
        {isGenerating ? 'Generating...' : 'Generate Podcast'}
      </button>

      {warning && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-300">{warning}</p>}
      {error && <p className="rounded border border-rose-800 bg-rose-900/20 px-2 py-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
