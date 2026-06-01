'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square, Download } from 'lucide-react';
import type { Note } from '@/lib/note-context';
import { useToast } from '@/hooks/use-toast';

type PodcastRole = 'VOICE_A' | 'VOICE_B' | 'NARRATOR';

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

function extractKeyPoints(value: string, maxPoints = 6): string[] {
  const candidates = value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) =>
      line
        .replace(/^[•\-*]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim()
    )
    .filter((line) => line.length > 28 && line.length < 220)
    .filter((line) => !/^(topic snapshot|high-yield points|structure \/ flow|common confusions|quick recap)\b/i.test(line));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of candidates) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(line);
    }
    if (unique.length >= maxPoints) break;
  }

  return unique;
}

function pickPanelJoke(topic: string): string {
  const jokes = [
    'If this chapter had a gym membership, our brains just did the warm-up.',
    'My notebook is judging me, but at least now it understands the topic.',
    'This is the kind of concept that looks scary first, then becomes your exam best friend.',
    'If confusion had Wi-Fi, this recap just changed the password.',
  ];
  const hash = topic.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return jokes[Math.abs(hash) % jokes.length];
}

function buildSmartPodcastScript(source: string, title: string): string {
  const topic = title?.trim() || 'this topic';
  const points = extractKeyPoints(source, 7);
  const fallbackPoints = points.length > 0
    ? points
    : ['The source notes are short, so let us focus on the most important ideas and definitions first.'];

  const p1 = fallbackPoints[0] || 'Let us begin with the first concept.';
  const p2 = fallbackPoints[1] || p1;
  const p3 = fallbackPoints[2] || p2;
  const p4 = fallbackPoints[3] || p3;
  const p5 = fallbackPoints[4] || p4;
  const recap = [p1, p2, p3, p4, p5].slice(0, 5).map((line, index) => `${index + 1}. ${line}`);
  const joke = pickPanelJoke(topic);

  return [
    `Let us start with why ${topic} matters in real life. If you understand this, decisions become clearer and less random.`,
    `Good, because I do not want to memorize words. I want to know how to think with it.`,
    '',
    'Give me the core idea in one simple line.',
    `Core idea: ${p1}`,
    '',
    'Why does that actually work?',
    `It works because ${p2}`,
    '',
    'Wait, that sounds too clean. What breaks when people use it badly?',
    `Great challenge. A common failure is ${p3}`,
    '',
    'Give me a real-life scenario, not theory.',
    `Imagine this situation: ${p4}`,
    '',
    'I thought this was just a terminology issue.',
    `Not exactly. That is a common confusion. The real point is ${p5}`,
    '',
    'Okay, fair correction. Also, quick joke break before my brain crashes.',
    `${joke}`,
    '',
    'Quick recap, 3 to 5 takeaways, short lines only.',
    'Recap starts now.',
    ...recap,
    '',
    'Nice, now it actually makes sense.',
    'Perfect. If you can explain these takeaways in your own words, you understand it.',
  ].join('\n');
}

function extractDialogueSegments(value: string): Array<{ speaker: PodcastRole; text: string }> {
  const lines = stripAiMarkdown(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const segments: Array<{ speaker: PodcastRole; text: string }> = [];
  let lastSpeaker: PodcastRole = 'NARRATOR';

  for (const line of lines) {
    const match = line.match(/^(VOICE\s*A|VOICE\s*B|EMMA|ALEX)\s*:\s*(.+)$/i);
    if (match) {
      const rawSpeaker = match[1].toUpperCase().replace(/\s+/g, '');
      const speaker: PodcastRole = rawSpeaker === 'VOICEA' || rawSpeaker === 'ALEX' ? 'VOICE_A' : 'VOICE_B';
      const text = match[2].trim();
      if (text) {
        segments.push({ speaker, text });
        lastSpeaker = speaker;
      }
      continue;
    }

    if (!line) continue;

    if (segments.length > 0 && lastSpeaker !== 'NARRATOR') {
      const last = segments[segments.length - 1];
      segments[segments.length - 1] = { ...last, text: `${last.text} ${line}`.trim() };
    } else {
      segments.push({ speaker: 'NARRATOR', text: line });
    }
  }

  return segments;
}

function chunkSpeechText(value: string): string[] {
  const sentences = value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const parts = sentence.length > 220 ? sentence.split(/[,;:]\s+/) : [sentence];
    for (const part of parts) {
      const cleanedPart = part.trim();
      if (!cleanedPart) continue;

      if (cleanedPart.length > 220) {
        const words = cleanedPart.split(/\s+/);
        let rolling = '';
        for (const word of words) {
          if (!word) continue;
          if (!rolling || rolling.length + word.length + 1 <= 220) {
            rolling = rolling ? `${rolling} ${word}` : word;
          } else {
            chunks.push(rolling);
            rolling = word;
          }
        }
        if (rolling) chunks.push(rolling);
        continue;
      }

      const lastIndex = chunks.length - 1;
      if (lastIndex >= 0 && chunks[lastIndex].length + cleanedPart.length + 1 <= 220) {
        chunks[lastIndex] = `${chunks[lastIndex]} ${cleanedPart}`;
      } else {
        chunks.push(cleanedPart);
      }
    }
  }

  return chunks.filter(Boolean);
}

function getRoleVoice(voices: SpeechSynthesisVoice[], langCode: string, role: PodcastRole): SpeechSynthesisVoice | undefined {
  const baseLang = langCode.split('-')[0].toLowerCase();
  const matchingLang = voices.filter((voice) => voice.lang.toLowerCase().startsWith(baseLang));
  if (matchingLang.length === 0) return undefined;

  const femaleHints = ['female', 'woman', 'girl', 'jenny', 'aria', 'samantha', 'zira', 'emma', 'amy', 'ava', 'serena', 'sara', 'katja', 'elvira', 'nanami'];
  const maleHints = ['male', 'man', 'boy', 'alex', 'david', 'guy', 'daniel', 'tom', 'george', 'liam', 'brian', 'ryan', 'matthew', 'james'];
  const hints = role === 'VOICE_A' ? maleHints : role === 'VOICE_B' ? femaleHints : [];
  const qualityHints = ['google', 'microsoft', 'natural', 'neural', 'enhanced', 'premium', 'studio'];

  const scoreVoice = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    const qualityScore = qualityHints.reduce((acc, hint) => acc + (name.includes(hint) ? 1 : 0), 0);
    const roleScore = hints.reduce((acc, hint) => acc + (name.includes(hint) ? 1 : 0), 0);
    return (qualityScore * 10) + roleScore;
  };

  const sorted = [...matchingLang].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const hinted = sorted.find((voice) => {
    const name = voice.name.toLowerCase();
    return hints.some((hint) => name.includes(hint));
  });

  return hinted || sorted[0];
}

export function PodcastPanel({ note }: { note: Note }) {
  const { toast } = useToast();
  const sourceContent = note.content?.trim() ? note.content : (note.generatedNotes || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState('English');
  const [speaker, setSpeaker] = useState('Default');
  const [isPlaying, setIsPlaying] = useState(false);
  const [podcastScript, setPodcastScript] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');
  const [generatedAudioExt, setGeneratedAudioExt] = useState<'wav' | 'mp3' | 'ogg'>('wav');
  const [isRenderingAudio, setIsRenderingAudio] = useState(false);
  const playbackTokenRef = useRef(0);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      playbackTokenRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);

  const getLangCode = (lang: string) => {
    const map: Record<string, string> = {
      'English': 'en-US', 'Spanish': 'es-ES', 'French': 'fr-FR',
      'German': 'de-DE', 'Italian': 'it-IT', 'Portuguese': 'pt-BR',
      'Chinese': 'zh-CN', 'Japanese': 'ja-JP', 'Korean': 'ko-KR'
    };
    return map[lang] || 'en-US';
  };

  const getVoiceSettings = (style: string) => {
    const settings: Record<string, { rate: number; pitch: number }> = {
      'Default': { rate: 1, pitch: 1 },
      'Professional': { rate: 0.9, pitch: 1 },
      'Casual': { rate: 1.1, pitch: 1.1 },
      'Academic': { rate: 0.8, pitch: 0.9 },
      'Enthusiastic': { rate: 1.1, pitch: 1.2 }
    };
    return settings[style] || { rate: 1, pitch: 1 };
  };

  const speakChunk = (
    chunk: string,
    langCode: string,
    voiceSettings: { rate: number; pitch: number },
    preferredVoice: SpeechSynthesisVoice | undefined,
    token: number
  ): Promise<'ended' | 'interrupted' | 'failed'> =>
    new Promise((resolve) => {
      if (!('speechSynthesis' in window) || token !== playbackTokenRef.current) {
        resolve('interrupted');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      activeUtteranceRef.current = utterance;
      utterance.lang = langCode;
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => { resolve('ended'); };

      utterance.onerror = (event) => {
        const errorType = event.error || 'unknown';
        if (errorType === 'interrupted' || errorType === 'canceled' || token !== playbackTokenRef.current) {
          resolve('interrupted');
          return;
        }
        console.error('[app] Speech synthesis error:', errorType);
        setError(`Speech playback failed (${errorType}). Try a different voice/language or Chrome.`);
        resolve('failed');
      };

      window.speechSynthesis.speak(utterance);
    });

  const requestServerAudio = async (scriptTextRaw: string): Promise<string> => {
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: scriptTextRaw, language, speaker }),
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({ error: 'Audio generation failed.' }));
      const messageParts = [payload.error, payload.details].filter((part) => typeof part === 'string' && part.trim());
      throw new Error(messageParts.length > 0 ? messageParts.join(' ') : 'Audio generation failed.');
    }

    const audioBlob = await response.blob();
    if (audioBlob.size < 512 || !audioBlob.type.startsWith('audio/')) {
      throw new Error('Server returned an invalid audio payload.');
    }

    if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
      setGeneratedAudioExt('mp3');
    } else if (audioBlob.type.includes('ogg')) {
      setGeneratedAudioExt('ogg');
    } else {
      setGeneratedAudioExt('wav');
    }

    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
    }
    const nextUrl = URL.createObjectURL(audioBlob);
    setGeneratedAudioUrl(nextUrl);
    return nextUrl;
  };

  const handleGenerate = async () => {
    if (!sourceContent) {
      toast({ title: 'No source content', description: 'Generate notes or upload source content first.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setError('');
    setWarning('');
    setGeneratedAudioUrl('');
    setGeneratedAudioExt('wav');
    try {
      const script = buildSmartPodcastScript(sourceContent, note.title);
      setPodcastScript(script);
      setWarning('');
    } catch (error) {
      console.error('[app] Podcast generation error:', error);
      setPodcastScript(sourceContent);
      setError('Using your source text for podcast narration.');
      setWarning('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = async () => {
    setError('');
    const textToSpeakRaw = stripAiMarkdown(podcastScript || sourceContent);
    const textToSpeak = textToSpeakRaw.length > 14000 ? `${textToSpeakRaw.slice(0, 14000)}...` : textToSpeakRaw;
    if (!textToSpeak) {
      toast({ title: 'No script content', description: 'Generate a podcast script before playback.', variant: 'destructive' });
      return;
    }

    try {
      const audioUrl = await requestServerAudio(textToSpeak);
      window.speechSynthesis?.cancel();
      activeUtteranceRef.current = null;
      playbackTokenRef.current += 1;
      setIsPlaying(true);
      window.setTimeout(() => {
        const el = generatedAudioRef.current;
        if (!el) { setIsPlaying(false); return; }
        if (el.src !== audioUrl) { el.src = audioUrl; }
        el.currentTime = 0;
        void el.play().catch((playError) => {
          const errorMessage = playError instanceof Error ? playError.name : String(playError);
          if (errorMessage === 'AbortError' || errorMessage === 'NotAllowedError') { setIsPlaying(false); return; }
          console.error('[app] Audio element play failed:', playError);
          setIsPlaying(false);
        });
      }, 50);
      return;
    } catch (serverAudioError) {
      const message = serverAudioError instanceof Error ? serverAudioError.message : String(serverAudioError);
      console.warn('[app] Server playback fallback to browser TTS:', message);
      setWarning('Server voice unavailable right now; using browser voice.');
    }

    if (!('speechSynthesis' in window)) {
      toast({ title: 'Text-to-speech unavailable', description: 'Your browser does not support speech synthesis.', variant: 'destructive' });
      return;
    }

    const dialogueSegments = extractDialogueSegments(textToSpeak);
    const chunksWithSpeaker = dialogueSegments.flatMap((segment) =>
      chunkSpeechText(segment.text).map((chunk) => ({ speaker: segment.speaker, text: chunk }))
    );

    if (chunksWithSpeaker.length === 0) {
      toast({ title: 'Invalid speech content', description: 'No valid text chunks found for playback.', variant: 'destructive' });
      return;
    }

    playbackTokenRef.current += 1;
    const token = playbackTokenRef.current;
    window.speechSynthesis.cancel();
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    if (token !== playbackTokenRef.current) { return; }

    const langCode = getLangCode(language);
    const voiceSettings = getVoiceSettings(speaker);
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => resolve(), 600);
        const handler = () => { window.clearTimeout(timer); resolve(); };
        window.speechSynthesis.onvoiceschanged = handler;
      });
      voices = window.speechSynthesis.getVoices();
    }

    const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(langCode.split('-')[0].toLowerCase()));
    const voiceA = getRoleVoice(voices, langCode, 'VOICE_A') || preferredVoice;
    const voiceB = getRoleVoice(voices, langCode, 'VOICE_B') || preferredVoice;
    setIsPlaying(true);

    let hasRetriedInterrupted = false;
    for (const segment of chunksWithSpeaker) {
      if (token !== playbackTokenRef.current) break;

      const roleVoice = segment.speaker === 'VOICE_A' ? voiceA : segment.speaker === 'VOICE_B' ? voiceB : preferredVoice;
      const roleSettings = segment.speaker === 'VOICE_A'
        ? { ...voiceSettings, rate: Math.max(0.85, voiceSettings.rate - 0.03), pitch: Math.min(1.15, voiceSettings.pitch + 0.03) }
        : segment.speaker === 'VOICE_B'
          ? { ...voiceSettings, rate: Math.max(0.85, voiceSettings.rate - 0.02), pitch: Math.max(0.9, voiceSettings.pitch - 0.03) }
          : voiceSettings;
      const result = await speakChunk(segment.text, langCode, roleSettings, roleVoice, token);
      if (result === 'ended') { continue; }

      if (result === 'interrupted' && !hasRetriedInterrupted && token === playbackTokenRef.current) {
        hasRetriedInterrupted = true;
        await new Promise((resolve) => window.setTimeout(resolve, 180));
        const retryResult = await speakChunk(segment.text, langCode, roleSettings, roleVoice, token);
        if (retryResult === 'ended') { continue; }
      }

      if (result === 'interrupted' && token === playbackTokenRef.current) {
        setError('Speech playback was interrupted. Press Play again or try Chrome/Edge.');
      }
      break;
    }

    if (token === playbackTokenRef.current) {
      activeUtteranceRef.current = null;
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    playbackTokenRef.current += 1;
    activeUtteranceRef.current = null;
    window.speechSynthesis?.cancel();
    if (generatedAudioRef.current) {
      generatedAudioRef.current.pause();
      generatedAudioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handleGenerateAudioFile = async () => {
    const scriptTextRaw = stripAiMarkdown(podcastScript || sourceContent);
    if (!scriptTextRaw) { setError('No script text available to generate audio.'); return; }

    setIsRenderingAudio(true);
    setError('');
    try {
      if (/^VOICE\s*A:|^VOICE\s*B:|^EMMA:|^ALEX:/mi.test(scriptTextRaw)) {
        setWarning('Saved file currently uses one server voice. Live Play uses male/female panel voices.');
      }
      await requestServerAudio(scriptTextRaw);
    } catch (audioError) {
      console.error('[app] Server TTS generation error:', audioError);
      setError(audioError instanceof Error ? `Audio file generation failed: ${audioError.message}` : 'Audio file generation failed.');
    } finally {
      setIsRenderingAudio(false);
    }
  };

  const hasContent = sourceContent || podcastScript;

  if (!hasContent) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
        <p>No source content. Upload a file or generate notes first.</p>
      </div>
    );
  }

  if (podcastScript) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">{isPlaying ? 'Playing...' : 'Ready'}</span>
            <span className="text-xs text-zinc-500">{language}/{speaker}</span>
          </div>
          <div className="flex gap-2">
            {!isPlaying ? (
              <button onClick={handlePlay} className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-3 py-2 text-xs font-medium text-white">
                <Play className="mr-1 inline h-3 w-3" /> Play
              </button>
            ) : (
              <button onClick={handleStop} className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white">
                <Square className="mr-1 inline h-3 w-3" /> Stop
              </button>
            )}
            <button onClick={handleGenerateAudioFile} disabled={isRenderingAudio} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 disabled:opacity-50">
              <Download className="inline h-3 w-3" /> {isRenderingAudio ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {warning && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-300">{warning}</p>}

        {generatedAudioUrl && (
          <audio ref={generatedAudioRef} controls className="w-full" src={generatedAudioUrl}
            onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              const audioElement = e.target as HTMLAudioElement;
              if (audioElement.error?.code === MediaError.MEDIA_ERR_ABORTED) { setIsPlaying(false); return; }
              console.error('[app] Audio element error:', audioElement.error);
              setIsPlaying(false);
              setError('Audio playback failed. Please try again.');
            }}
          >
            Your browser does not support audio.
          </audio>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300">
          <option>English</option><option>Spanish</option><option>French</option><option>German</option>
        </select>
        <select value={speaker} onChange={(e) => setSpeaker(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300">
          <option>Default</option><option>Professional</option><option>Casual</option><option>Academic</option>
        </select>
      </div>

      <button onClick={handleGenerate} disabled={isGenerating || !sourceContent} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-500">
        {isGenerating ? 'Generating...' : 'Generate Podcast'}
      </button>

      {warning && <p className="rounded border border-amber-800 bg-amber-900/20 px-2 py-1 text-xs text-amber-300">{warning}</p>}
      {error && <p className="rounded border border-rose-800 bg-rose-900/20 px-2 py-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
