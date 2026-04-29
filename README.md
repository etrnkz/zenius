# Zenius - AI Learning Platform

<p align="center">
  <img src="study.svg" alt="Zenius Logo" width="200" />
</p>

<p align="center">
  <strong>Your intelligent AI tutor for smarter learning</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#api-routes">API Routes</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#credits">Credits</a>
</p>

---

## Overview

Zenius is an AI-powered learning platform designed to help students learn more effectively across multiple study modalities. It transforms various study materials (PDFs, documents, audio files, YouTube videos, web links) into interactive learning tools including AI-generated notes, flashcards, quizzes, podcasts, and an intelligent chat tutor.

The platform was created by **Semeriya Seid** (also known as Suda) to provide students with a comprehensive, AI-driven study assistant that adapts to different learning styles.

---

## Features

### 📄 Document Processing
- **PDF Upload**: Extract and process content from PDF files
- **DOCX Support**: Parse Microsoft Word documents
- **PPTX Support**: Handle PowerPoint presentations
- **Text Extraction**: Intelligent content extraction with garbage filtering (slide numbers, page numbers, TOC entries)

### 🎙️ Audio Processing
- **Audio Transcription**: Convert audio files to text using Whisper API
- **YouTube Integration**: Extract transcripts from YouTube videos
- **Text-to-Speech**: Generate audio from text using:
  - Piper (local TTS engine with multiple language support)
  - Azure Speech Services (as fallback)

### 📝 AI-Generated Content
- **Smart Notes**: Transform study materials into clear, exam-focused notes
- **Flashcards**: Auto-generate flashcards for memorization
- **Quiz Generation**: Create multiple-choice questions for self-testing
- **Podcast Scripts**: Convert study materials into engaging audio lesson scripts

### 💬 AI Chat Tutor
- Interactive chat interface for asking questions about study materials
- Context-aware responses that prioritize uploaded content
- Friendly, encouraging personality (like a helpful senior student)
- Explains complex topics in simple language

### 🎨 User Interface
- Modern, dark-themed UI with clean aesthetics
- Responsive design for all device sizes
- Smooth animations and transitions
- Multiple content tabs (Notes, Chat, Flashcards, Quizzes, Podcast)

---

## Tech Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.1.6 | React framework with App Router |
| [React](https://react.dev/) | 19.2.4 | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.7.3 | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | 4.1.9 | Styling |

### UI Components
| Library | Version | Purpose |
|---------|---------|---------|
| [Radix UI](https://www.radix-ui.com/) | 1.x | Accessible UI primitives |
| [Lucide React](https://lucide.dev/) | 0.564.0 | Icon library |
| [Shadcn/ui](https://ui.shadcn.com/) | - | Component collection |
| [Recharts](https://recharts.org/) | 2.15.0 | Charts (if needed) |
| [Embla Carousel](https://www.embla-carousel.com/) | 8.6.0 | Carousel component |

### AI & ML
| Service | Purpose |
|---------|---------|
| [Groq](https://groq.com/) | Optional: Whisper transcription (`GROQ_API_KEY` in `/api/transcribe-audio`) |
| [Gemini](https://gemini.google.com/) | Fallback LLM |
| [HuggingFace](https://huggingface.co/) | Last fallback + TTS models |
| [Whisper](https://openai.com/index/whisper/) | Audio transcription |
| [Piper](https://github.com/rhasspy/piper) | Local TTS engine |

### Data Processing
| Library | Purpose |
|---------|---------|
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) | PDF parsing |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | DOCX parsing |
| [pptx-parser](https://www.npmjs.com/package/pptx-parser) | PPTX parsing |
| [JSZip](https://stuk.github.io/jszip/) | ZIP file handling |

### Other Dependencies
| Library | Purpose |
|---------|---------|
| [Zod](https://zod.dev/) | Schema validation |
| [React Hook Form](https://react-hook-form.com/) | Form handling |
| [date-fns](https://date-fns.org/) | Date utilities |
| [Sonner](https://sonner.emilkowal.ski/) | Toast notifications |
| [Vaul](https://vaul.emilkowal.ski/) | Drawer component |
| [Next Themes](https://github.com/pacocoursey/next-themes) | Dark/light mode |
| [Vercel Analytics](https://vercel.com/analytics) | Analytics |

---

## Getting Started

### Prerequisites

Before running the project, ensure you have:

1. **Node.js** (v18 or higher)
2. **pnpm** (recommended) or npm/yarn
3. **API Keys** (see Environment Variables section)

### Installation

```bash
# Clone the repository
cd study-helper-ai

# Install dependencies
pnpm install

# Or using npm
npm install
```

### Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The application will be available at `http://localhost:3000`

### Mobile App (Capacitor)

This project can run as a native mobile shell (Android/iOS) using Capacitor.

```bash
# 1) Install native platforms once
npx cap add android
npx cap add ios

# 2) Point Capacitor to your deployed Next.js URL
# Linux/macOS:
export CAP_SERVER_URL="https://your-domain.com"

# 3) Sync web/native config
npm run mobile:sync

# 4) Open the native project
npm run mobile:open:android
npm run mobile:open:ios
```

Notes:
- The app uses Next.js server routes, so mobile should load a hosted URL via `CAP_SERVER_URL`.
- `GROQ_API_KEY` is only used for `/api/transcribe-audio` (Whisper).

### Linting

```bash
# Run ESLint
pnpm lint
```

---

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# AI API keys (at least one required). Fallback order:
# Cerebras → Mistral → xAI → Gemini → HuggingFace

# Cerebras — Llama 3.1 8B/70B (https://cloud.cerebras.ai/)
# CEREBRAS_API_KEY=
# CEREBRAS_MODEL=llama3.1-8b            # or llama3.1-70b — see lib/ai-models.ts

# Mistral AI — Mistral 7B, Mixtral (https://console.mistral.ai/)
# MISTRAL_API_KEY=
# MISTRAL_MODEL=open-mixtral-8x7b     # or open-mistral-7b, mistral-small-latest

# xAI Grok
XAI_API_KEY=your_xai_api_key
# GROK_API_KEY=your_xai_api_key       # Optional alias for XAI key only (not Groq Cloud)
# XAI_MODEL=grok-4.20-reasoning

GEMINI_API_KEY=your_gemini_api_key

# Optional: Groq Whisper only (audio transcription — not used for chat/notes)
# GROQ_API_KEY=

HF_API_KEY=your_hf_api_key            # Optional + TTS (alias: HUGGINGFACE_API_KEY)

# Optional: Azure Speech (for TTS fallback)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
```

### Getting API Keys

1. **Cerebras**: https://cloud.cerebras.ai/ — set `CEREBRAS_MODEL` to a supported ID (see `lib/ai-models.ts`)
2. **Mistral**: https://console.mistral.ai/ — `MISTRAL_MODEL` presets in `lib/ai-models.ts`
3. **xAI (Grok)**: https://console.x.ai/ — `XAI_API_KEY`
4. **Gemini**: https://aistudio.google.com/app/apikey
5. **Groq** (optional): https://console.groq.com/ — `GROQ_API_KEY` for **audio transcription** only (`/api/transcribe-audio`)
6. **HuggingFace** (optional): https://huggingface.co/settings/tokens
7. **Azure** (optional TTS): https://azure.microsoft.com/services/cognitive-services/speech-services/

Use **`.env.local`** (recommended) or **`.env`** in the project root. Both are loaded by Next.js; keep real keys out of git (`.env` and `.env*.local` are ignored).

Model name tables for Cerebras / Mistral live in **`lib/ai-models.ts`** — copy an ID into `CEREBRAS_MODEL` or `MISTRAL_MODEL` as needed.

---

## API Routes

The application provides the following API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | AI chat tutor for Q&A |
| `/api/upload` | POST | Upload and process files |
| `/api/generate-notes` | POST | Generate AI notes from content |
| `/api/generate-flashcards` | POST | Generate flashcards |
| `/api/generate-quiz` | POST | Generate quiz questions |
| `/api/generate-podcast` | POST | Generate podcast script |
| `/api/transcribe-audio` | POST | Transcribe audio files |
| `/api/process-link` | POST | Process YouTube/web links |
| `/api/text-to-speech` | POST | Convert text to speech |

### Detailed API Documentation

#### `/api/chat`
- **Purpose**: Interactive AI tutor for asking questions
- **Input**: `{ message: string, context?: string }`
- **Output**: `{ response: string }`

#### `/api/upload`
- **Purpose**: Upload files for processing
- **Input**: Form data with `file` field
- **Output**: `{ success: true, file: { name, size, type, url } }`

#### `/api/generate-notes`
- **Purpose**: Transform study content into exam-focused notes
- **Input**: `{ content: string, title?: string }`
- **Output**: `{ success: true, notes: string }`

#### `/api/generate-flashcards`
- **Purpose**: Create study flashcards
- **Input**: `{ content: string, title?: string, count?: number, flashcardStyle?: string }`
- **Output**: `{ success: true, flashcards: Array<{ front, back }> }`

#### `/api/generate-quiz`
- **Purpose**: Generate multiple-choice questions
- **Input**: `{ content: string, title?: string, count?: number }`
- **Output**: `{ success: true, questions: Array<{ question, options, correct }> }`

#### `/api/generate-podcast`
- **Purpose**: Create audio lesson scripts
- **Input**: `{ content: string, title?: string }`
- **Output**: `{ success: true, script: string }`

#### `/api/transcribe-audio`
- **Purpose**: Convert audio to text
- **Input**: Form data with `audio` field
- **Output**: `{ success: true, transcript: string }`

#### `/api/process-link`
- **Purpose**: Extract content from URLs (YouTube, web)
- **Input**: `{ url: string }`
- **Output**: `{ success: true, type, content, title }`

#### `/api/text-to-speech`
- **Purpose**: Convert text to audio
- **Input**: `{ text: string, language?: string }`
- **Output**: Audio file stream

---

## Project Structure

```
study-helper-ai/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── chat/                 # AI chat endpoint
│   │   ├── extract-docx/         # DOCX extraction
│   │   ├── extract-pdf/          # PDF extraction
│   │   ├── generate-flashcards/  # Flashcard generation
│   │   ├── generate-notes/       # Notes generation
│   │   ├── generate-podcast/     # Podcast script generation
│   │   ├── generate-quiz/        # Quiz generation
│   │   ├── process-link/         # Link processing
│   │   ├── text-to-speech/       # TTS endpoint
│   │   ├── transcribe-audio/     # Audio transcription
│   │   └── upload/               # File upload
│   ├── note/                     # Note detail pages
│   │   └── [id]/[section]/       # Dynamic note sections
│   ├── settings/                 # Settings page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
├── components/                   # React components
│   ├── ui/                       # Shadcn/ui components
│   ├── create-dialogs.tsx        # Document creation dialogs
│   ├── theme-provider.tsx        # Theme provider
│   └── webinar-illustration.tsx  # Illustration component
├── hooks/                        # Custom React hooks
│   ├── use-mobile.ts             # Mobile detection
│   └── use-toast.ts              # Toast notifications
├── lib/                          # Utility libraries
│   ├── ai.ts                     # AI integration (Cerebras, Mistral, xAI, Gemini, HuggingFace)
│   ├── data-generator.ts         # Content generation utilities
│   ├── note-context.tsx          # Note state management
│   ├── utils.ts                  # General utilities
│   └── m.txt                     # System prompts
├── piper/                        # Piper TTS engine
│   ├── piper                     # Main executable
│   ├── libespeak-ng.so           # eSpeak library
│   ├── libonnxruntime.so         # ONNX runtime
│   ├── libpiper_phonemize.so     # Phonemization library
│   ├── libtashkeel_model.ort     # TTS model
│   └── espeak-ng-data/           # Language dictionaries
├── public/                       # Static assets
├── package.json                  # Dependencies
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── next.config.mjs               # Next.js configuration
├── postcss.config.mjs            # PostCSS configuration
└── README.md                     # This file
```

---

## Key Features Implementation

### AI Integration (`lib/ai.ts`)
The AI system uses a multi-tier fallback strategy (only providers with API keys are used), for example:
1. **Cerebras / Mistral / xAI** (when configured)
2. **Gemini**: Google's AI
3. **Last resort**: HuggingFace models

All AI calls include:
- Source fidelity checks (only use provided content)
- Garbage filtering (slide numbers, TOC, etc.)
- Quality over quantity principles
- Plain text output (no markdown unless requested)

### Note Management (`lib/note-context.tsx`)
- React Context for global state
- Supports multiple note types: document, PDF, audio, link
- Stores metadata: file size, duration, word count, etc.
- Tab-based navigation: Notes, Chat, Flashcards, Quizzes, Podcast

### File Processing
- **PDF**: Uses pdfjs-dist for parsing
- **DOCX**: Uses mammoth for text extraction
- **PPTX**: Uses pptx-parser for slide content
- **Audio**: Converts to base64 for storage/transcription

### Text-to-Speech (`app/api/text-to-speech/route.ts`)
- **Primary**: Piper (local, open-source TTS)
  - Multiple language support
  - Fast response times
  - No API costs
- **Fallback**: Azure Speech Services
  - Neural voices
  - High quality output

---

## Design System

### Colors
The application uses a dark theme with the following color palette:
- Background: Dark slate (#06080d)
- Primary: Custom accent colors
- Text: Light gray/slate
- Borders: Subtle white/10

### Typography
- **Font**: Geist (Sans) and Geist Mono
- **Headings**: Bold, clear hierarchy
- **Body**: Readable, comfortable line height

### Components
All UI components are built using Radix UI primitives with custom styling via Tailwind CSS. The component library includes:
- Buttons, Inputs, Textareas
- Dialogs, Drawers, Sheets
- Dropdown Menus, Select
- Tabs, Accordions
- Toast notifications
- And many more...

---

## Development Notes

### TypeScript Configuration
- Strict mode enabled
- ES6 target
- DOM and ESNext libraries
- Bundle module resolution

### Next.js Configuration
- TypeScript ignore build errors enabled (for faster development)
- Image optimization disabled (using external images)
- App Router enabled

### Tailwind Configuration
- CSS variables for theming
- Dark mode via class
- Custom color extensions
- PostCSS for processing

---

## Performance Considerations

1. **File Size Limits**: TTS input limited to 2800 characters
2. **Source Truncation**: Notes limited to 60,000 characters
3. **Podcast Source**: Limited to 40,000 characters
4. **Timeout Handling**: 45-second timeout for TTS requests

---

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure all required environment variables are set
2. **File Upload Fails**: Check file size limits and supported formats
3. **TTS Not Working**: Verify Piper binaries are executable
4. **YouTube Transcript Fails**: Some videos don't have available transcripts

### Getting Help

If you encounter issues:
1. Check the console logs for error messages
2. Verify your API keys are correct and have sufficient quota
3. Ensure the required services are accessible in your region

---

## Credits

### Creator
**Semeriya Seid** (also known as Suda)
- Created Zenius to help students learn more effectively
- Developed the AI integration system
- Built the complete platform

### Open Source Libraries
This project uses many open source libraries. See `package.json` for the complete list.

### AI Models
- Groq (optional Whisper transcription via `GROQ_API_KEY`)
- Google Gemini (LLM)
- Meta Llama / Facebook models (HuggingFace)
- OpenAI Whisper (transcription)
- Piper TTS (local speech synthesis)

---

## License

This project is for educational and personal use. All AI services require their respective terms of service.

---

## Future Enhancements

Potential features to add:
- [ ] User authentication
- [ ] Cloud storage for notes
- [ ] Collaborative study features
- [ ] More language support
- [ ] Mobile app
- [ ] Browser extension

---

<p align="center">
  <strong>Built with ❤️ by Semeriya Seid (Suda)</strong>
</p>

<p align="center">
  <em>Zenius - Your intelligent AI tutor for smarter learning</em>
</p>
