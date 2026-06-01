# Configuration

## AI Providers

At least one API key is required. Fallback order:

```
Cerebras → Mistral → xAI → Gemini → HuggingFace
```

| Variable | Provider | Notes |
|----------|----------|-------|
| `CEREBRAS_API_KEY` | [Cerebras](https://cloud.cerebras.ai/) | Set `CEREBRAS_MODEL` (see `lib/ai-models.ts`) |
| `MISTRAL_API_KEY` | [Mistral AI](https://console.mistral.ai/) | Set `MISTRAL_MODEL` |
| `XAI_API_KEY` | [xAI (Grok)](https://console.x.ai/) | Alias: `GROK_API_KEY` |
| `GEMINI_API_KEY` | [Google Gemini](https://aistudio.google.com/app/apikey) | |
| `HF_API_KEY` | [HuggingFace](https://huggingface.co/settings/tokens) | Also used for TTS model access |
| `GROQ_API_KEY` | [Groq](https://console.groq.com/) | Whisper transcription **only** — not used for chat/generation |

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
