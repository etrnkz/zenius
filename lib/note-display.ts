import type { LucideIcon } from 'lucide-react';
import { FileText, Link as LinkIcon, Mic, Upload } from 'lucide-react';
import type { NoteType } from '@/lib/note-context';

const monoBadge = 'bg-white/10 text-slate-200 border-white/20';

export function getNoteTypeMeta(type: NoteType): {
  icon: LucideIcon;
  label: string;
  badgeClass: string;
} {
  if (type === 'audio') {
    return { icon: Mic, label: 'Audio', badgeClass: monoBadge };
  }
  if (type === 'link') {
    return { icon: LinkIcon, label: 'Web Link', badgeClass: monoBadge };
  }
  if (type === 'pdf') {
    return { icon: FileText, label: 'PDF', badgeClass: monoBadge };
  }
  return { icon: Upload, label: 'Document', badgeClass: monoBadge };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'No duration';
  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`;
  }
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
