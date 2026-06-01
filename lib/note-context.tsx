'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

const STORAGE_KEY_NOTES = 'zenius_notes';
const STORAGE_KEY_PROFILE = 'zenius_profile';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[app] Failed to save to localStorage:', e);
  }
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export function NoteProvider({ children }: { children: React.ReactNode }) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [currentTab, setCurrentTab] = useState<TabType>('note');
  const [notes, setNotes] = useState<Note[]>(() => loadFromStorage<Note[]>(STORAGE_KEY_NOTES, []));
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => loadFromStorage<UserProfile | null>(STORAGE_KEY_PROFILE, null));

  useEffect(() => { saveToStorage(STORAGE_KEY_NOTES, notes); }, [notes]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PROFILE, userProfile); }, [userProfile]);

  const addNote = useCallback((note: Note) => {
    setNotes((prev) => [note, ...prev]);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
    setSelectedNote((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setSelectedNote((prev) => (prev?.id === id ? null : prev));
  }, []);

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      if (prev) return { ...prev, ...updates };
      return { name: updates.name || 'User', alias: updates.alias, createdAt: new Date().toISOString() };
    });
  }, []);

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
