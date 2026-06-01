# Zenius

<p align="center">
  <img src="public/images/logo.svg" alt="Zenius" width="160" />
</p>

<p align="center">
  <strong>Your AI study buddy.</strong><br />
  Throw any study material at it — PDFs, DOCX, PPTX, audio recordings, YouTube videos, or web articles. Zenius rips out the important bits and turns them into notes, flashcards, quizzes, podcast-style summaries, and a tutor that actually knows what you're studying. No sign-up needed.
</p>

---

## Contents

| # | Section | |
|---|---------|--|
| 1 | [Features](#features) | AI generation, document processing, audio/video, tutor chat, UI |
| 2 | [Quick Start](#quick-start) | Install, configure, run |
| 3 | [Usage](#usage) | How everything works |
| 4 | [Development](#development) | Commands, docs |
| 5 | [Credits](#credits) | Who built this |

---

<details>
<summary><strong>▸ Features</strong></summary>

### Document Processing
Drop in PDFs, DOCX, or PPTX files. Zenius strips out the noise — page numbers, slide numbers, table of contents, nav text, filler — and keeps only what matters.

### Audio & Video
- **Transcription** — Upload audio; Whisper (Groq API) turns it into text
- **YouTube** — Paste a link; Zenius grabs the transcript and metadata
- **Text-to-Speech** — Listen to your notes or podcast scripts via Piper (local) or Azure Speech Services

### AI Generation
Powered by a multi-provider fallback chain: Cerebras → Mistral → xAI → Gemini → HuggingFace. Only the providers you configure get called.

| Feature | What it does |
|---------|-------------|
| **Smart Notes** | Raw content → clean, exam-ready study notes |
| **Flashcards** | Auto-generated Q&A for spaced repetition |
| **Quizzes** | Multiple-choice questions (4 options, one right answer) |
| **Podcasts** | Conversational audio scripts from any source |

### AI Tutor Chat
Context-aware. Drop it in a note and it knows exactly what you're studying. Answers like a helpful senior — straight to the point, with clarifications when you need them. Conversation history sticks around for the session.

### UI
- Dark theme, responsive, tab-based navigation
- Five tabs: Home, Search, Files, Chat, Library
- Per-note learning hub with separate panels for Notes, Flashcards, Quizzes, Podcast
- Everything persists in localStorage — your data stays on your machine

</details>

---

<details>
<summary><strong>▸ Quick Start</strong></summary>

```bash
npm install
cp .env.example .env.local    # drop in your API keys
npm run dev                    # opens at http://localhost:3000
```

### Prerequisites
- **Node.js** ≥ 18
- At least **one AI provider API key** (see [docs/configuration.md](docs/configuration.md))

</details>

---

<details>
<summary><strong>▸ Usage</strong></summary>

### Web App

1. **Open the app** — Head to `/app` or click "Open App" on the landing page
2. **Create a note** — Tap **+** and choose **Blank document**, **Upload file**, or **Paste link**
   - Uploads: PDF, DOCX, PPTX, audio files
   - Links: YouTube videos or web pages (content extracted via yt-dlp)
3. **Enter the learning hub** — Tap any note card to open it
4. **Study your way** — Use the tabs inside the hub:
   - **Notes** — View or re-generate AI notes; download them
   - **Flashcards** — Browse cards, flip to check answers
   - **Quizzes** — Take a quiz, see your score
   - **Podcast** — Read or listen to the generated podcast script
5. **Chat** — Ask the AI tutor anything. It has full context of your current note

### Navigation

| Tab | What's there |
|-----|-------------|
| **Home** | Recent notes grid, quick actions (Upload, Link, Audio) |
| **Search** | Full-text search across all your notes |
| **Files** | File browser — tap to open in the Universal Doc Viewer |
| **Chat** | Global AI tutor (no note context — general Q&A) |
| **Library** | Every note, organized by subject and type |

</details>

---

<details>
<summary><strong>▸ Development</strong></summary>

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | Check code with ESLint |

Want the full picture? Check out:
- [Configuration & environment](docs/configuration.md)
- [Architecture & project structure](docs/architecture.md)
- [API reference](docs/api.md)

</details>

---

<details>
<summary><strong>▸ Credits</strong></summary>

Original author is **Semeriya Seid** (Hadi).  
Forked from [study-helper-ai](https://github.com/semeriyaseid/study-helper-ai) by **Semeriya Seid(Sud)**.  
Original work — all credit goes there.

</details>

---

<p align="center">
  <em>Zenius — learn smarter, not harder</em>
</p>
