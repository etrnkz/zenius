# Zenius

<p align="center">
  <img src="public/images/logo.svg" alt="Zenius" width="160" />
</p>

<p align="center">
  <strong>AI-powered learning platform.</strong><br />
  Upload any study material — PDFs, DOCX, PPTX, audio, YouTube links, or web articles. Zenius automatically extracts the content and transforms it into smart notes, flashcards, quizzes, study podcasts, and an interactive AI tutor. All in one place, no account required.
</p>

---

## Table of Contents

| # | Section | |
|---|---------|--|
| 1 | [Features](#features) | AI generation, document processing, audio/video, tutor chat, UI |
| 2 | [Quick Start](#quick-start) | Installation, prerequisites, dev server |
| 3 | [Usage](#usage) | Web app walkthrough, navigation tabs |
| 4 | [Development](#development) | Commands, docs links |
| 5 | [Credits](#credits) | Author, license |

---

<details>
<summary><strong>Features</strong></summary>

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

</details>

---

<details>
<summary><strong>Quick Start</strong></summary>

```bash
npm install
cp .env.example .env.local    # add your API keys
npm run dev                    # → http://localhost:3000
```

### Prerequisites
- Node.js ≥ 18
- At least one AI provider API key (see [docs/configuration.md](docs/configuration.md))

</details>

---

<details>
<summary><strong>Usage</strong></summary>

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

</details>

---

<details>
<summary><strong>Development</strong></summary>

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

See [docs/configuration.md](docs/configuration.md) for environment setup, [docs/architecture.md](docs/architecture.md) for mobile builds and project structure, and [docs/api.md](docs/api.md) for the full API reference.

</details>

---

<details>
<summary><strong>Credits</strong></summary>

Built by **Semeriya Seid** (Suda). Licensed for educational and personal use. See `package.json` for the full dependency list.

</details>

---

<p align="center">
  <em>Zenius — Your intelligent AI tutor for smarter learning</em>
</p>
