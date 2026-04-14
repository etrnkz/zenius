'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, SendHorizontal, AlertTriangle, Star, HelpCircle, CheckCircle, Lightbulb, MessageCircle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNote } from '@/lib/note-context';

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

const SECTION_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  'TOPIC SNAPSHOT': { icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-900/40' },
  'KEY TERMS': { icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-900/40' },
  'MAIN CONCEPTS': { icon: Star, color: 'text-blue-400', bg: 'bg-blue-950/20 border-blue-900/40' },
  'DETAILED EXPLANATIONS': { icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-950/20 border-cyan-900/40' },
  'EXAMPLES': { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-900/40' },
  'COMMON CONFUSIONS': { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-950/20 border-red-900/40' },
  'QUICK RECAP': { icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-900/40' },
  'SUMMARY': { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-900/40' },
  'QUIZ PREP': { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-950/20 border-purple-900/40' },
};

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { notes } = useNote();
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<Array<{ title: string; items: string[] }>>([]);
  
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const noteId = params.id as string;
    const sectionParam = params.section as string;
    
    if (!noteId || !sectionParam) {
      router.push('/');
      return;
    }

    const note = notes.find((n) => n.id === noteId);
    if (!note) {
      router.push('/');
      return;
    }

    setNoteTitle(note.title);
    setNoteContent(note.content || note.generatedNotes || '');

    const sourceText = note.generatedNotes || note.content || '';
    const cleanedText = stripAiMarkdown(sourceText);
    
    if (!cleanedText) {
      setIsLoading(false);
      return;
    }

    const lines = cleanedText.split('\n').map((line) => line.trim()).filter(Boolean);
    const parsed: Array<{ title: string; items: string[] }> = [];
    let current: { title: string; items: string[] } | null = null;

    for (const rawLine of lines) {
      const normalizedLine = rawLine.replace(/\s+/g, ' ').trim();
      const headingMatch = normalizedLine.match(/^([A-Z][A-Z\s]+):?$/);
      if (headingMatch) {
        if (current) parsed.push(current);
        current = { title: headingMatch[1].trim(), items: [] };
        continue;
      }
      if (current) {
        const cleaned = normalizedLine.replace(/^\d+[\.\)]\s*/, '').trim();
        if (cleaned && cleaned.length > 3) current.items.push(cleaned);
      }
    }

    if (current) parsed.push(current);
    setSections(parsed);
    setIsLoading(false);
  }, [params, notes, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleBack = () => {
    router.push('/');
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const contextForChat = noteContent.length > 10 ? noteContent.substring(0, 12000) : '';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          context: contextForChat,
          noteTitle: noteTitle,
          history: [...chatMessages.slice(-7), userMessage],
        }),
      });

      const data = await response.json().catch(() => ({}));
      const assistantMessage = { 
        role: 'assistant', 
        content: data?.response || data?.message || 'I apologize, but I could not generate a response. Please try again.' 
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[app] Chat error:', error);
      setChatMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      {/* Header - Fixed */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-auto w-full flex-col sm:flex-row sm:h-14 sm:items-center sm:justify-between px-4 py-3 sm:py-0 gap-2 sm:gap-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {noteTitle}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable (Notes + Chat) */}
      <main ref={contentRef} className="flex-1 overflow-y-auto pb-36">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {isLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <div className="animate-pulse text-zinc-500">Loading...</div>
            </div>
          ) : sections.length > 0 ? (
            <div className="space-y-6">
              {sections.map((section, idx) => {
                const config = SECTION_CONFIG[section.title] || { icon: Sparkles, color: 'text-zinc-300', bg: 'bg-zinc-900/40 border-zinc-800' };
                const IconComponent = config.icon;
                
                return (
                  <div key={idx} className={`rounded-lg border p-4 ${config.bg}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconComponent className={`h-4 w-4 ${config.color}`} />
                      <h2 className={`text-sm font-bold uppercase tracking-[0.15em] ${config.color}`}>
                        {section.title}
                      </h2>
                    </div>
                    
                    <div className="space-y-2">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <span className={`${config.color} mt-1`}>→</span>
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
              <p className="text-sm">No content available. Try generating notes first.</p>
            </div>
          )}

          {/* Soft divider with Chat section - appears after notes */}
          {chatMessages.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-zinc-800"></div>
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-emerald-500 font-medium">Conversation</span>
                <div className="h-px flex-1 bg-zinc-800"></div>
              </div>

              <div className="space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? stripAiMarkdown(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="text-xs text-emerald-400 py-2">
                    Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          </div>
      </main>

      {/* Fixed Chat Input at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-zinc-800 p-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              placeholder="Ask about this topic..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && handleChatSend()}
              disabled={isChatLoading}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
            />
            <button
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-500 transition-colors"
            >
              <SendHorizontal className="h-3 w-3" />
            </button>
          </div>
          <div className="text-center text-[10px] text-zinc-600 mt-2">
            Generated by Zenius
          </div>
        </div>
      </div>
    </div>
  );
}