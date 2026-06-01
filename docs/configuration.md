# Configuration

## AI Providers

At least one API key or an unofficial provider is required. Fallback order:

```
Cerebras → Mistral → xAI → Gemini → HuggingFace → ... → ChatGPTUnofficial → GeminiUnofficial
```

| Variable | Provider | Notes |
|----------|----------|-------|
| `CEREBRAS_API_KEY` | [Cerebras](https://cloud.cerebras.ai/) | Set `CEREBRAS_MODEL` (see `lib/ai-models.ts`) |
| `MISTRAL_API_KEY` | [Mistral AI](https://console.mistral.ai/) | Set `MISTRAL_MODEL` |
| `XAI_API_KEY` | [xAI (Grok)](https://console.x.ai/) | Alias: `GROK_API_KEY` |
| `GEMINI_API_KEY` | [Google Gemini](https://aistudio.google.com/app/apikey) | |
| `HF_API_KEY` | [HuggingFace](https://huggingface.co/settings/tokens) | Also used for TTS model access |
| `GROQ_API_KEY` | [Groq](https://console.groq.com/) | Whisper transcription **only** — not used for chat/generation |

### Unofficial ChatGPT (no API key needed)

Powered by [chatgpt-unofficial-api](https://github.com/etrnkz/chatgpt-unofficial-api).

| Variable | Default | Description |
|----------|---------|-------------|
| `CHATGPT_UNOFFICIAL_COOKIE` | — | ChatGPT cookies string for authenticated access (higher limits). Optional. |
| `CHATGPT_UNOFFICIAL_MODEL` | `auto` | Model override |

### Unofficial Gemini (no API key needed)

Powered by [gemini-unofficial-api](https://github.com/etrnkz/gemini-unofficial-api).

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_UNOFFICIAL_COOKIE` | — | Google cookies string for authenticated access (higher limits). Optional. |
| `GEMINI_UNOFFICIAL_MODEL` | `gemini-3.5-flash` | Model: `gemini-3.5-flash`, `gemini-3.5-flash-thinking`, `gemini-3.1-pro`, `gemini-auto` |

**Usage scenarios:**

| Config | Behavior |
|--------|----------|
| No API keys, no cookie | Falls back to ChatGPT unofficial in guest mode, then Gemini |
| `CHATGPT_UNOFFICIAL_COOKIE` set | Uses ChatGPT with cookies (higher limits) |
| `GEMINI_UNOFFICIAL_COOKIE` set | Uses Gemini with cookies |
| Any standard API key set | Normal provider chain — unofficial providers are skipped |

To get cookies: log in to the service, open DevTools > Application > Cookies, and copy the cookie string. Save it as the corresponding `*_UNOFFICIAL_COOKIE` variable in your `.env.local`.

## Piper TTS

Piper is a local, open-source text-to-speech engine. Configure via env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `PIPER_BIN` | `piper` | Path to Piper binary |
| `PIPER_MODEL` | — | Path to `.onnx` voice model (e.g. `voices/en_US-lessac-medium.onnx`) |
| `PIPER_CONFIG` | — | Path to model config `.json` |
| `AZURE_SPEECH_KEY` | — | Fallback TTS (Azure Speech Services) |
| `AZURE_SPEECH_REGION` | — | Azure region |

Voice models go in `voices/`. The repo includes `en_US-lessac-medium` by default.

## Limits

| Limit | Value |
|-------|-------|
| TTS input | 2,800 characters |
| Note generation source | 60,000 characters |
| Podcast source | 40,000 characters |
| TTS request timeout | 45 seconds |
| Quiz questions per request | 5 (default) |

## Environment

Copy `.env.example` to `.env.local` (or `.env`). Both are gitignored.

```bash
# Minimal setup — one AI provider is enough
GEMINI_API_KEY=your_key_here
```
