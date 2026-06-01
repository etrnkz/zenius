'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useNote } from '@/lib/note-context';
import { useToast } from '@/hooks/use-toast';

export function CreateBlankDocumentDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addNote } = useNote();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title before creating a document.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      addNote({
        id: Date.now().toString(),
        title,
        subject: subject || 'Untitled',
        content: '',
        type: 'document',
        createdAt: new Date().toISOString(),
        lastOpened: 'Just now',
      });
      toast({ title: 'Document created', description: `"${title}" is ready in your dashboard.` });
      setTitle('');
      setSubject('');
      onClose();
    } catch (error) {
      console.error('[app] Create document error:', error);
      toast({ title: 'Create failed', description: 'Failed to create the document. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border-[0.6px] border-white/15 bg-black sm:my-0 sm:max-h-[calc(100vh-2rem)]">
        <div className="border-b border-[0.6px] border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-zinc-100">Create Blank Document</h2>
              <p className="mt-1 text-xs text-zinc-400">Start a fresh workspace and generate study assets later.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border-[0.6px] border-white/15 bg-zinc-/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">New</span>
              <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-zinc-200"><X className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Document Title</label>
            <input type="text" placeholder="Enter title..." value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-white/35"
              disabled={isLoading} />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Subject (Optional)</label>
            <input type="text" placeholder="e.g., Computer Science" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-white/35"
              disabled={isLoading} />
          </div>

          <div className="flex flex-col gap-2.5 pt-4 sm:flex-row">
            <button onClick={onClose} disabled={isLoading}
              className="flex-1 rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-zinc-/[0.05] disabled:opacity-50"
            >Cancel</button>
            <button onClick={handleCreate} disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[0.6px] border-white/15 bg-zinc-/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-100 transition-colors hover:bg-zinc-/[0.08] disabled:opacity-50"
            >{isLoading && <Loader2 className="w-4 h-4 animate-spin" />}Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
