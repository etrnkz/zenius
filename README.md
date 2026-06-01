# Zenius

<p align="center">
  <img src="study.svg" alt="Zenius" width="160" />
</p>

<p align="center">
  <strong>AI-powered learning platform.</strong><br />
  Upload any study material — get notes, flashcards, quizzes, podcasts, and a tutor.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#api-reference">API</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#project-structure">Structure</a>
</p>

---

## Features

### Document Processing
Upload PDF, DOCX, or PPTX files. Content is extracted with automatic garbage filtering — slide numbers, page numbers, TOC entries, nav text, and filler are stripped before AI processing.

### Audio & Video
- **Transcription** — Upload audio files; transcribed via Whisper (Groq API)
- **YouTube** — Paste a YouTube link; extracts transcript and metadata
- **Text-to-Speech** — Converts notes and scripts to natural speech via Piper (local) or Azure Speech Services

### AI Generation
All generation uses a multi-tier AI fallback: Cerebras → Mistral → xAI → Gemini → HuggingFace. Only providers with configured API keys are called.

| Feature | What it does |
|---------|-------------|
| **Smart Notes** | Raw material → organized, exam-focused study notes |
| **Flashcards** | Auto-generated Q&A cards for spaced repetition |
| **Quizzes** | Multiple-choice questions with 4 options, one correct answer |
| **Podcasts** | Conversational audio scripts from any source |

### AI Tutor Chat
Context-aware Q&A that references your uploaded material. Responds like a helpful senior student — direct answers first, then clarification. Retains conversation history during a session.

### UI
- Dark-themed, responsive, tab-based navigation
- 5 tabs: Home, Search, Files, Chat, Library
- Learning hub with per-note panels: Notes, Flashcards, Quizzes, Podcast
- LocalStorage persistence for notes and user profile

---

## Quick Start

```bash
npm install
cp .env.example .env.local    # add your API keys
npm run dev                    # → http://localhost:3000
```

### Prerequisites
- Node.js ≥ 18
- At least one AI provider API key (see [Configuration → AI Providers](#ai-providers))

---

## Usage

### Web App

1. **Open the app** — Navigate to `/app` (or click "Open App" on the landing page)
2. **Create a note** — Tap the + button → choose **Blank document**, **Upload file**, or **Paste link**
   - Supported uploads: PDF, DOCX, PPTX, audio files
   - Links: YouTube videos or web pages (content is extracted via yt-dlp)
3. **Enter the learning hub** — Tap any note card to open it
4. **Study** — Use the tabs inside the hub:
   - **Notes** — View AI-generated notes; re-generate or download
   - **Flashcards** — Browse auto-generated cards; flip to check answers
   - **Quizzes** — Take a multiple-choice quiz; see your score
   - **Podcast** — Read or listen to the generated podcast script
5. **Chat** — Ask the AI tutor questions. It has full context of your current note

### Navigation

| Tab | Description |
|-----|-------------|
| **Home** | Recent notes grid, quick-action buttons (Upload, Link, Audio) |
| **Search** | Full-text search across all notes |
| **Files** | File browser — tap any file to open in the Universal Doc Viewer |
| **Chat** | Global AI tutor (no note context — general Q&A) |
| **Library** | All notes organized by subject/type |

### Key Shortcuts
- Tap a note to enter its learning hub
- Swipe or tap tabs to switch between Notes, Flashcards, Quizzes, Podcast
- Back button returns to the dashboard

---

## API Reference

All API routes accept `POST` requests. Authentication: none (client-side keys are used server-side).

### `/api/chat`
Interactive AI tutor. Context-aware if `context` is provided.

```json
// POST /api/chat
{ "message": "Explain quantum entanglement", "context": "optional note text" }
→ { "response": "..." }
```

### `/api/upload`
Upload a file. Returns a signed URL and metadata.

```
// POST /api/upload (multipart/form-data)
file: <binary>
→ { "success": true, "file": { "name": "...", "size": 123, "type": "...", "url": "..." } }
```

### `/api/generate-notes`
Transform source content into structured study notes.

```json
// POST /api/generate-notes
{ "content": "...", "title": "optional title" }
→ { "success": true, "notes": "..." }
```

### `/api/generate-flashcards`
Generate Q&A flashcards. Optional `count`, `flashcardStyle`.

```json
// POST /api/generate-flashcards
{ "content": "...", "title": "...", "count": 10, "flashcardStyle": "detailed" }
→ { "success": true, "flashcards": [{ "front": "...", "back": "..." }] }
```

### `/api/generate-quiz`
Generate multiple-choice questions (4 options each).

```json
// POST /api/generate-quiz
{ "content": "...", "title": "...", "count": 5 }
→ { "success": true, "questions": [{ "question": "...", "options": [...], "correct": 0 }] }
```

### `/api/generate-podcast`
Generate a spoken-word podcast script from source content.

```json
// POST /api/generate-podcast
{ "content": "...", "title": "..." }
→ { "success": true, "script": "..." }
```

### `/api/transcribe-audio`
Transcribe an audio file using Groq Whisper.

```
// POST /api/transcribe-audio (multipart/form-data)
audio: <binary>
→ { "success": true, "transcript": "..." }
```

### `/api/process-link`
Extract content from a URL (YouTube or web page).

```json
// POST /api/process-link
{ "url": "https://youtube.com/watch?v=..." }
→ { "success": true, "type": "youtube", "content": "...", "title": "..." }
```

### `/api/text-to-speech`
Convert text to spoken audio. Requires [Piper TTS](https://github.com/rhasspy/piper) or Azure Speech.

```json
// POST /api/text-to-speech
{ "text": "...", "language": "english" }
→ Audio stream (audio/wav or audio/mpeg)
```

### `/api/generate-video-notes`
Extract YouTube transcript and generate notes in one call.

```json
// POST /api/generate-video-notes
{ "url": "https://youtube.com/watch?v=..." }
→ { "success": true, "notes": "..." }
```

### `/api/web-search`
Web search (requires configured AI provider).

```json
// POST /api/web-search
{ "query": "mitochondria function" }
→ { "success": true, "results": [...] }
```

---

## Configuration

### AI Providers

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

### Piper TTS

Piper is a local, open-source text-to-speech engine. Configure via env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `PIPER_BIN` | `piper` | Path to Piper binary |
| `PIPER_MODEL` | — | Path to `.onnx` voice model (e.g. `voices/en_US-lessac-medium.onnx`) |
| `PIPER_CONFIG` | — | Path to model config `.json` |
| `AZURE_SPEECH_KEY` | — | Fallback TTS (Azure Speech Services) |
| `AZURE_SPEECH_REGION` | — | Azure region |

Voice models go in `voices/`. The repo includes `en_US-lessac-medium` by default.

### Limits

| Limit | Value |
|-------|-------|
| TTS input | 2,800 characters |
| Note generation source | 60,000 characters |
| Podcast source | 40,000 characters |
| TTS request timeout | 45 seconds |
| Quiz questions per request | 5 (default) |

---

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

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

### Environment

Copy `.env.example` to `.env.local` (or `.env`). Both are gitignored.

```bash
# Minimal setup — one AI provider is enough
GEMINI_API_KEY=your_key_here
```

### Mobile Build (Capacitor)

```bash
npx cap add android          # one-time setup
export CAP_SERVER_URL="https://your-deployed-url.com"
npm run mobile:sync
npm run mobile:open:android
```

The app uses Next.js server routes, so the mobile shell must load a hosted instance.

---

## Architecture Notes

- **AI fallback chain**: Each provider is tried in order; if it fails or returns empty, the next is attempted. Only providers with configured API keys are included.
- **Runtime**: Three API routes (`text-to-speech`, `process-link`, `generate-video-notes`) use `runtime = 'nodejs'` (child_process, fs). All others use the default Edge runtime.
- **State**: Notes and user profile persist in `localStorage` under `zenius_notes` and `zenius_profile` keys. No backend database.
- **Offline fallback**: If all AI providers fail, `data-generator.ts` produces minimal flashcards/quizzes from the source text directly.

---

## Credits

Built by **Semeriya Seid** (Suda). Licensed for educational and personal use. See `package.json` for the full dependency list.

---

<p align="center">
  <em>Zenius — Your intelligent AI tutor for smarter learning</em>
</p>
