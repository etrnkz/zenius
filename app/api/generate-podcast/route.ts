import { NextRequest, NextResponse } from 'next/server';
import { askTutor, type AskTutorOptions } from '@/lib/ai';
import { buildZeniusSystemPrompt } from '@/lib/zenius-prompts';

const PODCAST_QUALITY_TARGET = 0.78;
const MAX_SOURCE_CHARS = 40000;

const PODCAST_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Educational podcast scriptwriter for Zenius audio lessons, specializing in dialogue format.',
  goals: [
    'Turn study content into an engaging dialogue between two students (a girl named Emma and a boy named Alex) discussing and teaching the material.',
    'Make the conversation feel natural, friendly, and educational.',
    'Help students understand and review the material through a conversational format.',
  ],
  outputRules: [
    'Use plain text only.',
    'Write as a dialogue between Emma (girl) and Alex (boy) - not a lecture.',
    'The script should sound like two friends studying together.',
    'Produce only the podcast script, not notes, quizzes, or meta commentary.',
  ],
  taskRules: [
    'Start with Emma greeting Alex and introducing the topic.',
    'Emma should ask questions like a curious student, Alex should explain like a helpful tutor.',
    'Use natural conversation flow - questions, explanations, agreements, clarifications.',
    'Include recap moments where one of them summarizes what was learned.',
    'Ignore slide numbers, page numbers, empty headings, table-of-contents entries, and navigation text.',
    'Transform bullet-heavy source material into a flowing conversation.',
    'If the source is incomplete, say so briefly rather than inventing missing detail.',
    'End with both agreeing on key takeaways.',
  ],
});

interface PodcastQualityResult {
  score: number;
  issues: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function splitSentences(content: string): string[] {
  return content
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 30);
}

function estimateWordTarget(durationMinutes: number): number {
  // Rough pacing for educational narration.
  return clamp(Math.round(durationMinutes * 130), 390, 1800);
}

function buildPodcastPrompt(
  content: string,
  title: string,
  style: string,
  language: string,
  durationMinutes: number
): string {
  const wordTarget = estimateWordTarget(durationMinutes);

  return `TASK
Create an educational podcast as a DIALOGUE between two students:
- Emma (girl): curious, asks questions, seeks clarification
- Alex (boy): helpful, explains concepts, summarizes

This is NOT a lecture - it's a conversation between friends studying together.

SOURCE
Title: ${title}
Language: ${language}
Target Duration: ${durationMinutes} minutes
Target Word Count: about ${wordTarget} words
Content:
${content}

🎙️ PODCAST SCRIPT FORMAT (Use this exact structure):

EMMA: [greeting and introduction - 1-2 sentences]
ALEX: [welcome and overview - 2-3 sentences]

EMMA: [asks about the topic - "What are we learning today?"]
ALEX: [explains what the chapter is about - big picture overview]

EMMA: [asks first question about a subtopic]
ALEX: [explains the subtopic with 3-5 key points]

EMMA: [asks follow-up question or asks about next topic]
ALEX: [continues explaining with examples]

EMMA: [asks about common mistakes or exam tips]
ALEX: [shares what students often confuse]

EMMA: [asks for a quick recap]
ALEX: [summarizes the main points - 3-5 key takeaways]

EMMA: [closing - thanks Alex and says goodbye]
ALEX: [final encouraging words]

🎵 HOW IT SHOULD SOUND:
- Natural conversation, NOT robotic
- Emma asks questions a real student would ask
- Alex explains clearly like a helpful study buddy
- Short lines, each person speaks 1-3 sentences at a time
- Include "hmm", "oh I see", "got it", "makes sense" for natural flow

⏱️ LENGTH: ${durationMinutes}-25 minutes max for one chapter

CRITICAL RULES:
1. Use ONLY source facts. Never invent.
2. Emma should sound curious, Alex should sound knowledgeable
3. No markdown symbols
4. If detail is missing, state that briefly
5. The dialogue should teach, not just read

Generate the podcast script now:`;
}

function evaluatePodcastQuality(script: string, sourceLength: number): PodcastQualityResult {
  const issues: string[] = [];
  const cleaned = script.trim();

  if (!cleaned) {
    return { score: 0, issues: ['No script generated.'] };
  }

  // Updated section patterns for new dialogue format
  const requiredSections = [
    /^EMMA:/mi,
    /^ALEX:/mi,
  ];

  const emmaLines = (cleaned.match(/^EMMA:/gmi) || []).length;
  const alexLines = (cleaned.match(/^ALEX:/gmi) || []).length;
  const dialogueScore = Math.min(1, (emmaLines + alexLines) / 10) * 0.4;
  
  const hasEmma = /^EMMA:/gmi.test(cleaned);
  const hasAlex = /^ALEX:/gmi.test(cleaned);
  const characterScore = ((hasEmma ? 0.5 : 0) + (hasAlex ? 0.5 : 0)) * 0.3;

  const targetLength = Math.max(700, Math.min(5000, Math.floor(sourceLength * 0.14)));
  const lengthScore = Math.max(0, Math.min(1, cleaned.length / targetLength)) * 0.2;

  const markdownPenalty = /(^|\s)[#*_`]{1,3}|^\s*[-*+]\s+/m.test(cleaned) ? 0.45 : 1;

  const score = dialogueScore + characterScore + lengthScore + (markdownPenalty * 0.1);

  if (!hasEmma || !hasAlex) issues.push('Script should have dialogue between Emma and Alex.');
  if (emmaLines + alexLines < 6) issues.push('Dialogue is too short.');
  if (lengthScore < 0.65) issues.push('Script is too short for source length.');
  if (markdownPenalty < 1) issues.push('Script includes markdown-like symbols.');

  return { score, issues };
}

function ensureSection(raw: string, label: string, fallback: string): string {
  const pattern = new RegExp(`^${label}:\\s*`, 'mi');
  if (pattern.test(raw)) return raw;
  return `${label}:\n${fallback}\n\n${raw}`.trim();
}

function normalizePodcastScript(raw: string): string {
  let script = raw.trim();
  if (!script) return script;

  // Updated section names for new podcast format
  script = ensureSection(script, '5️⃣ QUICK RECAP', 'Review the key concepts from this chapter.');
  script = ensureSection(script, '4️⃣ EXAM FOCUS', 'Focus on understanding the main concepts and their relationships.');
  script = ensureSection(script, '3️⃣ KEY SUBTOPICS', 'The chapter covers several important subtopics from the source material.');
  script = ensureSection(script, '2️⃣ BIG PICTURE OVERVIEW', 'Let me give you an overview of what this chapter covers.');
  script = ensureSection(script, '1️⃣ INTRO', `Welcome to this chapter.`);

  return script;
}

function buildFallbackScript(
  content: string,
  title: string,
  durationMinutes: number,
  language: string
): string {
  const sentences = splitSentences(content);
  const opening = sentences[0] || `Today we're learning about ${title}.`;
  const middle = sentences.slice(1, 8);
  const takeaways = sentences.slice(8, 12);

  const coreLines = middle.length > 0
    ? middle.slice(0, 4).map((line, index) => `${index + 1}. ${line}`)
    : ['1. Let me explain the key concepts from the material.'];

  const takeawayLines = takeaways.length > 0
    ? takeaways.slice(0, 4).map((line, index) => `${index + 1}. ${line}`)
    : ['1. Review the main concepts above.'];

  return [
    '🎙️ PODCAST DIALOGUE',
    '',
    `Chapter: ${title}`,
    `Duration: ${durationMinutes} minutes`,
    `Language: ${language}`,
    '',
    'EMMA: Hey Alex! Ready to study?',
    'ALEX: Hey Emma! Sure, let\'s go through this together.',
    '',
    `EMMA: So what are we learning about ${title}?`,
    `ALEX: Great question! ${opening}`,
    '',
    'EMMA: Got it! Can you explain the main points?',
    'ALEX: Of course! Here are the key things to remember:',
    ...coreLines.map(line => `  ${line}`),
    '',
    'EMMA: That makes sense! Any tips for exams?',
    'ALEX: Definitely! Make sure you understand these concepts well and practice applying them.',
    '',
    'EMMA: Can you quickly recap what we learned?',
    'ALEX: Sure! Here are the main takeaways:',
    ...takeawayLines.map(line => `  ${line}`),
    '',
    'EMMA: Thanks Alex, that really helped!',
    'ALEX: No problem Emma! Keep practicing and you\'ll do great. Good luck!',
    '',
    'END OF EPISODE',
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const content = typeof body?.content === 'string' ? body.content : '';
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled Note';
    const style = typeof body?.style === 'string' && body.style.trim() ? body.style.trim() : 'Default';
    const language = typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : 'English';
    const durationMinutes = clamp(
      Number.isFinite(body?.durationMinutes) ? Math.round(Number(body.durationMinutes)) : 6,
      3,
      12
    );

    if (!content.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const truncatedContent = content.length > MAX_SOURCE_CHARS
      ? `${content.slice(0, MAX_SOURCE_CHARS)}...[content truncated for processing]`
      : content;

    const prompt = buildPodcastPrompt(truncatedContent, title, style, language, durationMinutes);

    const askOptions: AskTutorOptions = {
      systemPrompt: PODCAST_SYSTEM_PROMPT,
      temperature: 0.2,
      maxRetries: 2,
      minLength: 350,
    };

    try {
      const firstDraftRaw = await askTutor(prompt, askOptions);
      const firstDraft = normalizePodcastScript(firstDraftRaw);
      let bestScript = firstDraft;
      let bestQuality = evaluatePodcastQuality(firstDraft, truncatedContent.length);

      if (bestQuality.score < PODCAST_QUALITY_TARGET) {
        const refinePrompt = `${prompt}

REVISION REQUIRED
Current score: ${Math.round(bestQuality.score * 100)}%
Target score: ${Math.round(PODCAST_QUALITY_TARGET * 100)}%
Issues:
${bestQuality.issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

Previous draft:
${firstDraft}

Revise now with same section order and stronger clarity.`;

        try {
          const revisedDraftRaw = await askTutor(refinePrompt, {
            ...askOptions,
            temperature: 0.1,
          });
          const revisedDraft = normalizePodcastScript(revisedDraftRaw);

          const revisedQuality = evaluatePodcastQuality(revisedDraft, truncatedContent.length);
          if (revisedQuality.score > bestQuality.score) {
            bestScript = revisedDraft;
            bestQuality = revisedQuality;
          }
        } catch (refineError) {
          console.error('[app] Podcast refinement attempt failed:', refineError);
        }
      }

      return NextResponse.json({
        success: true,
        script: bestScript,
        qualityScore: Number(bestQuality.score.toFixed(2)),
      });
    } catch (error) {
      console.error('[app] Generate podcast AI fallback:', error);
      return NextResponse.json({
        success: true,
        script: buildFallbackScript(truncatedContent, title, durationMinutes, language),
        warning: 'Podcast generated in backup mode from your source text.',
      });
    }
  } catch (error) {
    console.error('[app] Generate podcast error:', error);
    return NextResponse.json({ error: 'Failed to generate podcast script' }, { status: 500 });
  }
}
