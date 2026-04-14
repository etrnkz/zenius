import { NextRequest, NextResponse } from 'next/server';
import { askTutor, type AskTutorOptions } from '@/lib/ai';
import { buildZeniusSystemPrompt } from '@/lib/zenius-prompts';

const NOTE_QUALITY_TARGET = 0.82;
const MAX_SOURCE_CHARS = 60000;

const NOTE_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Professional academic note-taker for turning study material into understanding-first, exam-focused notes.',
  goals: [
    'Transform source material into clear, review-friendly notes that help students study faster and understand deeper.',
    'Preserve source accuracy while removing noise from PDFs, slides, transcripts, and web content.',
    'Produce notes that feel useful for revision, understanding, self-testing, and quick concept rebuilding.',
  ],
  outputRules: [
    'Use plain text only.',
    'Keep the output specific, organized by concept, and grounded in the source.',
    'If the source is missing details, say "Source does not cover this."',
    'Teach for understanding instead of copying or compressing raw extraction.',
  ],
  taskRules: [
    'For detailed notes, use this exact structure: TOPIC SNAPSHOT, KEY TERMS, MAIN CONCEPTS, DETAILED EXPLANATIONS, EXAMPLES, COMMON CONFUSIONS, QUICK RECAP, SUMMARY, QUIZ PREP.',
    'For short notes, use this exact structure: TOPIC SNAPSHOT, KEY TERMS, MAIN CONCEPTS, EXAMPLES, COMMON CONFUSIONS, QUICK RECAP, SUMMARY, QUIZ PREP.',
    'Ignore slide numbers, page numbers, empty headings, table-of-contents entries, and navigation text.',
    'Combine related points across the source into coherent topics instead of preserving raw source order.',
    'Maintain the user’s meaning when the source is a blank or user-written document.',
    'Highlight exam-relevant ideas, relationships, mechanisms, and common confusions when the source supports them.',
    'Do not copy large source chunks verbatim or produce vague filler sentences.',
    'The Topic Snapshot must read like a mini teacher explanation, not a bullet list or glossary.',
  ],
});

interface NotesQualityResult {
  score: number;
  issues: string[];
}

interface NotesTargets {
  termTarget: number;
  conceptTarget: number;
  detailTarget: number;
  exampleTarget: number;
  summarySentenceTarget: number;
  quizPrepTarget: number;
}

function cleanText(content: string): string {
  return content
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitSentences(content: string): string[] {
  return content
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeLine(sentence))
    .filter((sentence) => sentence.length > 30);
}

function extractTerms(content: string): string[] {
  const words = cleanText(content)
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 4);

  const stopWords = new Set([
    'about', 'after', 'again', 'against', 'because', 'before', 'being', 'between', 'could',
    'every', 'first', 'found', 'further', 'important', 'itself', 'other', 'should', 'their',
    'there', 'these', 'those', 'through', 'under', 'using', 'where', 'which', 'while',
    'slide', 'slides', 'chapter', 'source', 'content', 'document', 'systems', 'modeling',
    'introduction', 'example', 'examples', 'details', 'summary',
  ]);

  const freq: Record<string, number> = {};
  for (const word of words) {
    if (stopWords.has(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([word]) => word);
}

function cleanSentenceForNotes(value: string): string {
  return normalizeLine(
    value
      .replace(/^\[?slide\s+\d+\]?\s*/i, '')
      .replace(/\b\d+\s*$/, '')
      .trim()
  );
}

function extractDefinitionPairs(content: string): Array<{ term: string; definition: string }> {
  const pairs: Array<{ term: string; definition: string }> = [];
  const explicit = content.matchAll(
    /(?:^|\n)\s*(?:[•\-*]|\d+\.)?\s*([A-Za-z][A-Za-z0-9\s()/\-]{2,55})\s*[:\-]\s*([^\n]{18,260})/g
  );
  for (const match of explicit) {
    const term = normalizeLine(match[1] || '');
    const definition = cleanSentenceForNotes(match[2] || '');
    if (!term || !definition) continue;
    if (term.length < 3 || term.length > 70) continue;
    pairs.push({ term, definition });
    if (pairs.length >= 80) break;
  }

  if (pairs.length > 0) {
    const seen = new Set<string>();
    return pairs.filter((item) => {
      const key = item.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const inferred: Array<{ term: string; definition: string }> = [];
  for (const sentence of splitSentences(content)) {
    const match = sentence.match(/^([A-Za-z][A-Za-z0-9\s()/\-]{2,50})\s+(?:is|are|refers to|means)\s+(.{18,220})$/i);
    if (!match) continue;
    inferred.push({
      term: normalizeLine(match[1]),
      definition: cleanSentenceForNotes(match[2]),
    });
    if (inferred.length >= 80) break;
  }
  return inferred;
}

function pickExampleSentences(sentences: string[]): string[] {
  const withExampleSignals = sentences.filter((sentence) =>
    /(for example|for instance|such as|e\.g\.|including|includes|used in)/i.test(sentence)
  );

  if (withExampleSignals.length >= 3) {
    return withExampleSignals.slice(0, 10);
  }

  return [...withExampleSignals, ...sentences].slice(0, 10);
}

type ShortSectionKey =
  | 'snapshot'
  | 'structure'
  | 'terms'
  | 'concepts'
  | 'examples'
  | 'confusions'
  | 'recap'
  | 'summary'
  | 'quizPrep';

interface ParsedShortSections {
  snapshot: string[];
  structure: string[];
  terms: string[];
  concepts: string[];
  examples: string[];
  confusions: string[];
  recap: string[];
  summary: string[];
  quizPrep: string[];
}

function normalizeShortPoint(value: string, maxLen = 160): string {
  const cleaned = cleanSentenceForNotes(
    value
      .replace(/^\s*[•\-*]\s*/, '')
      .replace(/^\s*\d+[.)]\s*/, '')
      .replace(/\s+/g, ' ')
  );
  if (!cleaned) return '';
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 3)}...` : cleaned;
}

function isLowValueFact(line: string): boolean {
  const value = line.trim().toLowerCase();
  if (!value) return true;
  if (value.length < 24) return true;
  if (/^\d+$/.test(value)) return true;
  if (/^slide\s+\d+/.test(value)) return true;
  if (/^showing first \d+ slides/.test(value)) return true;
  if (/^source summary$/.test(value)) return true;
  if (/^word count$/.test(value)) return true;
  if (/^contents\b/.test(value)) return true;
  if (/^chapter\s+\w+\s+object oriented design\s*contents\b/.test(value)) return true;
  if ((value.match(/:/g) || []).length >= 4) return true;
  return false;
}

function dedupeLines(lines: string[], limit: number): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const normalized = normalizeShortPoint(line);
    if (!normalized || isLowValueFact(normalized)) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
}

function extractSourceFacts(content: string, limit = 120): string[] {
  const raw = content
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.!?])\s+|:\s+(?=[A-Z])/))
    .map((line) => normalizeShortPoint(line, 175))
    .filter(Boolean);

  return dedupeLines(raw, limit);
}

function parseShortSections(text: string): ParsedShortSections {
  const sections: ParsedShortSections = {
    snapshot: [],
    structure: [],
    terms: [],
    concepts: [],
    examples: [],
    confusions: [],
    recap: [],
    summary: [],
    quizPrep: [],
  };

  const headingMap: Array<{ pattern: RegExp; key: ShortSectionKey }> = [
    { pattern: /^TOPIC SNAPSHOT:/i, key: 'snapshot' },
    { pattern: /^KEY TERMS:/i, key: 'terms' },
    { pattern: /^MAIN CONCEPTS:/i, key: 'concepts' },
    { pattern: /^EXAMPLES:/i, key: 'examples' },
    { pattern: /^COMMON CONFUSIONS:/i, key: 'confusions' },
    { pattern: /^QUICK RECAP:/i, key: 'recap' },
    { pattern: /^SUMMARY:/i, key: 'summary' },
    { pattern: /^QUIZ PREP:/i, key: 'quizPrep' },
  ];

  let current: ShortSectionKey | null = null;
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingCandidate = line
      .replace(/^\s*[•\-*]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const heading = headingMap.find((entry) => entry.pattern.test(headingCandidate));
    if (heading) {
      current = heading.key;
      continue;
    }

    if (!current) continue;

    if (current === 'snapshot' || current === 'summary') {
      const proseLine = cleanSentenceForNotes(
        line
          .replace(/^\s*[•\-*]\s*/, '')
          .replace(/^\s*\d+[.)]\s*/, '')
      );
      if (proseLine && !isLowValueFact(proseLine)) {
        sections[current].push(proseLine);
      }
      continue;
    }

    const point = normalizeShortPoint(line);
    if (point) {
      sections[current].push(point);
    }
  }

  return sections;
}

function ensureSentenceEnd(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function composeSnapshotBlock(lines: string[], sourceFacts: string[]): string[] {
  const prose = [...lines]
    .map((line) => cleanSentenceForNotes(line))
    .filter((line) => line.length > 24 && !isLowValueFact(line));

  if (prose.length >= 8) {
    return prose.slice(0, 15).map(ensureSentenceEnd);
  }

  const fallbackSentences = splitSentences(sourceFacts.join('. '))
    .map(cleanSentenceForNotes)
    .filter((line) => line.length > 30 && !isLowValueFact(line));

  const merged = dedupeLines([...prose, ...fallbackSentences], 15)
    .map(ensureSentenceEnd);

  return merged.length > 0
    ? merged.slice(0, Math.max(8, Math.min(15, merged.length)))
    : ['Source does not cover this.'];
}

function composeParagraphBlock(lines: string[], fallback: string[]): string {
  const merged = dedupeLines([...lines, ...fallback], 6)
    .map(ensureSentenceEnd);

  if (merged.length === 0) return 'Source does not cover this.';
  return merged.join(' ');
}

function composeShortNotes(
  parsed: ParsedShortSections,
  sourceFacts: string[],
  targets: NotesTargets
): string {
  const structureFacts = sourceFacts.filter((line) =>
    /\b(layer|flow|process|phase|step|architecture|pipeline|interaction|controller|persistence|system|sequence|stage)\b/i.test(line)
  );
  const confusionFacts = sourceFacts.filter((line) =>
    /\b(not|difference|compare|vs|however|whereas|avoid|mistake|confus|incorrect|instead)\b/i.test(line)
  );
  const exampleFacts = sourceFacts.filter((line) =>
    /\b(example|instance|case|application|used in|used for|such as|including)\b/i.test(line)
  );

  const snapshot = composeSnapshotBlock(parsed.snapshot, sourceFacts);

  const structure = dedupeLines(
    [...parsed.structure, ...structureFacts],
    Math.max(4, Math.min(8, targets.detailTarget))
  );

  const terms = dedupeLines(
    [...parsed.terms, ...sourceFacts.filter((line) => /[:\-]/.test(line))],
    Math.max(5, Math.min(12, targets.termTarget))
  );

  const concepts = dedupeLines(
    [...parsed.concepts, ...sourceFacts],
    Math.max(4, Math.min(8, targets.conceptTarget))
  );

  const examples = dedupeLines(
    [...parsed.examples, ...exampleFacts],
    Math.max(2, Math.min(5, targets.exampleTarget + 2))
  );

  const confusions = dedupeLines(
    [...parsed.confusions, ...confusionFacts],
    Math.max(3, Math.min(6, Math.floor(targets.conceptTarget / 2) + 2))
  );

  const recap = dedupeLines(
    [...parsed.recap, ...concepts.slice(0, 5)],
    6
  );

  const summary = composeParagraphBlock(parsed.summary, snapshot.slice(0, 3));
  const quizPrep = dedupeLines(
    [...parsed.quizPrep, ...concepts.slice(0, 3), ...structure.slice(0, 2)],
    Math.max(4, Math.min(6, targets.quizPrepTarget + 1))
  );

  return [
    'TOPIC SNAPSHOT:',
    ...snapshot,
    '',
    'KEY TERMS:',
    ...(terms.length > 0 ? terms.map((line, i) => `${i + 1}. ${line}`) : ['1. Source does not cover this.']),
    '',
    'MAIN CONCEPTS:',
    ...(concepts.length > 0 ? concepts.map((line, i) => `${i + 1}. ${line}`) : ['1. Source does not cover this.']),
    '',
    'EXAMPLES:',
    ...(examples.length > 0 ? examples.map((line, i) => `${i + 1}. ${line}`) : ['1. Source does not cover this.']),
    '',
    'COMMON CONFUSIONS:',
    ...(confusions.length > 0 ? confusions.map((line, i) => `${i + 1}. ${line}`) : ['1. Source does not cover this.']),
    '',
    'QUICK RECAP:',
    ...(recap.length > 0 ? recap.map((line, i) => `${i + 1}. ${line}`) : ['1. Re-read core definitions and relationships.']),
    '',
    'SUMMARY:',
    summary,
    '',
    'QUIZ PREP:',
    ...(quizPrep.length > 0 ? quizPrep.map((line, i) => `${i + 1}. ${line}`) : ['1. Revise the main idea, structure, and examples from the source.']),
  ].join('\n');
}

function deriveTargets(content: string, isShortNotes: boolean = false): NotesTargets {
  const words = cleanText(content).split(/\s+/).filter(Boolean).length;
  
  // For short notes, use smaller targets
  if (isShortNotes) {
    return {
      termTarget: Math.max(5, Math.min(12, Math.floor(words / 110))),
      conceptTarget: Math.max(4, Math.min(8, Math.floor(words / 170))),
      detailTarget: Math.max(4, Math.min(8, Math.floor(words / 145))),
      exampleTarget: Math.max(2, Math.min(5, Math.floor(words / 350))),
      summarySentenceTarget: Math.max(3, Math.min(5, Math.floor(words / 320))),
      quizPrepTarget: Math.max(4, Math.min(6, Math.floor(words / 300))),
    };
  }
  
  return {
    termTarget: Math.max(8, Math.min(24, Math.floor(words / 55))),
    conceptTarget: Math.max(6, Math.min(18, Math.floor(words / 85))),
    detailTarget: Math.max(8, Math.min(24, Math.floor(words / 50))),
    exampleTarget: Math.max(3, Math.min(10, Math.floor(words / 180))),
    summarySentenceTarget: Math.max(5, Math.min(12, Math.floor(words / 180))),
    quizPrepTarget: Math.max(5, Math.min(12, Math.floor(words / 160))),
  };
}

function buildSubjectModeLayer(subject: string): string {
  const normalized = subject.trim().toLowerCase();

  if (/(math|mathematics|algebra|calculus|geometry|trigonometry|statistics)/i.test(normalized)) {
    return `SUBJECT MODE: MATH
When processing math content:
- Focus on derivation logic, not memorization
- Always explain WHY formulas exist
- Break every formula into the meaning of each variable
- Include step-by-step transformations when formulas or derivations appear
- Highlight edge cases and when formulas fail
- Connect ideas to visual or geometric intuition

For examples:
- Include solved step-by-step problems when supported by the source
- Show pattern recognition, not just final answers

Avoid:
- Symbol dumping without meaning`;
  }

  if (/(physics|mechanics|thermodynamics|electricity|magnetism|optics|waves)/i.test(normalized)) {
    return `SUBJECT MODE: PHYSICS
When processing physics content:
- Explain the real-world meaning first
- Convert formulas into physical intuition
- Use cause → effect reasoning
- Break laws into “what changes what”
- Use mental models like motion, forces, energy, and fields

For examples:
- Prefer real-world scenarios over abstract numbers only

Focus on:
- WHY nature behaves this way
- Not just how equations look`;
  }

  if (/(computer science|cs|programming|coding|software|algorithm|data structure|database|operating system|network)/i.test(normalized)) {
    return `SUBJECT MODE: CODING / CS
When processing programming or CS content:
- Always explain problem → logic → solution flow
- Convert concepts into mental models, not syntax memorization
- Include time-complexity intuition when relevant
- Show step-by-step execution tracing
- Compare approaches when the source supports comparison

For examples:
- Include pseudo-code or dry-run style reasoning when supported by the source
- Show input → process → output clearly

Avoid:
- Pure syntax dumping
- Language-specific memorization without logic`;
  }

  return '';
}

function buildNotesPrompt(
  content: string,
  title: string,
  fileType: string,
  targets: NotesTargets,
  isShortNotes: boolean,
  subject: string = ''
): string {
  const subjectModeLayer = buildSubjectModeLayer(subject);
  // For short notes, use a simplified format
if (isShortNotes) {
    return `TASK
Generate detailed study notes from the source with clear sections. Each section must be at least 1000 characters long.

SOURCE:
${content}

Write your own explanation. Use these sections, each at least 1000 chars:

TOPIC SNAPSHOT
Write 1000+ chars explaining what this topic is, why it matters, main concepts, how they connect, mental model.

KEY TERMS
List important terms with explanations. Write 1000+ chars total.

MAIN CONCEPTS
Explain key ideas and why they matter. Write 1000+ chars.

EXAMPLES
Give real examples from source. Write 1000+ chars.

COMMON CONFUSIONS
Explain misunderstandings and corrections. Write 1000+ chars.

QUICK RECAP
Memory triggers. Write 1000+ chars.

SUMMARY
Synthesize the topic. Write 1000+ chars.

QUIZ PREP
Revision prompts. Write 1000+ chars.

IMPORTANT: Each section MUST be at least 1000 characters. Be very detailed.`;
  }

return `TASK
Generate detailed study notes from the source. Each section must be at least 1000 characters.

SOURCE:
${content}

Write your own explanation. Use these sections, each minimum 1000 chars:

TOPIC SNAPSHOT
1000+ chars about topic, importance, concepts, connections, mental model.

KEY TERMS
1000+ chars with terms and explanations.

MAIN CONCEPTS
1000+ chars explaining key ideas and their importance.

DETAILED EXPLANATIONS
1000+ chars on how concepts work in depth.

EXAMPLES
1000+ chars of real examples and applications.

COMMON CONFUSIONS
1000+ chars on misunderstandings and corrections.

QUICK RECAP
1000+ chars of memory triggers.

SUMMARY
1000+ chars synthesizing the topic.

QUIZ PREP
1000+ chars of revision prompts.

IMPORTANT: Every section MUST be at least 1000 characters. Be extremely detailed.`;
}

// Enhanced prompt builder with style and length options
function buildEnhancedPrompt(
  content: string,
  title: string,
  fileType: string,
  subject: string,
  style: string,
  length: string,
  targets: NotesTargets
): string {
  // Style variations
  const styleInstructions: Record<string, string> = {
    concise: 'Keep notes extremely brief and to the point. Each bullet should be 1-2 sentences maximum. Focus on high-yield information only.',
    detailed: 'Provide comprehensive and detailed notes. Include thorough explanations, examples, and edge cases. Be thorough in your coverage.',
    bullet: 'Use only bullet points. No paragraphs. Each point should be a complete idea but kept concise.',
    outline: 'Organize notes in outline format with clear hierarchy. Use main topics and sub-topics.',
    qa: 'Format notes as Question and Answer pairs. Convert information into study-friendly Q&A format.',
  };

  // Length variations - use 1000 chars for more detail
  const lengthInstructions: Record<string, string> = {
    short: 'Keep notes concise but informative - approximately 5-8 main points per section. Each section max 1000 characters total.',
    medium: 'Provide moderate detail - approximately 10-15 main points per section. Each section max 1000 characters. Balance comprehensiveness with conciseness.',
    long: 'Be very thorough and comprehensive - include 15+ main points per section. Each section can use up to 1000 characters. Cover the topic in depth.',
  };

  const styleGuide = styleInstructions[style] || styleInstructions.concise;
  const lengthGuide = lengthInstructions[length] || lengthInstructions.medium;
  const isShortFormat = length === 'short' && style !== 'detailed';

  return `TASK
You are a professional academic note-taker. Extract the source content carefully and create study notes using the understanding-first training system.

SOURCE INFORMATION
Title: "${title}"
${subject ? `Subject: ${subject}` : ''}
Type: ${fileType}
Content:
${content}

STYLE REQUIREMENTS:
${styleGuide}

LENGTH REQUIREMENTS:
${lengthGuide}

OUTPUT FORMAT (Use this exact structure - each section max 1000 characters):
${isShortFormat
? `TOPIC SNAPSHOT:
8-12 connected sentences (max 1000 chars), big idea first, prose only

KEY TERMS:
1. Term: why it matters
(max 1000 chars total)

MAIN CONCEPTS:
1. Core idea + why it matters
(max 1000 chars total)

EXAMPLES:
1. Scenario / process / outcome
(max 1000 chars total)

COMMON CONFUSIONS:
1. Likely mix-up + correction
(max 1000 chars total)

QUICK RECAP:
1. Memory trigger
2. Memory trigger
(max 1000 chars total)

SUMMARY:
3-5 connected sentences (max 1000 chars)

QUIZ PREP:
1. Revision prompt
2. Revision prompt
(max 1000 chars total)`
: `TOPIC SNAPSHOT:
10-15 connected sentences (max 1000 chars), intuitive and understanding-first

KEY TERMS:
1. Term: what it is + why it matters
(max 1000 chars total)

MAIN CONCEPTS:
1. Concept + why it matters
(max 1000 chars total)

DETAILED EXPLANATIONS:
1. How it works + why it works
(max 1000 chars total)

EXAMPLES:
1. Scenario / process / outcome
(max 1000 chars total)

COMMON CONFUSIONS:
1. Concept mix-up + correction
(max 1000 chars total)

QUICK RECAP:
1. Memory trigger
2. Memory trigger
(max 1000 chars total)

SUMMARY:
4-6 connected sentences (max 1000 chars)

QUIZ PREP:
1. Revision prompt
2. Revision prompt
(max 1000 chars total)`}

CRITICAL RULES:
1. Use ONLY facts from the source material - never invent information
2. No markdown symbols (#, *, -, \`) - use plain text
3. Organize by topic/theme, NOT by page or slide order
4. Teach for understanding, not memorization
5. Topic Snapshot must stay as connected prose, not flattened bullets
6. If source lacks information on something, clearly state that
7. Avoid repetition and filler content
8. Remove slide numbers, page numbers, contents text, and empty headings before writing

Generate the study notes now:`;
}

function buildQuizPrepFallback(sentences: string[], terms: string[], target: number): string[] {
  const questions: string[] = [];
  const templates = [
    (term: string, sentence: string, index: number) => `${index + 1}. Explain why "${term}" matters in this topic and relate it to: ${sentence}`,
    (term: string, sentence: string, index: number) => `${index + 1}. Compare "${term}" with a closely related concept from this material using: ${sentence}`,
    (term: string, sentence: string, index: number) => `${index + 1}. Apply "${term}" to a practical case described here: ${sentence}`,
    (term: string, sentence: string, index: number) => `${index + 1}. What mistake could happen if "${term}" is misunderstood in this context: ${sentence}?`,
  ];
  for (let i = 0; i < target; i++) {
    const term = terms[i % Math.max(terms.length, 1)] || 'the main topic';
    const sentence = cleanSentenceForNotes(sentences[i % Math.max(sentences.length, 1)] || 'the provided source content');
    const template = templates[i % templates.length];
    questions.push(template(term, sentence, i));
  }
  return questions;
}

function fallbackNotes(content: string, title: string, targets: NotesTargets, isShortNotes: boolean = false): string {
  const sentences = splitSentences(content).map(cleanSentenceForNotes).filter(Boolean);
  const terms = extractTerms(content);
  const definitionPairs = extractDefinitionPairs(content);
  const examples = pickExampleSentences(sentences);
  const sourceFacts = extractSourceFacts(content, 140);

  // For short notes, use simplified output
  if (isShortNotes) {
    const parsed: ParsedShortSections = {
      snapshot: splitSentences(content).slice(0, 12),
      structure: definitionPairs
        .slice(0, Math.min(6, targets.detailTarget))
        .map((pair) => `${pair.term}: ${shortenToSentence(pair.definition, 130)}`),
      terms: definitionPairs
        .slice(0, Math.min(12, targets.termTarget))
        .map((pair) => `${pair.term}: ${shortenToSentence(pair.definition, 130)}`),
      concepts: sourceFacts.slice(0, Math.max(4, Math.min(8, targets.conceptTarget))),
      examples: examples.slice(0, Math.max(2, Math.min(5, targets.exampleTarget))),
      confusions: sourceFacts
        .filter((line) => /difference|compare|vs|however|whereas|avoid|not|mistake|confus/i.test(line))
        .slice(0, 5),
      recap: sourceFacts.slice(0, 6),
      summary: splitSentences(content).slice(0, Math.max(3, targets.summarySentenceTarget)),
      quizPrep: sourceFacts.slice(0, Math.max(4, Math.min(6, targets.quizPrepTarget))),
    };
    return composeShortNotes(parsed, sourceFacts, targets);
  }
  
  // Original detailed notes fallback
  const concepts = sentences.slice(0, targets.conceptTarget).filter((sentence) => sentence.length > 40);
  const details = sentences.slice(targets.conceptTarget, targets.conceptTarget + targets.detailTarget).filter((sentence) => sentence.length > 40);
  const summarySentences = sentences.slice(0, targets.summarySentenceTarget);

  const keyTermLinesFromPairs = definitionPairs.slice(0, targets.termTarget)
    .map((pair, index) => `${index + 1}. ${pair.term}: ${pair.definition}`);

  const fallbackTermStart = keyTermLinesFromPairs.length;
  const keyTermLinesFromTerms = terms
    .filter((term) => !definitionPairs.some((pair) => pair.term.toLowerCase() === term.toLowerCase()))
    .slice(0, Math.max(0, targets.termTarget - fallbackTermStart))
    .map((term, index) => {
      const supporting = sentences.find((sentence) => sentence.toLowerCase().includes(term.toLowerCase()));
      const definition = supporting
        ? shortenToSentence(supporting, 180)
        : 'Definition not explicit in source text; review related slide context.';
      return `${fallbackTermStart + index + 1}. ${term}: ${definition}`;
    });

  const keyTermLines = [...keyTermLinesFromPairs, ...keyTermLinesFromTerms];
  if (keyTermLines.length === 0) {
    keyTermLines.push('INSUFFICIENT_SOURCE: not enough distinct terms in uploaded text.');
  }

  const conceptLines = concepts.length > 0
    ? concepts.map((concept, index) => `${index + 1}. ${concept}`)
    : ['INSUFFICIENT_SOURCE: source lacks enough conceptual statements for this section.'];

  const detailLines = details.length > 0
    ? details.map((detail, index) => `${index + 1}. ${detail}`)
    : ['INSUFFICIENT_SOURCE: source lacks enough detail for mechanism-level explanations.'];

  const exampleLines = examples.length > 0
    ? examples.slice(0, targets.exampleTarget).map((example, index) => `${index + 1}. ${example}`)
    : ['Not provided in source.'];

  const summaryText = summarySentences.length > 0
    ? summarySentences.join(' ')
    : 'INSUFFICIENT_SOURCE: summary is limited because source text is too short.';

  const quizPrep = buildQuizPrepFallback(sentences, terms, targets.quizPrepTarget);

  return [
    `Study Notes for ${title}`,
    '',
    'KEY TERMS:',
    ...keyTermLines,
    '',
    'MAIN CONCEPTS:',
    ...conceptLines,
    '',
    'DETAILED EXPLANATIONS:',
    ...detailLines,
    '',
    'EXAMPLES:',
    ...exampleLines,
    '',
    'SUMMARY:',
    summaryText,
    '',
    'QUIZ PREP:',
    ...quizPrep,
  ].join('\n');
}

function shortenToSentence(value: string, max = 180): string {
  const clean = cleanSentenceForNotes(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

function evaluateNotesQuality(notes: string, sourceLength: number): NotesQualityResult {
  const issues: string[] = [];
  const cleaned = notes.trim();

  if (!cleaned) {
    return { score: 0, issues: ['No notes text generated.'] };
  }

  const requiredSections = [
    /^TOPIC SNAPSHOT:/mi,
    /^KEY TERMS:/mi,
    /^MAIN CONCEPTS:/mi,
    /^EXAMPLES:/mi,
    /^COMMON CONFUSIONS:/mi,
    /^QUICK RECAP:/mi,
    /^SUMMARY:/mi,
    /^QUIZ PREP:/mi,
  ];

  const sectionHits = requiredSections.filter((pattern) => pattern.test(cleaned)).length;
  const sectionScore = sectionHits / requiredSections.length;

  const targetLength = Math.max(900, Math.min(7000, Math.floor(sourceLength * 0.16)));
  const lengthScore = Math.max(0, Math.min(1, cleaned.length / targetLength));

  const numberedLines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+/.test(line) && line.length >= 24).length;
  const structureScore = Math.max(0, Math.min(1, numberedLines / 20));

  const markdownPenalty = /(^|\s)[#*_`]{1,3}|^\s*[-*+]\s+/m.test(cleaned) ? 0.5 : 1;

  const score =
    (sectionScore * 0.35) +
    (lengthScore * 0.30) +
    (structureScore * 0.25) +
    (markdownPenalty * 0.10);

  if (sectionScore < 1) issues.push('Missing one or more required notes sections.');
  if (lengthScore < 0.7) issues.push('Notes are too short for the source length.');
  if (structureScore < 0.65) issues.push('Too few substantial numbered study points.');
  if (markdownPenalty < 1) issues.push('Output includes markdown-like symbols.');

  return { score, issues };
}

function validateNotesStructure(text: string): { valid: boolean; reason?: string } {
  const requiredSections = [
    /^TOPIC SNAPSHOT:/mi,
    /^KEY TERMS:/mi,
    /^MAIN CONCEPTS:/mi,
    /^EXAMPLES:/mi,
    /^COMMON CONFUSIONS:/mi,
    /^QUICK RECAP:/mi,
    /^SUMMARY:/mi,
    /^QUIZ PREP:/mi,
  ];

  for (const section of requiredSections) {
    if (!section.test(text)) {
      return { valid: false, reason: 'Notes output missed required sections.' };
    }
  }

  if (/^\s*(FRONT:|BACK:|A\)|B\)|C\)|D\))/mi.test(text)) {
    return { valid: false, reason: 'Output looks like flashcards or MCQ format instead of notes.' };
  }

  return { valid: true };
}

// Short notes validation
function validateShortNotesStructure(text: string): { valid: boolean; reason?: string } {
  const requiredSections = [
    /^TOPIC SNAPSHOT:/mi,
    /^KEY TERMS:/mi,
    /^MAIN CONCEPTS:/mi,
    /^EXAMPLES:/mi,
    /^COMMON CONFUSIONS:/mi,
    /^QUICK RECAP:/mi,
    /^SUMMARY:/mi,
    /^QUIZ PREP:/mi,
  ];

  for (const section of requiredSections) {
    if (!section.test(text)) {
      return { valid: false, reason: 'Short notes output missed required sections.' };
    }
  }

  if (/^\s*(FRONT:|BACK:|A\)|B\)|C\)|D\))/mi.test(text)) {
    return { valid: false, reason: 'Output looks like flashcards or MCQ format instead of notes.' };
  }

  return { valid: true };
}

function summarizeAiError(error: unknown): { message: string; noProviderConfigured: boolean } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    message,
    noProviderConfigured: message.includes('No AI API keys configured'),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { content, title, fileType, noteType, subject, style, length } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const trimmedTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Untitled Note';
    const trimmedSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : '';
    const sourceType = typeof fileType === 'string' && fileType.trim() ? fileType.trim() : 'document';
    const noteStyle = typeof style === 'string' && style.trim() ? style.trim() : 'concise';
    const noteLength = typeof length === 'string' && length.trim() ? length.trim() : 'medium';
    const isShortNotes = noteType !== 'detailed';
    const truncatedContent = content.length > MAX_SOURCE_CHARS
      ? `${content.slice(0, MAX_SOURCE_CHARS)}...[content truncated for processing]`
      : content;
    const shortSourceFacts = isShortNotes ? extractSourceFacts(truncatedContent, 180) : [];
    const contentForPrompt = isShortNotes
      ? (shortSourceFacts.join('\n') || truncatedContent)
      : truncatedContent;

    const targets = deriveTargets(truncatedContent, isShortNotes);
    
    // Use enhanced prompt when style or length are specified
    let prompt: string;
    if (style && style !== 'concise' || length && length !== 'medium') {
      prompt = buildEnhancedPrompt(contentForPrompt, trimmedTitle, sourceType, trimmedSubject, noteStyle, noteLength, targets);
    } else {
      prompt = buildNotesPrompt(contentForPrompt, trimmedTitle, sourceType, targets, isShortNotes, trimmedSubject);
    }

    const askOptions: AskTutorOptions = {
      systemPrompt: isShortNotes ? NOTE_SYSTEM_PROMPT + '\nFocus on short, high-yield notes.' : NOTE_SYSTEM_PROMPT,
      temperature: isShortNotes ? 0.1 : 0.15,
      maxRetries: 2,
      minLength: isShortNotes ? 180 : 600,
      forbidMarkdown: true,
      requiredPatterns: isShortNotes ? [
        /^TOPIC SNAPSHOT:/mi,
        /^KEY TERMS:/mi,
        /^MAIN CONCEPTS:/mi,
        /^EXAMPLES:/mi,
        /^COMMON CONFUSIONS:/mi,
        /^QUICK RECAP:/mi,
        /^SUMMARY:/mi,
        /^QUIZ PREP:/mi,
      ] : [
        /^TOPIC SNAPSHOT:/mi,
        /^KEY TERMS:/mi,
        /^MAIN CONCEPTS:/mi,
        /^EXAMPLES:/mi,
        /^COMMON CONFUSIONS:/mi,
        /^QUICK RECAP:/mi,
        /^SUMMARY:/mi,
        /^QUIZ PREP:/mi,
      ],
      validateOutput: isShortNotes ? validateShortNotesStructure : validateNotesStructure,
    };

    if (isShortNotes) {
      try {
        const compactNotesRaw = await askTutor(prompt, askOptions);
        const compactNotes = composeShortNotes(
          parseShortSections(compactNotesRaw),
          shortSourceFacts,
          targets
        );
        return NextResponse.json({
          success: true,
          notes: compactNotes,
          qualityScore: 1,
        });
      } catch (error) {
        const summary = summarizeAiError(error);
        if (summary.noProviderConfigured) {
          console.warn(`[app] Short note generation skipped: ${summary.message}`);
        } else {
          console.error('[app] Short note generation failed:', error);
        }
        return NextResponse.json({
          success: true,
          notes: fallbackNotes(truncatedContent, trimmedTitle, targets, true),
          warning: 'AI service unavailable. Returned compact fallback notes.',
        });
      }
    }

    try {
      const firstDraft = await askTutor(prompt, askOptions);
      let bestNotes = firstDraft;
      let bestQuality = evaluateNotesQuality(firstDraft, truncatedContent.length);

      if (bestQuality.score < NOTE_QUALITY_TARGET) {
        const refinePrompt = `${prompt}

REVISION REQUIRED
Current score: ${Math.round(bestQuality.score * 100)}%
Target score: ${Math.round(NOTE_QUALITY_TARGET * 100)}%
Issues:
${bestQuality.issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

Previous draft:
${firstDraft}

Revise now and return improved notes with the same section order.`;

        try {
          const revisedDraft = await askTutor(refinePrompt, {
            ...askOptions,
            temperature: 0.1,
            maxRetries: 2,
          });

          const revisedQuality = evaluateNotesQuality(revisedDraft, truncatedContent.length);
          if (revisedQuality.score > bestQuality.score) {
            bestNotes = revisedDraft;
            bestQuality = revisedQuality;
          }
        } catch (refineError) {
          console.error('[app] Note refinement attempt failed:', refineError);
        }
      }

      return NextResponse.json({
        success: true,
        notes: bestNotes,
        qualityScore: Number(bestQuality.score.toFixed(2)),
      });
    } catch (error) {
      const summary = summarizeAiError(error);
      if (summary.noProviderConfigured) {
        console.warn(`[app] Note generation skipped: ${summary.message}`);
      } else {
        console.error('[app] Note generation failed:', error);
      }
      return NextResponse.json({
        success: true,
        notes: fallbackNotes(truncatedContent, trimmedTitle, targets, isShortNotes),
        warning: 'AI service unavailable. Returned fallback notes.',
      });
    }
  } catch (error) {
    console.error('[app] Generate notes error:', error);
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 });
  }
}
