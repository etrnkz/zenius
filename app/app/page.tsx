'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useNote, type Note } from '@/lib/note-context';
import type { TabType } from '@/lib/note-context';
import { ZeniusShell, type ZeniusTab } from '@/components/zenius-shell';
import { LearningHubView } from '@/components/learning-hub-view';
import {
  ZeniusHomeTab,
  ZeniusSearchTab,
  ZeniusFilesTab,
  ZeniusGlobalChatTab,
  ZeniusLibraryTab,
} from '@/components/zenius-tab-panels';
import { FileUploadDialog } from '@/components/create-dialogs';

const UniversalDocViewer = dynamic(() => import('@/components/UniversalDocViewer'), { 
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-zinc-400">Loading viewer...</div>
    </div>
  )
});

export default function Dashboard() {
  const { selectedNote, setSelectedNote, setCurrentTab, notes, userProfile, updateUserProfile } = useNote();
  const [tab, setTab] = useState<ZeniusTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('Document');

  useEffect(() => {
    if (!userProfile) {
      updateUserProfile({ name: 'Student' });
    }
  }, [userProfile, updateUserProfile]);

  useEffect(() => {
    const handlePdfViewer = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setPdfUrl(customEvent.detail);
    };
    const handleDocViewer = (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string; name: string }>;
      setPdfUrl(customEvent.detail.url);
    };
    window.addEventListener('openPdfViewer', handlePdfViewer);
    window.addEventListener('openDocViewer', handleDocViewer);
    return () => {
      window.removeEventListener('openPdfViewer', handlePdfViewer);
      window.removeEventListener('openDocViewer', handleDocViewer);
    };
  }, []);

  const openHub = (note: Note, section?: TabType) => {
    if (section) setCurrentTab(section);
    setSelectedNote(note);
  };

  // PDF/Doc Viewer Modal - now uses Universal Doc Viewer
  if (pdfUrl) {
    return (
      <UniversalDocViewer
        fileUrl={pdfUrl}
        fileName={pdfFileName}
        onClose={() => setPdfUrl(null)}
      />
    );
  }

  if (selectedNote) {
    return (
      <div className="min-h-[100dvh] bg-black">
        <LearningHubView note={selectedNote} onBack={() => setSelectedNote(null)} />
      </div>
    );
  }

  return (
    <>
      <ZeniusShell tab={tab} onTabChange={setTab}>
        {tab === 'home' && (
          <ZeniusHomeTab
            notes={notes}
            onOpenNote={(n) => openHub(n)}
            onOpenUpload={() => setOpenDialog('document')}
            onOpenLink={() => setOpenDialog('link')}
            onOpenAudio={() => setOpenDialog('audio')}
          />
        )}
        {tab === 'search' && (
          <ZeniusSearchTab
            notes={notes}
            query={searchQuery}
            onQuery={setSearchQuery}
            onOpenNote={(n) => openHub(n)}
          />
        )}
        {tab === 'files' && <ZeniusFilesTab notes={notes} onOpenNote={(n) => openHub(n)} onOpenDocViewer={(url, name) => {
          setPdfUrl(url);
          setPdfFileName(name);
        }} />}
        {tab === 'chat' && <ZeniusGlobalChatTab />}
        {tab === 'library' && (
          <ZeniusLibraryTab notes={notes} onOpenSection={(n, s) => openHub(n, s)} />
        )}
      </ZeniusShell>

      <FileUploadDialog
        isOpen={openDialog === 'document'}
        onClose={() => setOpenDialog(null)}
        fileType="document"
      />
      <FileUploadDialog
        isOpen={openDialog === 'audio'}
        onClose={() => setOpenDialog(null)}
        fileType="audio"
      />
      <FileUploadDialog
        isOpen={openDialog === 'link'}
        onClose={() => setOpenDialog(null)}
        fileType="link"
      />
    </>
  );
}
