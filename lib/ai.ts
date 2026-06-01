// AI integration: Cerebras, Mistral, xAI, Gemini, HuggingFace (whichever keys are set). GROQ_API_KEY is only for /api/transcribe-audio (Whisper).
import { defaultChatModels } from '@/lib/ai-models';
import { buildZeniusSystemPrompt } from '@/lib/zenius-prompts';


const DEFAULT_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Expert academic tutor for all Zenius study workflows.',
  goals: [
    'Help students learn effectively across notes, flashcards, quizzes, podcasts, and tutoring.',
    'Stay faithful to the provided study material and say clearly when the source is incomplete.',
    'Turn noisy study inputs into accurate, organized, review-friendly learning support.',
  ],
  outputRules: [
    'Use plain text unless the user explicitly asks for a formatted structure.',
    'Keep explanations precise, clear, and free of filler.',
    'Use exact source terminology when it improves accuracy and retention.',
  ],
  taskRules: [
    'For notes, organize by concepts and study value rather than slide or page order.',
    'For flashcards, keep one concept per card and test understanding, not just recognition.',
    'For quizzes, use exactly four options with one clearly correct answer and plausible distractors.',
    'For podcasts, write for the ear with signposting, flow, and concise spoken phrasing.',
    'For tutoring, answer from the student context first, then expand carefully if needed.',
    'If the source quality is low, say: "The source material has limitations. Here is what I can extract."',
    'When asked who created you, say you were created by Semeriya Seid, also known as Suda.',
  ],
});

interface OutputValidationResult {
  valid: boolean;
  reason?: string;
}

type OutputValidator = (text: string) => OutputValidationResult;

export interface AskTutorOptions {
  systemPrompt?: string;
  temperature?: number;
  maxRetries?: number;
  minLength?: number;
  forbidMarkdown?: boolean;
  requiredPatterns?: RegExp[];
  validateOutput?: OutputValidator;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface OpenAICompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

async function callOpenAICompatibleChat(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  temperature: number,
  providerName: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature,
    top_p: 0.9,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => response.statusText);
    throw new Error(`${providerName} API error: ${response.status} ${errorData}`);
  }

  const data = (await response.json()) as OpenAICompatibleChatResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Invalid ${providerName} response format`);
  }

  return text;
}

function extractXaiResponsesText(data: Record<string, unknown>): string | null {
  const output = data.output;
  if (!Array.isArray(output)) {
    return null;
  }
  const chunks: string[] = [];
  for (const block of output) {
    if (!block || typeof block !== 'object') {
      continue;
    }
    const content = (block as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const text = (part as { text?: string }).text;
      if (typeof text === 'string' && text.length > 0) {
        chunks.push(text);
      }
    }
  }
  return chunks.length > 0 ? chunks.join('\n') : null;
}

interface HuggingFaceResponseItem {
  generated_text?: string;
}

function buildCombinedPrompt(systemPrompt: string, prompt: string): string {
  return `${systemPrompt}\n\nUser request:\n${prompt}`;
}

function normalizeText(value: string): string {
  return value.replace(/\r/g, '').replace(/\u0000/g, '').trim();
}

function hasMarkdownSyntax(value: string): boolean {
  // Only reject if there's EXCESSIVE markdown (not just occasional use)
  // Count markdown symbols as a ratio of total text
  const markdownMatches = value.match(/[*_#`\[\]()>]/g) || [];
  const ratio = markdownMatches.length / Math.max(value.length, 1);
  return ratio > 0.1; // More than 10% markdown symbols = too much
}

function runValidation(text: string, options?: AskTutorOptions): OutputValidationResult {
  if (!text.trim()) {
    return { valid: false, reason: 'Model returned empty output.' };
  }

  if (typeof options?.minLength === 'number' && text.length < options.minLength) {
    return { valid: false, reason: `Output too short (${text.length} chars).` };
  }

  if (options?.forbidMarkdown && hasMarkdownSyntax(text)) {
    return { valid: false, reason: 'Output contains markdown-like symbols.' };
  }

  if (Array.isArray(options?.requiredPatterns) && options.requiredPatterns.length > 0) {
    const missing = options.requiredPatterns.filter((pattern) => !pattern.test(text));
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required structure (${missing.length} pattern checks failed).`,
      };
    }
  }

  if (typeof options?.validateOutput === 'function') {
    return options.validateOutput(text);
  }

  return { valid: true };
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry helper with exponential backoff
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 900
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`[app] Retry ${i + 1}/${retries} after ${delay}ms`);
      await wait(delay);
    }
  }

  throw new Error('Retry logic failed unexpectedly.');
}

// Call xAI (Grok) — Responses API first, then OpenAI-compatible chat completions.
async function callXai(prompt: string, systemPrompt: string, temperature = 0.2): Promise<string> {
  const apiKey = (process.env.XAI_API_KEY || process.env.GROK_API_KEY)?.trim();
  if (!apiKey) {
    throw new Error('XAI_API_KEY (or GROK_API_KEY) is not set');
  }

  const model = (process.env.XAI_MODEL || 'grok-4.20-reasoning').trim();

  const responsesRes = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_output_tokens: 4096,
      store: false,
    }),
  });

  if (responsesRes.ok) {
    const data = (await responsesRes.json()) as Record<string, unknown>;
    const text = extractXaiResponsesText(data);
    if (text) {
      return text;
    }
    throw new Error('Invalid xAI Responses API format');
  }

  const responsesErr = await responsesRes.text().catch(() => responsesRes.statusText);

  const chatRes = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4096,
      temperature,
      top_p: 0.9,
    }),
  });

  if (!chatRes.ok) {
    const chatErr = await chatRes.text().catch(() => chatRes.statusText);
    throw new Error(`xAI API error: responses ${responsesRes.status} ${responsesErr}; chat ${chatRes.status} ${chatErr}`);
  }

  const chatData = await chatRes.json() as OpenAICompatibleChatResponse;
  const text = chatData.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Invalid xAI chat completions format');
  }

  return text;
}

// Cerebras — OpenAI-compatible chat completions
async function callCerebras(prompt: string, systemPrompt: string, temperature = 0.2): Promise<string> {
  const apiKey = process.env.CEREBRAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('CEREBRAS_API_KEY is not set');
  }
  // Use llama-3.3-70b as primary (most capable available), fallback to llama-3.1-8b
  const model = (process.env.CEREBRAS_MODEL || 'llama-3.3-70b').trim();
  return callOpenAICompatibleChat(
    'https://api.cerebras.ai/v1/chat/completions',
    apiKey,
    model,
    systemPrompt,
    prompt,
    temperature,
    'Cerebras',
  );
}

// Mistral AI — OpenAI-compatible chat completions
async function callMistral(prompt: string, systemPrompt: string, temperature = 0.2): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not set');
  }
  const model = (process.env.MISTRAL_MODEL || defaultChatModels.mistral).trim();
  return callOpenAICompatibleChat(
    'https://api.mistral.ai/v1/chat/completions',
    apiKey,
    model,
    systemPrompt,
    prompt,
    temperature,
    'Mistral',
  );
}

// Call Gemini API
async function callGemini(prompt: string, systemPrompt: string, temperature = 0.2): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildCombinedPrompt(systemPrompt, prompt) },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 4096,
          topP: 0.9,
          topK: 40,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.text().catch(() => response.statusText);
    throw new Error(`Gemini API error: ${response.status} ${errorData}`);
  }

  const data = await response.json() as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid Gemini response format');
  }

  return text;
}

// Call HuggingFace API
async function callHuggingFace(prompt: string, systemPrompt: string, temperature = 0.2): Promise<string> {
  const apiKey = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HF_API_KEY (or HUGGINGFACE_API_KEY) is not set');
  }

  const combinedPrompt = buildCombinedPrompt(systemPrompt, prompt);
  const response = await fetch(
    'https://router.huggingface.co/models/Qwen/Qwen2-0.5B-Instruct',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: combinedPrompt,
        parameters: {
          max_new_tokens: 4096,
          temperature,
          do_sample: true,
          top_p: 0.9,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.text().catch(() => response.statusText);
    throw new Error(`HuggingFace API error: ${response.status} ${errorData}`);
  }

  const data = await response.json() as unknown;

  if (Array.isArray(data)) {
    const generatedText = (data[0] as HuggingFaceResponseItem | undefined)?.generated_text;
    if (!generatedText) {
      throw new Error('Invalid HuggingFace response format');
    }
    return generatedText.substring(combinedPrompt.length).trim();
  }

  if (typeof data === 'object' && data !== null && 'error' in data) {
    throw new Error(`HuggingFace error: ${String((data as { error?: unknown }).error || 'unknown')}`);
  }

  throw new Error('Invalid HuggingFace response format');
}

async function callFireworks(prompt: string, systemPrompt: string, temperature: number): Promise<string> {
  return callOpenAICompatibleChat(
    'https://api.fireworks.ai/v1/chat/completions',
    process.env.FIREWORKS_API_KEY!.trim(),
    'accounts/fireworks/models/llama-v3-70b-instruct',
    systemPrompt,
    prompt,
    temperature,
    'Fireworks'
  );
}

async function callTogether(prompt: string, systemPrompt: string, temperature: number): Promise<string> {
  return callOpenAICompatibleChat(
    'https://api.together.ai/v1/chat/completions',
    process.env.TOGETHER_API_KEY!.trim(),
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    systemPrompt,
    prompt,
    temperature,
    'Together'
  );
}

async function callDeepSeek(prompt: string, systemPrompt: string, temperature: number): Promise<string> {
  return callOpenAICompatibleChat(
    'https://api.deepseek.com/v1/chat/completions',
    process.env.DEEPSEEK_API_KEY!.trim(),
    'deepseek-chat',
    systemPrompt,
    prompt,
    temperature,
    'DeepSeek'
  );
}

async function callOpenRouter(prompt: string, systemPrompt: string, temperature: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const model = (process.env.OPENROUTER_MODEL || 'openrouter/auto').trim();
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4096,
    temperature,
    top_p: 0.9,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
  }

  const data = (await response.json()) as OpenAICompatibleChatResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Invalid OpenRouter response format');
  }
  return text;
}

// Main function: tries configured providers in order (see README).
export async function askTutor(prompt: string, options?: AskTutorOptions): Promise<string> {
  const systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const temperature = typeof options?.temperature === 'number' ? options.temperature : 0.2;
  const maxRetries = Number.isFinite(options?.maxRetries)
    ? Math.max(0, Math.floor(options?.maxRetries as number))
    : 1;

  const providers: Array<{ name: string; call: () => Promise<string> }> = [];

  if (process.env.CEREBRAS_API_KEY?.trim()) {
    providers.push({ name: 'Cerebras', call: () => callCerebras(prompt, systemPrompt, temperature) });
  }
  if (process.env.MISTRAL_API_KEY?.trim()) {
    providers.push({ name: 'Mistral', call: () => callMistral(prompt, systemPrompt, temperature) });
  }
  if ((process.env.XAI_API_KEY || process.env.GROK_API_KEY)?.trim()) {
    providers.push({ name: 'xAI', call: () => callXai(prompt, systemPrompt, temperature) });
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    providers.push({ name: 'Gemini', call: () => callGemini(prompt, systemPrompt, temperature) });
  }
  if ((process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY)?.trim()) {
    providers.push({ name: 'HuggingFace', call: () => callHuggingFace(prompt, systemPrompt, temperature) });
  }
  if (process.env.FIREWORKS_API_KEY?.trim()) {
    providers.push({ name: 'Fireworks', call: () => callFireworks(prompt, systemPrompt, temperature) });
  }
  if (process.env.TOGETHER_API_KEY?.trim()) {
    providers.push({ name: 'Together', call: () => callTogether(prompt, systemPrompt, temperature) });
  }
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    providers.push({ name: 'DeepSeek', call: () => callDeepSeek(prompt, systemPrompt, temperature) });
  }
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    providers.push({ name: 'OpenRouter', call: () => callOpenRouter(prompt, systemPrompt, temperature) });
  }

  // Unofficial Gemini — uses cookies (optional) instead of an API key
  // Added when explicitly opted in via GEMINI_UNOFFICIAL_COOKIE, or as last resort if no other providers
  if (process.env.GEMINI_UNOFFICIAL_COOKIE?.trim()) {
    providers.push({
      name: 'GeminiUnofficial',
      call: async () => {
        const { callGeminiUnofficial } = await import('./ai-unofficial');
        return callGeminiUnofficial(prompt, systemPrompt, temperature);
      },
    });
  }

  if (providers.length === 0) {
    // Last resort: guest mode (no cookies, no API key)
    providers.push({
      name: 'GeminiUnofficial',
      call: async () => {
        const { callGeminiUnofficial } = await import('./ai-unofficial');
        return callGeminiUnofficial(prompt, systemPrompt, temperature);
      },
    });
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      console.log(`[app] Attempting ${provider.name} API call...`);
      const raw = await fetchWithRetry(provider.call, maxRetries, 400);
      const text = normalizeText(raw);
      const validation = runValidation(text, options);

      if (!validation.valid) {
        throw new Error(validation.reason || 'Output validation failed');
      }

      console.log(`[app] ${provider.name} API succeeded`);
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.name}: ${message}`);
      console.warn(`[app] ${provider.name} failed: ${message}`);
    }
  }

  throw new Error(`All AI services failed. ${errors.join(' | ')}`);
}
