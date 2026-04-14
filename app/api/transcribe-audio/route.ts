import { NextRequest, NextResponse } from 'next/server';

const REQUEST_TIMEOUT_MS = 45000;

function resolveSttAiBaseUrl(): string {
  return (process.env.STTAI_BASE_URL?.trim() || process.env.STT_AI_BASE_URL?.trim() || 'https://api.stt.ai').replace(/\/+$/, '');
}

async function transcribeWithGroq(audioFile: File, apiKey: string): Promise<string> {
  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' });

  const whisperFormData = new FormData();
  whisperFormData.append('file', blob, audioFile.name || 'audio.webm');
  whisperFormData.append('model', process.env.GROQ_WHISPER_MODEL?.trim() || 'whisper-large-v3');
  whisperFormData.append('language', 'en');
  whisperFormData.append('response_format', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: whisperFormData,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText);
      throw new Error(`Groq STT error ${response.status}: ${errorData}`);
    }

    const data = await response.json() as { text?: string };
    return typeof data.text === 'string' ? data.text.trim() : '';
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeWithSttAi(audioFile: File, apiKey?: string): Promise<string> {
  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' });
  const baseUrl = resolveSttAiBaseUrl();
  const model = process.env.STTAI_MODEL?.trim() || process.env.STT_AI_MODEL?.trim() || 'large-v3-turbo';
  const language = process.env.STTAI_LANGUAGE?.trim() || process.env.STT_AI_LANGUAGE?.trim() || 'auto';
  const diarize = (process.env.STTAI_DIARIZE?.trim() || process.env.STT_AI_DIARIZE?.trim() || 'true').toLowerCase();
  const speakers = process.env.STTAI_SPEAKERS?.trim() || process.env.STT_AI_SPEAKERS?.trim() || '0';
  const responseFormat = process.env.STTAI_RESPONSE_FORMAT?.trim() || process.env.STT_AI_RESPONSE_FORMAT?.trim() || 'json';

  const formData = new FormData();
  formData.append('file', blob, audioFile.name || 'audio.webm');
  formData.append('model', model);
  formData.append('language', language);
  formData.append('diarize', diarize);
  formData.append('speakers', speakers);
  formData.append('response_format', responseFormat);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (apiKey && apiKey.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(
      `${baseUrl}/v1/transcribe`,
      {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText);
      throw new Error(`STT.ai /v1/transcribe error ${response.status}: ${errorData}`);
    }

    const data = await response.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    const textCandidate = data.text || data.transcript || data.result;
    if (typeof textCandidate === 'string' && textCandidate.trim()) {
      return textCandidate.trim();
    }
    throw new Error('STT.ai returned success but no transcript text.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const providerErrors: string[] = [];

    const sttAiKey = (process.env.STTAI_API_KEY || process.env.STT_AI_API_KEY || process.env.TTSAI_API_KEY || process.env.TTS_AI_API_KEY)?.trim();
    try {
      const transcript = await transcribeWithSttAi(audioFile, sttAiKey);
      return NextResponse.json({
        success: true,
        transcript,
        provider: sttAiKey ? 'sttai' : 'sttai-anon',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerErrors.push(`STT.ai: ${message}`);
      console.warn('[app] STT.ai failed:', message);
    }

    const groqApiKey = process.env.GROQ_API_KEY?.trim();
    if (groqApiKey) {
      try {
        const transcript = await transcribeWithGroq(audioFile, groqApiKey);
        return NextResponse.json({
          success: true,
          transcript,
          provider: 'groq',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Groq: ${message}`);
        console.warn('[app] Groq STT failed:', message);
      }
    } else {
      providerErrors.push('Groq: GROQ_API_KEY missing.');
    }

    return NextResponse.json(
      {
        error: 'All transcription providers failed.',
        details: providerErrors.join(' | '),
      },
      { status: 502 }
    );
  } catch (error) {
    console.error('[app] Audio transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
