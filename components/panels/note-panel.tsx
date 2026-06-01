'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Download } from 'lucide-react';
import { useNote } from '@/lib/note-context';
import type { Note } from '@/lib/note-context';
import { useToast } from '@/hooks/use-toast';

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

export function NotePanel({ note }: { note: Note }) {
  const router = useRouter();
  const { updateNote } = useNote();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState(note.generatedNotes || '');
  const [manualContent, setManualContent] = useState(note.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [noteStyle] = useState('concise');
  const [noteLength] = useState('medium');
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
    toast({ title: 'Content saved', description: 'Your notes have been saved.' });
  };

  const exportToPDF = async () => {
    const contentToExport = generatedNotes || manualContent;
    if (!contentToExport) {
      toast({ title: 'No content to export', description: 'Generate notes or write content first.', variant: 'destructive' });
      return;
    }

    try {
      const htmlContent = `
        <html><head><style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1e293b; font-size: 24px; }
          h2 { color: #334155; font-size: 18px; margin-top: 20px; }
          p, li { color: #475569; font-size: 14px; line-height: 1.6; }
          ul { padding-left: 20px; }
        </style></head><body>
          <h1>${note.title}</h1>
          <p><strong>Subject:</strong> ${note.subject}</p>
          <hr/>
          ${stripAiMarkdown(contentToExport).replace(/\n/g, '<br/>')}
        </body></html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('[app] PDF export error:', error);
      toast({ title: 'Export failed', description: 'Could not export to PDF.', variant: 'destructive' });
    }
  };

  const exportToDOCX = async () => {
    const contentToExport = generatedNotes || manualContent;
    if (!contentToExport) {
      toast({ title: 'No content to export', description: 'Generate notes or write content first.', variant: 'destructive' });
      return;
    }

    try {
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
        </body></html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Exported', description: 'Document exported to DOCX.' });
    } catch (error) {
      console.error('[app] DOCX export error:', error);
      toast({ title: 'Export failed', description: 'Could not export to DOCX.', variant: 'destructive' });
    }
  };

  const generateNotes = async () => {
    const contentSource = note.content || manualContent;
    if (!contentSource || !contentSource.trim()) {
      toast({ title: 'No content', description: 'Write some content or upload a file first.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
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
          'TOPIC SNAPSHOT:', source ? source.slice(0, 260) : 'Summary not available from source.',
          '', 'HIGH-YIELD POINTS:',
          source ? `1. ${source.slice(0, 180)}${source.length > 180 ? '...' : ''}` : '1. Source content is too limited for extraction.',
          source ? `2. ${source.slice(180, 360) || source.slice(0, 140)}${source.length > 360 ? '...' : ''}` : '2. Add more source content for better note quality.',
          '', 'STRUCTURE / FLOW:', '1. Not explicitly structured in source.',
          '', 'COMMON CONFUSIONS:', '1. Source does not explicitly list confusion points.',
          '', 'QUICK RECAP:', '1. Re-read the key ideas and terms from the source.',
        ].join('\n');
        setGeneratedNotes(fallback);
        updateNote(note.id, { generatedNotes: fallback, lastOpened: 'Just now' });
        throw new Error((typeof data.error === 'string' && data.error) || 'Failed to generate notes');
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
          <button onClick={generateNotes} disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isLoading ? 'Generating...' : generatedNotes ? 'Regenerate' : 'Generate Notes'}
          </button>
          {(generatedNotes || manualContent) && (
            <>
              <button onClick={exportToPDF} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500">
                <Download className="h-3 w-3" /> PDF
              </button>
              <button onClick={exportToDOCX} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500">
                <Download className="h-3 w-3" /> DOCX
              </button>
            </>
          )}
        </div>
      </div>

      {showEditor && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your Notes</h3>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Edit</button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => { setManualContent(note.content || ''); setIsEditing(false); }} className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white">Cancel</button>
                <button onClick={saveManualContent} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Save</button>
              </div>
            )}
          </div>
          {isEditing ? (
            <textarea value={manualContent} onChange={(e) => setManualContent(e.target.value)}
              placeholder="Write your notes here..."
              className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500"
            />
          ) : manualContent ? (
            <div className="min-h-[150px] rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-sm whitespace-pre-wrap text-zinc-300">{manualContent}</div>
          ) : (
            <div className="min-h-[100px] rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">Write your notes. Click "Edit" to begin.</div>
          )}
        </div>
      )}

      {generatedNotes ? (
        parsedSections.length >= 2 ? (
          <div className="rounded-lg border border-green-950/40 bg-green-950/10 p-4">
            <h4 className="font-bold uppercase tracking-[0.15em] text-emerald-400 text-xs mb-3">TOPIC SNAPSHOT</h4>
            <div className="text-[10px] text-zinc-400 space-y-2">
              {generatedNotes.split('\n').filter(l => l.trim()).slice(0, 15).map((line, i) => (
                <p key={i} className="leading-relaxed">{line.replace(/^\d+[\.\)]\s*/, '').replace(/^[A-Z\s]+:$/i, '')}</p>
              ))}
            </div>
            <button onClick={() => router.push(`/note/${note.id}/full`)} className="mt-3 text-[10px] text-emerald-400 hover:text-green-300 transition-colors">Read more →</button>
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
