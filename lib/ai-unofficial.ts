// Unofficial API providers — isolated from bundler tracing

async function loadPackage(spec: string) {
  const imp = new Function('spec', 'return import(spec)') as (spec: string) => Promise<Record<string, unknown>>;
  return imp(spec);
}

export async function callGeminiUnofficial(
  prompt: string,
  systemPrompt: string,
  _temperature = 0.2
): Promise<string> {
  const cookie = process.env.GEMINI_UNOFFICIAL_COOKIE?.trim() || '';
  const model = (process.env.GEMINI_UNOFFICIAL_MODEL || 'gemini-3.5-flash').trim();

  const mod = await loadPackage('gemini-unofficial-api');
  const GeminiClient = mod.GeminiClient as {
    new (opts?: { cookie?: string; cookiesFile?: false }): {
      init(): Promise<void>;
      sendMessage(prompt: string, opts?: { model?: string }): Promise<string>;
    };
  };

  const client = new GeminiClient({ cookie: cookie || undefined, cookiesFile: false });
  await client.init();

  const combinedPrompt = `${systemPrompt}\n\nUser request:\n${prompt}`;
  return client.sendMessage(combinedPrompt, { model });
}

export async function callChatGPTUnofficial(
  prompt: string,
  systemPrompt: string,
  _temperature = 0.2
): Promise<string> {
  const cookie = process.env.CHATGPT_UNOFFICIAL_COOKIE?.trim() || '';
  const model = (process.env.CHATGPT_UNOFFICIAL_MODEL || 'auto').trim();

  const mod = await loadPackage('chatgpt-unofficial-api-root/client/index.mjs');
  const ChatGPT = mod.ChatGPT as {
    new (opts?: { cookies?: string; cookiesFile?: false }): {
      init(): Promise<void>;
      ask(message: string, opts?: { model?: string }): Promise<string>;
    };
  };

  const client = new ChatGPT({ cookies: cookie || undefined, cookiesFile: false });
  await client.init();

  const combinedPrompt = `${systemPrompt}\n\n${prompt}`;
  return client.ask(combinedPrompt, { model });
}
