'use client';

import React, { createContext, useContext, useState } from 'react';

export type TabType = 'note' | 'chat' | 'flashcards' | 'quizzes' | 'podcast';
export type NoteType = 'document' | 'pdf' | 'audio' | 'link';

export interface UserProfile {
  name: string;
  alias?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  subject: string;
  content: string;
  generatedNotes?: string;
  type: NoteType;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  linkUrl?: string;
  createdAt: string;
  lastOpened: string;
  metadata?: {
    fileSize?: number;
    duration?: number;
    wordCount?: number;
    pageCount?: number;
    slideCount?: number;
    sourceType?: 'youtube' | 'website' | 'upload';
  };
}

interface NoteContextType {
  selectedNote: Note | null;
  setSelectedNote: (note: Note | null) => void;
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  notes: Note[];
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export function NoteProvider({ children }: { children: React.ReactNode }) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('note');
  const [notes, setNotes] = useState<Note[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const addNote = (note: Note) => {
    setNotes((prev) => [note, ...prev]);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, ...updates });
    }
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, ...updates });
    } else {
      setUserProfile({
        name: updates.name || 'User',
        alias: updates.alias,
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <NoteContext.Provider
      value={{
        selectedNote,
        setSelectedNote,
        currentTab,
        setCurrentTab,
        notes,
        addNote,
        updateNote,
        deleteNote,
        userProfile,
        setUserProfile,
        updateUserProfile,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

export function useNote() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNote must be used within a NoteProvider');
  }
  return context;
}
