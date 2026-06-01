# Architecture

## AI Fallback Chain

Each provider is tried in order; if it fails or returns empty, the next is attempted. Only providers with configured API keys are included.

```
Cerebras → Mistral → xAI → Gemini → HuggingFace
```

## Runtime

Three API routes use `runtime = 'nodejs'` (child_process, fs):
- `text-to-speech`
- `process-link`
- `generate-video-notes`

All others use the default Edge runtime.

## State

Notes and user profile persist in `localStorage` under `zenius_notes` and `zenius_profile` keys. No backend database.

## Offline Fallback

If all AI providers fail, `data-generator.ts` produces minimal flashcards/quizzes from the source text directly.

## Project Structure

```
├── app/
│   ├── api/                     # 11 API routes
│   │   ├── chat/                # AI tutor chat
│   │   ├── upload/              # File upload handler
│   │   ├── generate-notes/      # Note generation
│   │   ├── generate-flashcards/ # Flashcard generation
│   │   ├── generate-quiz/       # Quiz generation
│   │   ├── generate-podcast/    # Podcast script generation
│   │   ├── generate-video-notes/# YouTube → notes
│   │   ├── process-link/        # YouTube/web link extraction
│   │   ├── transcribe-audio/    # Whisper transcription
│   │   ├── text-to-speech/      # Piper + Azure TTS
│   │   └── web-search/          # Web search
│   ├── app/                     # Dashboard (main app shell)
│   ├── note/[id]/[section]/     # Note detail routes
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Tailwind v4 + theme vars
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── panels/                  # Learning hub panels
│   │   ├── note-panel.tsx       # Note viewer/editor
│   │   ├── flashcards-panel.tsx # Flashcard browser
│   │   ├── quizzes-panel.tsx    # Quiz player
│   │   ├── podcast-panel.tsx    # Podcast reader
│   │   └── chat-panel.tsx       # Per-note chat
│   ├── dialogs/                 # Document creation dialogs
│   ├── zenius-shell.tsx         # Navigation shell (5-tab layout)
│   └── learning-hub-view.tsx    # Learning hub orchestrator
├── lib/
│   ├── ai.ts                    # Multi-provider AI (Cerebras, Mistral, xAI, Gemini, HF)
│   ├── ai-models.ts             # Model name tables
│   ├── zenius-prompts.ts        # System prompt builder
│   ├── note-context.tsx         # Global state + localStorage persistence
│   ├── data-generator.ts        # AI-calling helpers for flashcards/quizzes
│   └── utils.ts                 # Shared utilities
├── voices/                      # Piper TTS voice models (.onnx + .json)
├── proxy.ts                     # Security headers (CSP, HSTS, XSS, etc.)
├── capacitor.config.ts          # Capacitor mobile config
├── scripts/
│   └── youtube-extractor.py     # yt-dlp wrapper for transcript extraction
└── package.json
```

## Mobile Build (Capacitor)

```bash
npx cap add android          # one-time setup
export CAP_SERVER_URL="https://your-deployed-url.com"
npm run mobile:sync
npm run mobile:open:android
```

The app uses Next.js server routes, so the mobile shell must load a hosted instance.
