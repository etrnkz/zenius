# API Reference

All API routes accept `POST` requests. Authentication: none (client-side keys are used server-side).

## `/api/chat`
Interactive AI tutor. Context-aware if `context` is provided.

```json
// POST /api/chat
{ "message": "Explain quantum entanglement", "context": "optional note text" }
→ { "response": "..." }
```

## `/api/upload`
Upload a file. Returns a signed URL and metadata.

```
// POST /api/upload (multipart/form-data)
file: <binary>
→ { "success": true, "file": { "name": "...", "size": 123, "type": "...", "url": "..." } }
```

## `/api/generate-notes`
Transform source content into structured study notes.

```json
// POST /api/generate-notes
{ "content": "...", "title": "optional title" }
→ { "success": true, "notes": "..." }
```

## `/api/generate-flashcards`
Generate Q&A flashcards. Optional `count`, `flashcardStyle`.

```json
// POST /api/generate-flashcards
{ "content": "...", "title": "...", "count": 10, "flashcardStyle": "detailed" }
→ { "success": true, "flashcards": [{ "front": "...", "back": "..." }] }
```

## `/api/generate-quiz`
Generate multiple-choice questions (4 options each).

```json
// POST /api/generate-quiz
{ "content": "...", "title": "...", "count": 5 }
→ { "success": true, "questions": [{ "question": "...", "options": [...], "correct": 0 }] }
```

## `/api/generate-podcast`
Generate a spoken-word podcast script from source content.

```json
// POST /api/generate-podcast
{ "content": "...", "title": "..." }
→ { "success": true, "script": "..." }
```

## `/api/transcribe-audio`
Transcribe an audio file using Groq Whisper.

```
// POST /api/transcribe-audio (multipart/form-data)
audio: <binary>
→ { "success": true, "transcript": "..." }
```

## `/api/process-link`
Extract content from a URL (YouTube or web page).

```json
// POST /api/process-link
{ "url": "https://youtube.com/watch?v=..." }
→ { "success": true, "type": "youtube", "content": "...", "title": "..." }
```

## `/api/text-to-speech`
Convert text to spoken audio. Requires [Piper TTS](https://github.com/rhasspy/piper) or Azure Speech.

```json
// POST /api/text-to-speech
{ "text": "...", "language": "english" }
→ Audio stream (audio/wav or audio/mpeg)
```

## `/api/generate-video-notes`
Extract YouTube transcript and generate notes in one call.

```json
// POST /api/generate-video-notes
{ "url": "https://youtube.com/watch?v=..." }
→ { "success": true, "notes": "..." }
```

## `/api/web-search`
Web search (requires configured AI provider).

```json
// POST /api/web-search
{ "query": "mitochondria function" }
→ { "success": true, "results": [...] }
```
