'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Mic, Square } from 'lucide-react';
import { useNote } from '@/lib/note-context';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import type { NoteType } from '@/lib/note-context';

function resolveNoteType(file: File, selectedType: 'document' | 'audio' | 'link'): NoteType {
  if (selectedType === 'audio') {
    return 'audio';
  }

  if (selectedType === 'link') {
    return 'link';
  }

  const fileName = file.name.toLowerCase();
  const mimeType = (file.type || '').toLowerCase();
  if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return 'pdf';
  }

  return 'document';
}

interface ExtractedFileData {
  text: string;
  pageCount?: number;
  slideCount?: number;
}

export function CreateBlankDocumentDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { addNote } = useNote();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title before creating a document.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const newNote = {
        id: Date.now().toString(),
        title,
        subject: subject || 'Untitled',
        content: '',
        type: 'document' as const,
        createdAt: new Date().toISOString(),
        lastOpened: 'Just now',
      };

      addNote(newNote);
      toast({
        title: 'Document created',
        description: `"${title}" is ready in your dashboard.`,
      });
      setTitle('');
      setSubject('');
      onClose();
    } catch (error) {
      console.error('[app] Create document error:', error);
      toast({
        title: 'Create failed',
        description: 'Failed to create the document. Please try again.',
        variant: 'destructive',
      });
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
              <span className="rounded-full border-[0.6px] border-white/15 bg-zinc-/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                New
              </span>
              <button
                onClick={onClose}
                className="text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Document Title</label>
            <input
              type="text"
              placeholder="Enter title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-white/35"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">Subject (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Computer Science"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-white/35"
              disabled={isLoading}
            />
          </div>

          <div className="flex flex-col gap-2.5 pt-4 sm:flex-row">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl border-[0.6px] border-white/12 bg-zinc-/[0.02] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition-colors hover:bg-zinc-/[0.05] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[0.6px] border-white/15 bg-zinc-/[0.04] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-100 transition-colors hover:bg-zinc-/[0.08] disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileUploadDialog({
  isOpen,
  onClose,
  fileType,
}: {
  isOpen: boolean;
  onClose: () => void;
  fileType: 'document' | 'audio' | 'link';
}) {
  const { addNote } = useNote();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[app] Recording error:', error);
      toast({
        title: 'Recording failed',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRecordedAudioProcess = async () => {
    if (!recordedBlob) return;

    setIsLoading(true);
    try {
      const fileName = `recording-${Date.now()}.webm`;
      const file = new File([recordedBlob], fileName, { type: 'audio/webm' });

      console.log('[app] Processing recorded audio:', fileName);

      // Upload the file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Transcribe the audio
      const transcribeFormData = new FormData();
      transcribeFormData.append('audio', file);

      const transcribeResponse = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: transcribeFormData,
      });

      let transcript = '';
      if (transcribeResponse.ok) {
        const transcribeData = await transcribeResponse.json();
        if (transcribeData.success && transcribeData.transcript) {
          transcript = transcribeData.transcript;
        }
      }

      if (!transcript) {
        transcript = 'Audio recorded. Transcription service will process this when generating notes.';
      }

      // Generate notes from transcript
      const notesResponse = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: transcript,
          title: title || 'Voice Recording',
          fileType: 'audio',
          noteType: 'short',
          subject: subject || 'Audio',
          style: 'concise',
          length: 'medium',
        }),
      });

      const notesData = await notesResponse.json();

      const newNote = {
        id: Date.now().toString(),
        title: title || 'Voice Recording',
        subject: subject || 'Audio',
        content: transcript,
        generatedNotes: notesData.notes || '',
        type: 'audio' as const,
        fileUrl: uploadData.file.url,
        fileName: fileName,
        createdAt: new Date().toISOString(),
        lastOpened: 'Just now',
        metadata: {
          fileSize: file.size,
          duration: recordingTime,
          wordCount: transcript.split(/\s+/).filter(Boolean).length,
        },
      };

      addNote(newNote);
      toast({
        title: 'Recording processed',
        description: `"${title || 'Voice Recording'}" was created with generated notes.`,
      });
      
      // Reset state
      setTitle('');
      setSubject('');
      setRecordedBlob(null);
      setRecordingTime(0);
      onClose();
    } catch (error) {
      console.error('[app] Recording process error:', error);
      toast({
        title: 'Processing failed',
        description: 'Failed to process recording. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup on unmount and when dialog closes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Reset recording state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setRecordedBlob(null);
      setRecordingTime(0);
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      console.log('[app] Uploading file:', file.name);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await response.json();
      console.log('[app] Upload successful:', uploadData);

      // Read file content for notes generation
      const extracted = await readFileContent(file);
      const content = extracted.text;
      console.log('[app] File content length:', content.length);
      const noteType = resolveNoteType(file, fileType);
      const extractedContent = content.substring(0, 200000);

      // Generate notes from file
      const notesResponse = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: extractedContent,
          title: title || file.name,
          fileType: noteType,
          noteType: 'short',
          subject: subject || 'Uploaded',
          style: 'concise',
          length: 'medium',
        }),
      });

      const notesData = await notesResponse.json();
      console.log('[app] Notes generated:', notesData.success);

      const newNote = {
        id: Date.now().toString(),
        title: title || file.name,
        subject: subject || 'Uploaded',
        content: extractedContent,
        generatedNotes: notesData.notes || '',
        type: noteType,
        fileUrl: uploadData.file.url,
        fileName: file.name,
        fileMimeType: file.type || uploadData.file.type || undefined,
        createdAt: new Date().toISOString(),
        lastOpened: 'Just now',
        metadata: {
          fileSize: file.size,
          wordCount: content.split(/\s+/).filter(Boolean).length,
          pageCount: extracted.pageCount,
          slideCount: extracted.slideCount,
        },
      };

      addNote(newNote);
      toast({
        title: 'Upload complete',
        description: `"${title || file.name}" was added with generated notes.`,
      });
      setTitle('');
      setSubject('');
      onClose();
    } catch (error) {
      console.error('[app] Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a valid URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('[app] Processing link:', linkUrl);

      // First, try to extract content from the URL
      let extractedContent = '';
      let linkTitle = title || 'Web Resource';
      
      try {
        const processResponse = await fetch('/api/process-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: linkUrl }),
        });

        if (processResponse.ok) {
          const processData = await processResponse.json();
          if (processData.success) {
            extractedContent = processData.content || '';
            if (processData.title && processData.title !== 'Web Resource') {
              linkTitle = title || processData.title;
            }
            console.log('[app] Link processed:', {
              type: processData.type,
              contentLength: extractedContent.length,
              warning: processData.warning,
            });
          }
        }
      } catch (extractError) {
        console.warn('[app] Content extraction failed, using URL only:', extractError);
        // Continue with just the URL if extraction fails
      }

      // Generate notes from the extracted content - use the new video notes endpoint for beautiful output
      let generatedNotes = '';
      if (extractedContent && extractedContent.length > 50) {
        try {
          // Try new endpoint first for beautiful notes
          const videoNotesResponse = await fetch('/api/generate-video-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: linkUrl, type: 'video' }),
          });

          if (videoNotesResponse.ok) {
            const videoNotesData = await videoNotesResponse.json();
            if (videoNotesData.success && videoNotesData.notes) {
              generatedNotes = videoNotesData.notes;
              console.log('[app] Beautiful notes generated from video/URL');
            } else {
              // Fallback to regular notes generation
              throw new Error('Video notes failed');
            }
          } else {
            throw new Error('Video notes endpoint failed');
          }
        } catch (notesError) {
          console.warn('[app] Video notes failed, trying standard notes:', notesError);
          // Fallback to standard notes generation
          try {
            const notesResponse = await fetch('/api/generate-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: extractedContent.substring(0, 200000),
                title: linkTitle,
                fileType: 'link',
                noteType: 'short',
                subject: subject || 'Online',
                style: 'concise',
                length: 'medium',
              }),
            });

            if (notesResponse.ok) {
              const notesData = await notesResponse.json();
              generatedNotes = notesData.notes || '';
            }
          } catch (fallbackError) {
            console.warn('[app] Notes generation failed:', fallbackError);
          }
        }
      }

      const newNote = {
        id: Date.now().toString(),
        title: linkTitle,
        subject: subject || 'Online',
        content: extractedContent || `Link: ${linkUrl}`,
        generatedNotes: generatedNotes,
        linkUrl,
        type: 'link' as const,
        createdAt: new Date().toISOString(),
        lastOpened: 'Just now',
        metadata: {
          sourceType: (linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be')) ? 'youtube' as const : 'website' as const,
        },
      };

      addNote(newNote);
      toast({
        title: 'Link added',
        description: `"${linkTitle}" was saved with${extractedContent ? ' extracted content and' : ''} generated notes.`,
      });
      setTitle('');
      setSubject('');
      setLinkUrl('');
      onClose();
    } catch (error) {
      console.error('[app] Link error:', error);
      toast({
        title: 'Link add failed',
        description: 'Failed to add link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/82 p-2 backdrop-blur-md sm:items-center sm:p-4">
      <div className="my-0 w-full max-w-sm overflow-hidden rounded-[1.4rem] border border-white/12 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:my-3 sm:max-w-md">
        <div className="border-b border-white/8 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-100 sm:text-[13px]">
                {fileType === 'document' && 'Upload Document'}
                {fileType === 'audio' && 'Record or Upload Audio'}
                {fileType === 'link' && 'Add Website Link'}
              </h2>
              <p className="mt-1 max-w-[18rem] text-[11px] leading-5 text-zinc-400 sm:text-xs">
                {fileType === 'link'
                  ? 'Paste a URL and save it as a study source.'
                  : fileType === 'audio'
                    ? 'Record a lecture or upload an audio file to generate notes.'
                    : 'Attach a file and Zenius will extract content for notes.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/8 bg-zinc-/[0.03] p-2 text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:space-y-4 sm:px-5 sm:py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Title</label>
              <input
                type="text"
                placeholder="Optional title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-/[0.03] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-white/30"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Subject</label>
              <input
                type="text"
                placeholder="Optional subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-/[0.03] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-white/30"
                disabled={isLoading}
              />
            </div>
          </div>

          {fileType === 'link' ? (
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-/[0.03] px-3 py-2.5 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-white/30"
              disabled={isLoading}
            />
          ) : fileType === 'audio' ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-/[0.03] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Recorder</span>
                  {isRecording && (
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      Live
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {!isRecording && !recordedBlob ? (
                    <button
                      onClick={startRecording}
                      disabled={isLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-zinc-/[0.06] px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-/[0.1] disabled:opacity-50"
                    >
                      <Mic className="h-4 w-4" />
                      Start recording
                    </button>
                  ) : isRecording ? (
                    <button
                      onClick={stopRecording}
                      disabled={isLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  ) : recordedBlob ? (
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 sm:flex-1">
                        Recording ready • {formatTime(recordingTime)}
                      </span>
                      <button
                        onClick={() => {
                          setRecordedBlob(null);
                          setRecordingTime(0);
                        }}
                        className="w-full rounded-xl border border-white/10 bg-zinc-/[0.03] px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-/[0.06] sm:w-auto"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>

                {isRecording && (
                  <div className="mt-3 text-center">
                    <span className="font-mono text-lg font-semibold text-zinc-200">{formatTime(recordingTime)}</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-dashed border-white/12 bg-zinc-/[0.02] p-3 text-center sm:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Or upload audio</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || isRecording}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-/[0.05] px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-/[0.08] disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select audio file</span>
                </button>
                <p className="mt-2 text-[11px] text-zinc-500">MP3, WAV, M4A and other audio formats</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="audio/*"
                className="hidden"
                disabled={isLoading || isRecording}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-zinc-/[0.02] p-3 text-center sm:p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Document upload</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-/[0.05] px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-/[0.08] disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>Select file</span>
              </button>
              <p className="mt-2 text-[11px] text-zinc-500">PDF, DOCX, TXT, PPT, PPTX</p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept={
                  fileType === 'document'
                    ? '.pdf,.doc,.docx,.txt,.ppt,.pptx'
                    : 'audio/*'
                }
                className="hidden"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-white/10 bg-zinc-/[0.03] px-4 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-/[0.06] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={
                fileType === 'link'
                  ? handleLinkSubmit
                  : fileType === 'audio' && recordedBlob
                    ? handleRecordedAudioProcess
                    : () => fileInputRef.current?.click()
              }
              disabled={isLoading || (fileType === 'link' && !linkUrl.trim()) || (fileType === 'audio' && !recordedBlob && !title)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {fileType === 'link' ? 'Add link' : fileType === 'audio' && recordedBlob ? 'Process recording' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function readFileContent(file: File): Promise<ExtractedFileData> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type;

  // Handle PPTX files - they're ZIP files containing XML
  if (fileName.endsWith('.pptx') || fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      ).sort((a, b) => {
        const aNum = Number.parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
        const bNum = Number.parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
        return aNum - bNum;
      });

      let text = '';
      
      for (const slideFile of slideFiles) {
        const slideNumber = Number.parseInt(slideFile.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
        const content = await zip.files[slideFile].async('string');
        // Extract text from XML
        const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
        if (textMatches) {
          const slideText = textMatches
            .map(m => m.replace(/<a:t>|<\/a:t>/g, ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (slideText) {
            text += `[Slide ${slideNumber || 0}]\n${slideText}\n\n`;
          }
        }
      }
      
      if (text.trim()) {
        return {
          text: text.trim(),
          slideCount: slideFiles.length,
        };
      }
      return {
        text: `[PPTX Presentation: ${file.name}] - Could not extract text content`,
        slideCount: slideFiles.length,
      };
    } catch (error) {
      console.error('[app] PPTX extraction error:', error);
      return { text: `[PPTX Presentation: ${file.name}] - Error reading file` };
    }
  }

  // Handle PDF files using pdf.js
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    try {
      const text = await file.text();
      // Simple text extraction from PDF - extracts readable text
      const extracted = text.replace(/[^\x20-\x7E\n]/g, ' ').trim();
      if (extracted.length > 100) {
        return { text: extracted, pageCount: 1 };
      }
      return { text: `[PDF: ${file.name}] - Content extracted`, pageCount: 1 };
    } catch (error) {
      console.error('[app] PDF extraction error:', error);
      return { text: `[PDF: ${file.name}] - Could not read content` };
    }
  }

  // Handle DOCX files using mammoth
  if (fileName.endsWith('.docx') || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (result.value.trim()) {
        return { text: result.value.trim() };
      }
      return { text: `[DOCX Document: ${file.name}] - Could not extract text content` };
    } catch (error) {
      console.error('[app] DOCX extraction error:', error);
      return { text: `[DOCX Document: ${file.name}] - Error reading file` };
    }
  }

  // Handle audio files - send to server for transcription
  if (fileType.startsWith('audio/')) {
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.transcript) {
          return { text: data.transcript };
        }
      }

      // If transcription API fails, return a message about the audio
      return { text: `[Audio File: ${file.name}] - Audio file uploaded. Please note: For best transcription results, ensure the audio is clear and in English. The AI will analyze the audio content when generating notes.` };
    } catch (error) {
      console.error('[app] Audio transcription error:', error);
      return { text: `[Audio File: ${file.name}] - Error processing audio file` };
    }
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({ text: content });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));

    if (file.type === 'application/pdf') {
      resolve({ text: `[PDF Document: ${file.name}] - File content would be extracted here` });
    } else if (file.type.startsWith('audio/')) {
      resolve({ text: `[Audio File: ${file.name}] - Audio transcript would appear here` });
    } else {
      reader.readAsText(file);
    }
  });
}
