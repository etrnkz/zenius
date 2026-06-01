export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const MAX_INPUT_CHARS = 2800;
const REQUEST_TIMEOUT_MS = 45000;

const LANGUAGE_MODEL_MAP: Record<string, string[]> = {
  default: ['facebook/mms-tts-eng', 'espnet/kan-bayashi_ljspeech_vits'],
  english: ['facebook/mms-tts-eng', 'espnet/kan-bayashi_ljspeech_vits'],
  spanish: ['facebook/mms-tts-spa', 'facebook/mms-tts-eng'],
  french: ['facebook/mms-tts-fra', 'facebook/mms-tts-eng'],
  german: ['facebook/mms-tts-deu', 'facebook/mms-tts-eng'],
  italian: ['facebook/mms-tts-ita', 'facebook/mms-tts-eng'],
  portuguese: ['facebook/mms-tts-por', 'facebook/mms-tts-eng'],
  chinese: ['facebook/mms-tts-cmn', 'facebook/mms-tts-eng'],
  japanese: ['facebook/mms-tts-jpn', 'facebook/mms-tts-eng'],
  korean: ['facebook/mms-tts-kor', 'facebook/mms-tts-eng'],
};

const AZURE_VOICE_MAP: Record<string, string> = {
  english: 'en-US-JennyNeural',
  spanish: 'es-ES-ElviraNeural',
  french: 'fr-FR-DeniseNeural',
  german: 'de-DE-KatjaNeural',
  italian: 'it-IT-ElsaNeural',
  portuguese: 'pt-BR-FranciscaNeural',
  chinese: 'zh-CN-XiaoxiaoNeural',
  japanese: 'ja-JP-NanamiNeural',
  korean: 'ko-KR-SunHiNeural',
};

const AUDIO_CONTENT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/wav',
};

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveModelCandidates(language: string): string[] {
  const fromEnv = process.env.HF_TTS_MODEL?.trim();
  if (fromEnv) {
    return [fromEnv];
  }

  const key = language.trim().toLowerCase();
  const configured = LANGUAGE_MODEL_MAP[key] || LANGUAGE_MODEL_MAP.default;
  const candidates = Array.isArray(configured) ? configured : [configured];
  return candidates.filter(Boolean);
}

function fileExtensionFromContentType(contentType: string): string {
  if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3')) return 'mp3';
  if (contentType.includes('audio/ogg')) return 'ogg';
  if (contentType.includes('audio/wav') || contentType.includes('audio/x-wav')) return 'wav';
  return 'bin';
}

function resolveSpeechifyBaseUrl(): string {
  return (process.env.SPEECHIFY_BASE_URL?.trim() || 'https://api.sws.speechify.com').replace(/\/+$/, '');
}

function resolveTtsAiBaseUrl(): string {
  return (process.env.TTSAI_BASE_URL?.trim() || process.env.TTS_AI_BASE_URL?.trim() || 'https://api.tts.ai').replace(/\/+$/, '');
}

function resolveTtsAiModel(): string {
  return process.env.TTSAI_MODEL?.trim() || process.env.TTS_AI_MODEL?.trim() || 'kokoro';
}

function resolveTtsAiVoice(): string {
  return process.env.TTSAI_VOICE?.trim() || process.env.TTS_AI_VOICE?.trim() || 'af_bella';
}

function resolveTtsAiFormat(): string {
  return (process.env.TTSAI_AUDIO_FORMAT?.trim() || process.env.TTS_AI_AUDIO_FORMAT?.trim() || 'mp3').toLowerCase();
}

function resolveSpeechifyVoiceId(): string {
  return process.env.SPEECHIFY_VOICE_ID?.trim() || 'george';
}

function resolveSpeechifyAudioFormat(): string {
  return (process.env.SPEECHIFY_AUDIO_FORMAT?.trim().toLowerCase() || 'mp3');
}

function contentTypeFromAudioFormat(format: string): string {
  return AUDIO_CONTENT_TYPE_MAP[format.toLowerCase()] || 'audio/mpeg';
}

function getPiperCommand(): string {
  return process.env.PIPER_BIN?.trim() || 'piper';
}

function getPiperModelPath(): string {
  return process.env.PIPER_MODEL?.trim() || '';
}

function getPiperConfigPath(): string {
  return process.env.PIPER_CONFIG?.trim() || '';
}

async function runProcess(command: string, args: string[], input?: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const message = stderr.trim() || `Process exited with code ${code}`;
      reject(new Error(message));
    });

    if (typeof input === 'string') {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function callPiperTTS(
  text: string
): Promise<{ audio: ArrayBuffer; contentType: string; model: string }> {
  const model = getPiperModelPath();
  if (!model) {
    throw new Error('Piper model path is missing. Set PIPER_MODEL.');
  }

  const baseTmpDir = await mkdtemp(join(tmpdir(), 'studyflow-piper-'));
  const outputDir = join(baseTmpDir, 'out');
  const outputWav = join(outputDir, 'speech.wav');
  const command = getPiperCommand();
  const args = ['--model', model, '--output_file', outputWav];
  const config = getPiperConfigPath();
  if (config) {
    args.push('--config', config);
  }

  try {
    await mkdir(outputDir, { recursive: true });
    await runProcess(command, args, `${text}\n`);
    const bytes = await readFile(outputWav);
    if (!bytes || bytes.byteLength < 512) {
      throw new Error('Piper returned an empty/too-small audio payload.');
    }
    return {
      audio: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: 'audio/wav',
      model,
    };
  } finally {
    await rm(baseTmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function resolveAzureVoice(language: string): string {
  const override = process.env.AZURE_SPEECH_VOICE?.trim();
  if (override) return override;

  const key = language.trim().toLowerCase();
  return AZURE_VOICE_MAP[key] || AZURE_VOICE_MAP.english;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseAzureLocale(voice: string): string {
  const parts = voice.split('-');
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : 'en-US';
}

function buildAzureSsml(text: string, voice: string): string {
  const locale = parseAzureLocale(voice);
  const safeText = escapeXml(text);
  return `<speak version='1.0' xml:lang='${locale}'><voice xml:lang='${locale}' name='${voice}'>${safeText}</voice></speak>`;
}

async function callAzureTTS(
  key: string,
  region: string,
  text: string,
  language: string
): Promise<{ audio: ArrayBuffer; contentType: string; voice: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const voice = resolveAzureVoice(language);

  try {
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'studyflow-ai',
        },
        body: buildAzureSsml(text, voice),
        signal: controller.signal,
      }
    );

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`Azure TTS error ${response.status}: ${errorBody}`);
    }

    const audio = await response.arrayBuffer();
    if (!audio || audio.byteLength < 512) {
      throw new Error('Azure returned an empty/too-small audio payload.');
    }

    return {
      audio,
      contentType: contentType || 'audio/mpeg',
      voice,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callSpeechifyTTS(
  token: string,
  text: string
): Promise<{ audio: ArrayBuffer; contentType: string; voiceId: string; audioFormat: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const baseUrl = resolveSpeechifyBaseUrl();
  const voiceId = resolveSpeechifyVoiceId();
  const audioFormat = resolveSpeechifyAudioFormat();

  try {
    const response = await fetch(
      `${baseUrl}/v1/audio/speech`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          voice_id: voiceId,
          audio_format: audioFormat,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`Speechify TTS error ${response.status}: ${errorBody}`);
    }

    const payload = await response.json() as {
      audio_data?: string;
      audio_format?: string;
    };

    if (!payload.audio_data || typeof payload.audio_data !== 'string') {
      throw new Error('Speechify response missing audio_data.');
    }

    const base64 = payload.audio_data.includes(',')
      ? payload.audio_data.split(',').pop() || ''
      : payload.audio_data;
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes || bytes.byteLength < 512) {
      throw new Error('Speechify returned an empty/too-small audio payload.');
    }

    const effectiveFormat = (payload.audio_format || audioFormat || 'mp3').toLowerCase();

    return {
      audio: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: contentTypeFromAudioFormat(effectiveFormat),
      voiceId,
      audioFormat: effectiveFormat,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callTtsAiTTS(
  token: string,
  text: string
): Promise<{ audio: ArrayBuffer; contentType: string; voice: string; model: string; audioFormat: string }> {
  const baseUrl = resolveTtsAiBaseUrl();
  const model = resolveTtsAiModel();
  const voice = resolveTtsAiVoice();
  const audioFormat = resolveTtsAiFormat();

  const submitController = new AbortController();
  const submitTimeout = setTimeout(() => submitController.abort(), 30000);

  try {
    const response = await fetch(
      `${baseUrl}/v1/tts/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model,
          text,
          voice,
          format: audioFormat,
        }),
        signal: submitController.signal,
      }
    );

    clearTimeout(submitTimeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`TTS.ai error ${response.status}: ${errorBody}`);
    }

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    const jobId = payload.job_id || payload.uuid;
    const initialStatus = payload.status;

    if (!jobId) {
      throw new Error(`TTS.ai response missing job_id: ${JSON.stringify(payload)}`);
    }

    if (initialStatus === 'completed') {
      const resultUrl = payload.result_url;
      if (typeof resultUrl === 'string' && resultUrl.trim()) {
        return await downloadTtsAiAudio(resultUrl, audioFormat, voice, model);
      }
      if (payload.audio_data) {
        return parseTtsAiAudio(payload, audioFormat, voice, model);
      }
    }

    if (initialStatus === 'failed' || initialStatus === 'error') {
      throw new Error(`TTS.ai job failed: ${JSON.stringify(payload)}`);
    }

    return await pollTtsAiJob(token, jobId, audioFormat, voice, model);

  } catch (error) {
    clearTimeout(submitTimeout);
    throw error;
  }
}

async function pollTtsAiJob(
  token: string,
  jobId: string,
  audioFormat: string,
  voice: string,
  model: string
): Promise<{ audio: ArrayBuffer; contentType: string; voice: string; model: string; audioFormat: string }> {
  const baseUrl = resolveTtsAiBaseUrl();
  const maxAttempts = 20;
  const pollInterval = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `${baseUrl}/v1/tts/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`TTS.ai poll attempt ${attempt} failed: ${response.status}`);
        continue;
      }

      const payload = await response.json().catch(() => ({}));
      const status = payload.status;

      if (status === 'completed') {
        const resultUrl = payload.result_url;
        if (typeof resultUrl === 'string' && resultUrl.trim()) {
          return await downloadTtsAiAudio(resultUrl, audioFormat, voice, model);
        }
        if (payload.audio_data) {
          return parseTtsAiAudio(payload, audioFormat, voice, model);
        }
        throw new Error(`TTS.ai completed but no audio: ${JSON.stringify(payload)}`);
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(`TTS.ai job failed: ${JSON.stringify(payload)}`);
      }

      console.log(`TTS.ai job ${jobId} status: ${status} (attempt ${attempt}/${maxAttempts})`);

    } catch (pollError) {
      clearTimeout(timeout);
      if (attempt === maxAttempts) {
        throw new Error(`TTS.ai polling timed out after ${maxAttempts} attempts`);
      }
    }
  }

  throw new Error(`TTS.ai job polling exceeded max attempts (${maxAttempts})`);
}

async function downloadTtsAiAudio(
  resultUrl: string,
  audioFormat: string,
  voice: string,
  model: string
): Promise<{ audio: ArrayBuffer; contentType: string; voice: string; model: string; audioFormat: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const audioResponse = await fetch(resultUrl, {
      signal: controller.signal,
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download TTS audio from CDN: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength < 512) {
      throw new Error('TTS.ai CDN returned an empty/too-small audio payload.');
    }

    return {
      audio: audioBuffer,
      contentType: contentTypeFromAudioFormat(audioFormat),
      voice,
      model,
      audioFormat,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseTtsAiAudio(
  payload: Record<string, unknown>,
  audioFormat: string,
  voice: string,
  model: string
): { audio: ArrayBuffer; contentType: string; voice: string; model: string; audioFormat: string } {
  const rawAudio = payload.audio_data || payload.audio || payload.audio_base64;
  if (typeof rawAudio !== 'string' || !rawAudio.trim()) {
    throw new Error(`TTS.ai returned JSON without audio payload: ${JSON.stringify(payload)}`);
  }
  const base64 = rawAudio.includes(',') ? rawAudio.split(',').pop() || '' : rawAudio;
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes || bytes.byteLength < 512) {
    throw new Error('TTS.ai returned an empty/too-small audio payload.');
  }
  const detectedFormat = typeof payload.format === 'string' && payload.format.trim()
    ? payload.format.toLowerCase()
    : audioFormat;
  return {
    audio: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    contentType: contentTypeFromAudioFormat(detectedFormat),
    voice,
    model,
    audioFormat: detectedFormat,
  };
}

async function callHuggingFaceTTS(apiKey: string, model: string, text: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://router.huggingface.co/models/${encodeURIComponent(model)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'audio/wav, audio/mpeg;q=0.9, application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        }),
        signal: controller.signal,
      }
    );

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`HuggingFace TTS error ${response.status}: ${errorBody}`);
    }

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(`HuggingFace TTS returned JSON: ${JSON.stringify(payload)}`);
    }

    const audio = await response.arrayBuffer();
    if (!audio || audio.byteLength < 512) {
      throw new Error('Generated audio payload was too small.');
    }

    return {
      audio,
      contentType: contentType || 'audio/wav',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, language = 'English' } = await request.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const cleanedText = normalizeText(text);
    if (!cleanedText) {
      return NextResponse.json({ error: 'Text is empty after normalization.' }, { status: 400 });
    }

    const safeText = cleanedText.length > MAX_INPUT_CHARS
      ? `${cleanedText.slice(0, MAX_INPUT_CHARS)}...`
      : cleanedText;

    const providerErrors: string[] = [];

    const ttsAiKey = (process.env.TTSAI_API_KEY || process.env.TTS_AI_API_KEY)?.trim();
    if (ttsAiKey) {
      try {
        const ttsAi = await callTtsAiTTS(ttsAiKey, safeText);
        const extension = fileExtensionFromContentType(ttsAi.contentType);
        const filename = `podcast-${Date.now()}.${extension}`;

        return new NextResponse(ttsAi.audio, {
          status: 200,
          headers: {
            'Content-Type': ttsAi.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-TTS-Provider': 'ttsai',
            'X-TTS-Voice': ttsAi.voice,
            'X-TTS-Model': ttsAi.model,
            'X-TTS-Audio-Format': ttsAi.audioFormat,
            'X-TTS-Truncated': cleanedText.length > MAX_INPUT_CHARS ? 'true' : 'false',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`TTS.ai: ${message}`);
        console.warn('[app] TTS.ai failed:', message);
      }
    } else {
      providerErrors.push('TTS.ai: TTSAI_API_KEY or TTS_AI_API_KEY missing.');
    }

    const speechifyKey = process.env.SPEECHIFY_API_KEY?.trim();
    if (speechifyKey) {
      try {
        const speechify = await callSpeechifyTTS(speechifyKey, safeText);
        const extension = fileExtensionFromContentType(speechify.contentType);
        const filename = `podcast-${Date.now()}.${extension}`;

        return new NextResponse(speechify.audio, {
          status: 200,
          headers: {
            'Content-Type': speechify.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-TTS-Provider': 'speechify',
            'X-TTS-Voice': speechify.voiceId,
            'X-TTS-Audio-Format': speechify.audioFormat,
            'X-TTS-Truncated': cleanedText.length > MAX_INPUT_CHARS ? 'true' : 'false',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Speechify: ${message}`);
        console.warn('[app] Speechify TTS failed:', message);
      }
    } else {
      providerErrors.push('Speechify: SPEECHIFY_API_KEY missing.');
    }

    const hasPiper = Boolean(getPiperModelPath());
    if (hasPiper) {
      try {
        const piper = await callPiperTTS(safeText);
        const filename = `podcast-${Date.now()}.wav`;
        return new NextResponse(piper.audio, {
          status: 200,
          headers: {
            'Content-Type': piper.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-TTS-Provider': 'piper',
            'X-TTS-Model': piper.model,
            'X-TTS-Truncated': cleanedText.length > MAX_INPUT_CHARS ? 'true' : 'false',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Piper: ${message}`);
        console.warn('[app] Piper TTS failed:', message);
      }
    } else {
      providerErrors.push('Piper: PIPER_MODEL missing.');
    }

    const azureKey = process.env.AZURE_SPEECH_KEY?.trim();
    const azureRegion = process.env.AZURE_SPEECH_REGION?.trim();

    if (azureKey && azureRegion) {
      try {
        const azure = await callAzureTTS(azureKey, azureRegion, safeText, typeof language === 'string' ? language : 'English');
        const extension = fileExtensionFromContentType(azure.contentType);
        const filename = `podcast-${Date.now()}.${extension}`;

        return new NextResponse(azure.audio, {
          status: 200,
          headers: {
            'Content-Type': azure.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-TTS-Provider': 'azure',
            'X-TTS-Voice': azure.voice,
            'X-TTS-Truncated': cleanedText.length > MAX_INPUT_CHARS ? 'true' : 'false',
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Azure: ${message}`);
        console.warn('[app] Azure TTS failed:', message);
      }
    } else {
      providerErrors.push('Azure: AZURE_SPEECH_KEY or AZURE_SPEECH_REGION missing.');
    }

    const hfKey = (process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY)?.trim();
    if (hfKey) {
      const models = resolveModelCandidates(typeof language === 'string' ? language : 'English');
      let finalAudio: ArrayBuffer | null = null;
      let finalContentType = 'audio/wav';
      let finalModel = models[0] || 'unknown';
      let lastError: Error | null = null;

      for (const model of models) {
        try {
          const { audio, contentType } = await callHuggingFaceTTS(hfKey, model, safeText);
          finalAudio = audio;
          finalContentType = contentType;
          finalModel = model;
          break;
        } catch (candidateError) {
          lastError = candidateError instanceof Error ? candidateError : new Error(String(candidateError));
          console.warn(`[app] HF TTS model failed (${model}):`, lastError.message);
        }
      }

      if (finalAudio) {
        const extension = fileExtensionFromContentType(finalContentType);
        const filename = `podcast-${Date.now()}.${extension}`;

        return new NextResponse(finalAudio, {
          status: 200,
          headers: {
            'Content-Type': finalContentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-TTS-Provider': 'huggingface',
            'X-TTS-Model': finalModel,
            'X-TTS-Truncated': cleanedText.length > MAX_INPUT_CHARS ? 'true' : 'false',
          },
        });
      }

      providerErrors.push(`HuggingFace: ${lastError?.message || 'No model produced audio.'}`);
    } else {
      providerErrors.push('HuggingFace: HF_API_KEY or HUGGINGFACE_API_KEY missing.');
    }

    return NextResponse.json(
      {
        error: 'All server-side TTS providers failed.',
        details: providerErrors.join(' | '),
      },
      { status: 502 }
    );
  } catch (error) {
    console.error('[app] TTS route error:', error);
    return NextResponse.json(
      { error: 'Failed to process text-to-speech request' },
      { status: 500 }
    );
  }
}
