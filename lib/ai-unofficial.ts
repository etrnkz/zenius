// Gemini Unofficial API provider — isolated from bundler tracing

export async function callGeminiUnofficial(
  prompt: string,
  systemPrompt: string,
  _temperature = 0.2
): Promise<string> {
  const cookie = process.env.GEMINI_UNOFFICIAL_COOKIE?.trim() || '';
  const model = (process.env.GEMINI_UNOFFICIAL_MODEL || 'gemini-3.5-flash').trim();

  const imp = new Function('spec', 'return import(spec)') as (spec: string) => Promise<Record<string, unknown>>;
  const mod = await imp('gemini-unofficial-api');
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
