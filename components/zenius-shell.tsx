'use client';

import type { LucideIcon } from 'lucide-react';
import { BookOpen, FileStack, Home, MessageCircle, Search } from 'lucide-react';

export type ZeniusTab = 'home' | 'search' | 'files' | 'chat' | 'library';

export function ZeniusMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="Zenius"
      className={className}
    />
  );
}

function NavButton({
  id,
  label,
  icon: Icon,
  active,
  onSelect,
}: {
  id: ZeniusTab;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onSelect: (t: ZeniusTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
        active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-[22px] w-[22px] stroke-[1.5]" strokeWidth={1.5} />
      <span className="max-w-full truncate px-0.5 text-[10px] font-medium uppercase tracking-wide">
        {label}
      </span>
    </button>
  );
}

export function ZeniusShell({
  tab,
  onTabChange,
  children,
  showBrandHeader = true,
}: {
  tab: ZeniusTab;
  onTabChange: (t: ZeniusTab) => void;
  children: React.ReactNode;
  showBrandHeader?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black pb-[calc(4.25rem+env(safe-area-inset-bottom))] text-zinc-100">
      {showBrandHeader && (
        <header className="border-b border-zinc-800/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-lg items-start gap-3">
            <ZeniusMark className="h-10 w-10 shrink-0 text-white" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Zenius</h1>
              <p className="text-xs text-zinc-500">AI-Powered Learning Platform</p>
            </div>
          </div>
        </header>
      )}

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">{children}</div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1">
          <NavButton id="home" label="Home" icon={Home} active={tab === 'home'} onSelect={onTabChange} />
          <NavButton id="search" label="Search" icon={Search} active={tab === 'search'} onSelect={onTabChange} />
          <NavButton id="files" label="Files" icon={FileStack} active={tab === 'files'} onSelect={onTabChange} />
          <NavButton id="chat" label="Chat" icon={MessageCircle} active={tab === 'chat'} onSelect={onTabChange} />
          <NavButton id="library" label="Library" icon={BookOpen} active={tab === 'library'} onSelect={onTabChange} />
        </div>
      </nav>
    </div>
  );
}
