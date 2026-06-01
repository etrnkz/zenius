'use client';

import { FileText, File, FileSpreadsheet, Presentation, ChevronRight } from 'lucide-react';
import type { Note } from '@/lib/note-context';

export const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods', '.odp'];
export const DOCUMENT_TYPES = ['document', 'pdf'];
export type FilesSub = 'recent' | 'all';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function getFileIcon(fileName: string) {
  const ext = (fileName || '').toLowerCase().slice((fileName || '').lastIndexOf('.'));
  if (ext === '.pdf') return <FileText className="h-5 w-5 text-red-400" />;
  if (['.ppt', '.pptx'].includes(ext)) return <Presentation className="h-5 w-5 text-orange-400" />;
  if (['.xls', '.xlsx'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (['.doc', '.docx', '.odt'].includes(ext)) return <FileText className="h-5 w-5 text-blue-400" />;
  return <File className="h-5 w-5 text-zinc-400" />;
}

export function isDocumentFile(note: Note): boolean {
  if (DOCUMENT_TYPES.includes(note.type)) return true;
  if (note.fileName) {
    const ext = note.fileName.toLowerCase().slice(note.fileName.lastIndexOf('.'));
    return DOCUMENT_EXTENSIONS.includes(ext);
  }
  return false;
}

export function downloadFileNatively(note: Note) {
  const fileUrl = note.fileUrl;
  const fileName = note.fileName || note.title;
  if (!fileUrl) return false;
  if (fileUrl.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
  window.open(fileUrl, '_blank');
  return true;
}

export function openFileNatively(fileUrl: string, fileName: string) {
  const filename = fileName || 'document';
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (!DOCUMENT_EXTENSIONS.includes(ext)) return false;
  if (fileUrl.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
  window.open(fileUrl, '_blank');
  return true;
}

export function FileRow({ note, onOpen, useDocViewer = true }: { note: Note; onOpen: () => void; useDocViewer?: boolean }) {
  const fileName = note.fileName || note.title;
  const ext = (fileName || '').toLowerCase().slice((fileName || '').lastIndexOf('.'));
  const isViewableDoc = ['.pdf', '.xlsx', '.xls', '.docx', '.doc'].includes(ext);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!useDocViewer) {
      onOpen();
      return;
    }
    if (isViewableDoc && note.fileUrl) {
      window.dispatchEvent(new CustomEvent('openDocViewer', { detail: { url: note.fileUrl, name: fileName } }));
      return;
    }
    if (isDocumentFile(note) && note.fileUrl) {
      window.dispatchEvent(new CustomEvent('openDocViewer', { detail: { url: note.fileUrl, name: fileName } }));
      return;
    }
    onOpen();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-black px-3 py-3 text-left transition hover:border-zinc-600"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800">
        {getFileIcon(note.fileName || note.title)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{note.fileName || note.title}</span>
      <span className="text-xs text-zinc-500">Open</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
    </button>
  );
}
