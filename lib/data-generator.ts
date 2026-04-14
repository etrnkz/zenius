// Generate study data from note content

import { askTutor } from './ai';
import { buildZeniusSystemPrompt } from './zenius-prompts';

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  answer?: string;
  explanation?: string;
  type?: 'core' | 'process' | 'application' | 'confusion' | 'edge';
  options?: string[];
  correct?: number;
}

const FLASHCARD_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Educational flashcard creator for source-grounded study review.',
  goals: [
    'Create flashcards that help students memorize and understand the actual source material.',
    'Promote deep learning rather than shallow recall.',
    'Return cards that are specific, diverse, and useful in spaced review.',
  ],
  outputRules: [
    'Return a valid JSON array only.',
    'Each item must have "front" and "back" fields.',
    'Do not include markdown or explanation outside the JSON array.',
  ],
  taskRules: [
    'Generate cards only from the provided source material.',
    'Filter out slide numbers, page numbers, empty headings, table-of-contents items, and navigation text.',
    'Keep one concept per card and avoid duplicates or near-duplicates.',
    'Use varied cognitive levels: definition, application, comparison, analysis, and evaluation.',
    'Keep "What is" style cards rare and only when they are genuinely useful.',
    'If the source lacks detail for a card, skip it or say "Source does not provide enough detail."',
  ],
});

const QUIZ_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Expert exam designer who writes high-quality questions that force deep understanding, not memorization.',
  goals: [
    'Generate questions that force the student to THINK and REASON, not just recognize the right answer.',
    'Each question tests understanding of WHY, HOW, and WHAT IF — never surface-level recall.',
    'Questions must read like real exam questions — never reference the source material.',
    'Mix question types so no two questions feel the same.',
  ],
  outputRules: [
    'Return a valid JSON array only.',
    'Each item must be an object with: "question" (string), "options" (array of 4 strings labeled A/B/C/D), "answer" (string - the correct option text), "explanation" (string - brief reasoning).',
    'Every question must have exactly four options and exactly one correct answer.',
    'Do not include markdown or explanation outside the JSON array.',
  ],
  taskRules: [
    'Generate questions ONLY from the provided source material.',
    'Filter out slide numbers, page numbers, empty headings, table-of-contents items, and navigation text.',

    // === CRITICAL HARD BANS ===
    'CRITICAL: NEVER use meta-references like:',
    '  - "Based on the source", "According to the passage", "Based on the material"',
    '  - "In this chapter", "As presented in the text", "In the context of the source"',
    '  - "Which explanation best fits the source?"',
    '  - "A student asks how X is presented in this chapter"',
    '  Questions must be STANDALONE — like real exam questions with no preamble.',

    'CRITICAL: NEVER use "Which statement is correct?", "Which statement best explains...", "Which of the following..." as the main pattern.',
    'CRITICAL: NEVER generate elimination-style questions with "NOT", "EXCEPT", "FALSE".',
    'CRITICAL: NEVER generate recognition-only or definition-only questions.',
    'CRITICAL: NEVER use "All of the above", "None of the above", or "Both A and B".',

    // === REQUIRED QUESTION DISTRIBUTION ===
    'You MUST include a mix of these types:',
    '',
    '1. CORE UNDERSTANDING (2 questions)',
    '   → Ask "Explain in your own words" or "What is happening and why?"',
    '   → Tests whether the student truly grasps the concept',
    '',
    '2. PROCESS / MECHANISM (2 questions)',
    '   → Ask "How does X work step-by-step?" or "What happens if one part changes?"',
    '   → Tests understanding of how things operate',
    '',
    '3. APPLICATION (2 questions)',
    '   → Real-world or scenario-based: "Given this situation, what happens and why?"',
    '   → Tests whether knowledge transfers to new situations',
    '',
    '4. CONFUSION TEST (1–2 questions)',
    '   → Compare similar concepts: "Why is X not the same as Y?"',
    '   → Exposes common misconceptions',
    '',
    '5. EDGE CASE / DEEP THINKING (1 question)',
    '   → "What if…" scenario that forces reasoning beyond memorized content',
    '   → The hardest question — make the student work for it',
    '',
    // === DISTRACTOR QUALITY ===
    'Distractors must be PLAUSIBLE — they should reflect common misconceptions or confusions.',
    'Each wrong option should sound reasonable to someone who does NOT truly understand.',
    'Use the "trap" technique: make the wrong answer look right at first glance but fail on closer inspection.',
    'All options must be similar in length, tone, and style.',
    'Use problem → feature/function reasoning where relevant.',
    'Prioritize WHY this works and WHAT function it serves over pure definition recall.',

    // === EXPLANATION FORMAT ===
    'The explanation should briefly state WHY the correct answer is right.',
    'Use format: "👉 Because [reason]" — short and clear.',

    // === QUALITY CHECK (MANDATORY) ===
    'Before including ANY question, ask:',
    '  • Can they answer this without truly understanding? If yes → the question is WEAK. Rewrite it.',
    '  • Would this expose confusion or gaps in knowledge? If no → rewrite it.',
    '  • Does this test understanding, not memorization? If no → rewrite it.',
    '  • Does the question mention "source", "material", "passage", or "chapter"? If yes → rewrite it.',
    '  • Does the question use "Which statement is correct/best explains"? If yes → rewrite it.',
  ],
});

const MIN_ITEMS = 5;
const MAX_ITEMS = 15;
const QUALITY_TARGET = 0.8;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'before', 'being', 'between', 'could',
  'every', 'first', 'found', 'further', 'important', 'itself', 'other', 'should', 'their',
  'there', 'these', 'those', 'through', 'under', 'using', 'where', 'which', 'while',
  'slide', 'slides', 'chapter', 'source', 'content', 'document', 'section',
  'introduction', 'summary', 'example', 'examples',
]);

function clampItemCount(itemCount?: number): number {
  const safeCount = Number.isFinite(itemCount) ? Math.floor(itemCount as number) : MIN_ITEMS;
  return Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, safeCount));
}

function normalizeWhitespace(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function shorten(value?: string | null, maxLen = 140): string {
  const clean = normalizeWhitespace(value);
  if (!clean) return '';
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 3)}...` : clean;
}

function cleanSentence(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^\[?slide\s+\d+\]?\s*/i, '')
      .replace(/\b\d+\s*$/, '')
      .trim()
  );
}

function cleanText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#.*$/gm, ' ')
    .replace(/\*\*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/^\s*[-*•]\s*/gm, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSentences(content: string): string[] {
  return cleanText(content)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 25);
}

function splitLongSegment(segment: string, maxLen = 170): string[] {
  if (segment.length <= maxLen) return [segment];

  const commaSplit = segment
    .split(/,\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (commaSplit.length <= 1) {
    const words = segment.split(/\s+/);
    const parts: string[] = [];
    let rolling = '';
    for (const word of words) {
      if (!word) continue;
      if (!rolling || rolling.length + word.length + 1 <= maxLen) {
        rolling = rolling ? `${rolling} ${word}` : word;
      } else {
        parts.push(rolling);
        rolling = word;
      }
    }
    if (rolling) parts.push(rolling);
    return parts;
  }

  const parts: string[] = [];
  for (const chunk of commaSplit) {
    parts.push(...splitLongSegment(chunk, maxLen));
  }
  return parts;
}

function getSegments(content: string): string[] {
  const normalized = content
    .replace(/\[Slide\s+\d+\]/gi, '. ')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  const raw = normalized
    .split(/(?<=[.!?])\s+|[;•]\s+|\s-\s/)
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length > 20);

  const segmented = raw.flatMap((segment) => splitLongSegment(segment, 170));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const segment of segmented) {
    const key = segment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
  }
  return unique;
}

function sanitizeTermLabel(raw: string): string | null {
  const cleaned = normalizeWhitespace(
    raw
      .replace(/\[slide\s+\d+\]/gi, ' ')
      .replace(/[“”"']/g, '')
      .replace(/[|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  if (!cleaned) return null;

  const words = cleaned
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9()/-]/gi, ''))
    .filter(Boolean);

  const deduped: string[] = [];
  for (const word of words) {
    if (!deduped.length || deduped[deduped.length - 1].toLowerCase() !== word.toLowerCase()) {
      deduped.push(word);
    }
  }

  if (deduped.length >= 2 && deduped[0].toLowerCase() === deduped[deduped.length - 1].toLowerCase()) {
    deduped.pop();
  }

  if (deduped.length === 0 || deduped.length > 9) return null;
  if (deduped.every((word) => STOP_WORDS.has(word.toLowerCase()))) return null;

  const uniqueRatio = new Set(deduped.map((word) => word.toLowerCase())).size / deduped.length;
  if (uniqueRatio < 0.6) return null;

  const label = deduped.join(' ').trim();
  if (label.length < 3 || label.length > 64) return null;
  if (/^slide\s+\d+$/i.test(label)) return null;
  return label;
}

function sanitizeDefinitionText(raw: string): string {
  return normalizeWhitespace(
    raw
      .replace(/\[slide\s+\d+\]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractTerms(content: string): string[] {
  const words = cleanText(content)
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((word) => word.length > 4);

  const freq: Record<string, number> = {};
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 160)
    .map(([word]) => word);
}

function extractDefinitionPairs(content: string): Array<{ term: string; definition: string }> {
  const pairs: Array<{ term: string; definition: string }> = [];

  const explicitPairs = content.matchAll(/(?:^|\n)\s*(?:[•\-*]|\d+\.)?\s*([A-Za-z][A-Za-z0-9\s()/\-]{2,50})\s*[:\-]\s*([^\n]{15,260})/g);
  for (const match of explicitPairs) {
    const term = sanitizeTermLabel(match[1] || '');
    const definition = sanitizeDefinitionText(match[2] || '');
    if (!term || !definition) continue;
    if (term.length < 3 || definition.length < 15) continue;
    pairs.push({ term, definition });
  }

  if (pairs.length > 0) {
    const seen = new Set<string>();
    return pairs.filter((pair) => {
      const key = pair.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 120);
  }

  const sentences = getSentences(content);
  const inferredPairs: Array<{ term: string; definition: string }> = [];
  for (const sentence of sentences) {
    const match = sentence.match(/^([A-Za-z][A-Za-z0-9\s()/\-]{2,45})\s+(?:is|are|refers to|means)\s+(.{15,220})$/i);
    if (!match) continue;
    const term = sanitizeTermLabel(match[1]);
    const definition = sanitizeDefinitionText(match[2]);
    if (!term || !definition) continue;
    inferredPairs.push({
      term,
      definition,
    });
    if (inferredPairs.length >= 80) break;
  }
  return inferredPairs;
}

function extractJsonArray<T>(response: string): T[] | null {
  const fencedMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || response;
  const arrayMatch = candidate.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return null;

  try {
    return JSON.parse(arrayMatch[0]) as T[];
  } catch {
    return null;
  }
}

function validateFlashcardJsonOutput(response: string, itemCount: number): { valid: boolean; reason?: string } {
  const parsed = extractJsonArray<Flashcard>(response);
  if (!parsed) {
    return { valid: false, reason: 'No valid JSON array found in flashcard output.' };
  }

  const sanitized = sanitizeFlashcards(parsed, itemCount);
  if (sanitized.length < Math.max(6, Math.floor(itemCount * 0.5))) {
    return {
      valid: false,
      reason: `Too few valid flashcards parsed (${sanitized.length}/${itemCount}).`,
    };
  }

  return { valid: true };
}

function validateQuizJsonOutput(response: string, itemCount: number): { valid: boolean; reason?: string } {
  const parsed = extractJsonArray<QuizQuestion>(response);
  if (!parsed) {
    return { valid: false, reason: 'No valid JSON array found in quiz output.' };
  }

  const sanitized = sanitizeQuestions(parsed, itemCount);
  if (sanitized.length < Math.max(6, Math.floor(itemCount * 0.5))) {
    return {
      valid: false,
      reason: `Too few valid quiz questions parsed (${sanitized.length}/${itemCount}).`,
    };
  }

  return { valid: true };
}

function uniqueOptions(options: string[], max = 4): string[] {
  const set = new Set<string>();
  for (const option of options.map((item) => normalizeWhitespace(item)).filter(Boolean)) {
    set.add(option);
    if (set.size === max) break;
  }
  return Array.from(set);
}

function rotateOptions(options: string[], correctIndex: number, shift: number): { options: string[]; correct: number } {
  const len = options.length;
  const safeShift = ((shift % len) + len) % len;
  if (safeShift === 0) return { options, correct: correctIndex };

  const rotated = options.map((_, index) => options[(index - safeShift + len) % len]);
  const correct = (correctIndex + safeShift) % len;
  return { options: rotated, correct };
}

function mergeFlashcards(primary: Flashcard[], fallback: Flashcard[], itemCount: number): Flashcard[] {
  const merged: Flashcard[] = [];
  const seen = new Set<string>();
  for (const card of [...primary, ...fallback]) {
    const key = card.front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(card);
    if (merged.length === itemCount) break;
  }
  return merged;
}

function mergeQuestions(primary: QuizQuestion[], fallback: QuizQuestion[], itemCount: number): QuizQuestion[] {
  const merged: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const question of [...primary, ...fallback]) {
    const key = question.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(question);
    if (merged.length === itemCount) break;
  }
  return merged;
}

interface QualityResult {
  score: number;
  issues: string[];
}

function safeRatio(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
}

function evaluateFlashcardQuality(cards: Flashcard[], itemCount: number, sourceTerms: string[]): QualityResult {
  const issues: string[] = [];
  if (cards.length === 0) {
    return { score: 0, issues: ['No flashcards were generated.'] };
  }

  const countScore = safeRatio(cards.length, itemCount);
  const uniqueFronts = new Set(cards.map((card) => card.front.toLowerCase())).size;
  const uniquenessScore = safeRatio(uniqueFronts, cards.length);
  const answerLengthScore = safeRatio(
    cards.filter((card) => card.back.length >= 20 && card.back.length <= 320).length,
    cards.length
  );
  const topicalTerms = sourceTerms.slice(0, 50);
  const sourceGroundingScore = topicalTerms.length === 0
    ? 1
    : safeRatio(
      cards.filter((card) => {
        const answer = card.back.toLowerCase();
        return topicalTerms.some((term) => answer.includes(term.toLowerCase()));
      }).length,
      cards.length
    );

  // STRICT: Check for garbage patterns
  let garbageCount = 0;
  for (const card of cards) {
    const front = card.front.toLowerCase();
    const back = card.back.toLowerCase();
    
    // Check for slide/page numbers
    if (/slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(front) || 
        /slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(back)) {
      garbageCount++;
    }
    
    // Check for too short or generic
    if (front.length < 8 || back.length < 15) garbageCount++;
    if (/^what is/i.test(front) && back.length < 25) garbageCount++;
    
    // Check for repetition patterns
    if (/(the source|according to|this is)/i.test(front) && back.length < 30) garbageCount++;
  }
  const garbagePenalty = Math.max(0, 1 - (garbageCount / cards.length) * 2);

  const score =
    (countScore * 0.20) +
    (uniquenessScore * 0.20) +
    (answerLengthScore * 0.15) +
    (sourceGroundingScore * 0.25) +
    (garbagePenalty * 0.20);

  if (countScore < 1) issues.push(`Expected ${itemCount} cards but got ${cards.length}.`);
  if (uniquenessScore < 0.9) issues.push('Too many duplicate or near-duplicate card fronts.');
  if (answerLengthScore < 0.85) issues.push('Some card answers are too short or too long.');
  if (sourceGroundingScore < 0.7) issues.push('Card answers are not strongly grounded in source terms.');
  if (garbagePenalty < 0.8) issues.push(`Found ${garbageCount} cards with low-quality patterns (slide numbers, too short, generic).`);

  return { score, issues };
}

function getStemKey(question: string): string {
  const clean = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.split(' ').slice(0, 4).join(' ');
}

function checkOptionDiversity(options: string[]): boolean {
  if (options.length < 4) return false;
  
  // Check that options are meaningfully different
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const optA = options[i].toLowerCase();
      const optB = options[j].toLowerCase();
      
      // Calculate word overlap
      const wordsA = new Set(optA.split(/\s+/));
      const wordsB = new Set(optB.split(/\s+/));
      
      let overlap = 0;
      for (const word of wordsA) {
        if (wordsB.has(word)) overlap++;
      }
      
      const maxWords = Math.max(wordsA.size, wordsB.size);
      const overlapRatio = overlap / maxWords;
      
      // If more than 70% overlap, they're too similar
      if (overlapRatio > 0.7) return false;
      
      // Check if one contains the other
      if (optA.includes(optB) || optB.includes(optA)) return false;
      
      // Check if they start with same 4 words (too similar)
      const startA = optA.split(/\s+/).slice(0, 4).join(' ');
      const startB = optB.split(/\s+/).slice(0, 4).join(' ');
      if (startA === startB) return false;
    }
  }
  
  return true;
}

function evaluateQuizQuality(questions: QuizQuestion[], itemCount: number): QualityResult {
  const issues: string[] = [];
  if (questions.length === 0) {
    return { score: 0, issues: ['No quiz questions were generated.'] };
  }

  const countScore = safeRatio(questions.length, itemCount);
  const uniqueQuestions = new Set(questions.map((question) => question.question.toLowerCase())).size;
  const uniquenessScore = safeRatio(uniqueQuestions, questions.length);

  const optionIntegrityScore = safeRatio(
    questions.filter((question) => {
      if (!Array.isArray(question.options) || question.options.length !== 4) return false;
      const options = question.options.map((option) => normalizeWhitespace(option));
      return new Set(options.map((option) => option.toLowerCase())).size === 4
        && options.every((option) => option.length >= 2 && option.length <= 140);
    }).length,
    questions.length
  );

  const stemKeys = new Set(questions.map((question) => getStemKey(question.question)));
  const diversityTarget = Math.min(8, questions.length);
  const stemDiversityScore = safeRatio(stemKeys.size, diversityTarget);

  const whatIsCount = questions.filter((question) => /^what is\b/i.test(question.question.trim())).length;
  const whatIsRatio = safeRatio(whatIsCount, questions.length);
  const whatIsScore = 1 - Math.min(1, whatIsRatio / 0.3);

  // STRICT: Check for garbage patterns in questions and options
  let garbageCount = 0;
  for (const q of questions) {
    const question = q.question.toLowerCase();
    const options = (q.options || []).map(o => o.toLowerCase());
    
    // Check for slide/page numbers
    if (/slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(question)) garbageCount++;
    if (options.some(o => /slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(o))) garbageCount++;
    
    // Check for nonsensical patterns
    if (/the source rejects|this is presented as|according to some/i.test(question)) garbageCount++;
    if (options.some(o => /the source rejects|this is presented as|but this is not/i.test(o))) garbageCount++;
    
    // Check option quality - all should be similar length
    const optionLengths = options.map(o => o.length);
    const maxLength = Math.max(...optionLengths);
    const minLength = Math.min(...optionLengths);
    if (maxLength - minLength > 40) garbageCount++; // Too much variation
    
    // Check for obviously wrong distractors
    if (options.some(o => o.length < 8 || /^no$|^none$|^all$/.test(o))) garbageCount++;
  }
  const garbagePenalty = Math.max(0, 1 - (garbageCount / questions.length) * 2);

  const score =
    (countScore * 0.15) +
    (uniquenessScore * 0.15) +
    (optionIntegrityScore * 0.20) +
    (stemDiversityScore * 0.15) +
    (whatIsScore * 0.15) +
    (garbagePenalty * 0.20);

  if (countScore < 1) issues.push(`Expected ${itemCount} questions but got ${questions.length}.`);
  if (uniquenessScore < 0.9) issues.push('Too many repeated quiz question texts.');
  if (optionIntegrityScore < 0.9) issues.push('Some quiz options are duplicated or malformed.');
  if (stemDiversityScore < 0.7) issues.push('Question stems are not diverse enough.');
  if (whatIsRatio > 0.3) issues.push('"What is" style questions are overused.');
  if (garbagePenalty < 0.8) issues.push(`Found ${garbageCount} questions with low-quality patterns (slide numbers, nonsense, obvious distractors).`);

  return { score, issues };
}

function sanitizeFlashcards(value: unknown, itemCount: number): Flashcard[] {
  if (!Array.isArray(value)) return [];

  const cards: Flashcard[] = [];
  const seenFronts = new Set<string>();
  const seenBacks = new Set<string>();
  
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    let front = normalizeWhitespace(String((item as { front?: unknown }).front || ''));
    let back = normalizeWhitespace(String((item as { back?: unknown }).back || ''));

    // CRITICAL: Skip low-quality cards
    if (!front || !back) continue;
    
    // Length validation
    if (front.length < 10 || front.length > 150) continue;
    if (back.length < 20 || back.length > 350) continue;
    
    // CRITICAL: Skip repetitive/nonsensical patterns
    const frontLower = front.toLowerCase();
    const backLower = back.toLowerCase();
    
    // Slide/page number patterns
    if (/slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(frontLower)) continue;
    if (/slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(backLower)) continue;
    
    // Nonsense patterns
    if (/the source rejects|this is presented as|according to some/i.test(frontLower)) continue;
    if (/the source rejects|this is presented as|according to some/i.test(backLower)) continue;
    
    // Too generic
    if (/^what is/i.test(frontLower) && back.length < 25) continue;
    if (/^list all|^explain everything|^tell me about/i.test(frontLower)) continue;
    
    // Repetition patterns
    if (frontLower === backLower) continue;
    if (front.split(' ').length < 3) continue;
    
    // Markdown patterns
    if (/^[#*_`]/.test(front) || /^[#*_`]/.test(back)) continue;
    
    // Check for duplicates
    const frontKey = frontLower.slice(0, 50);
    const backKey = backLower.slice(0, 80);
    if (seenFronts.has(frontKey) || seenBacks.has(backKey)) continue;
    
    seenFronts.add(frontKey);
    seenBacks.add(backKey);
    
    cards.push({ front, back });
    if (cards.length === itemCount) break;
  }

  return cards;
}

function sanitizeQuestions(value: unknown, itemCount: number): QuizQuestion[] {
  if (!Array.isArray(value)) return [];

  const questions: QuizQuestion[] = [];
  const seenQuestions = new Set<string>();
  const validTypes = ['core', 'process', 'application', 'confusion', 'edge'];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    let question = normalizeWhitespace(
      String((item as { question?: unknown }).question || '')
        .replace(/\s*\(\d+\)\s*$/g, '')
        .trim()
    );
    const rawAnswer = String((item as { answer?: unknown }).answer || '').trim();
    const rawExplanation = String((item as { explanation?: unknown }).explanation || '').trim();
    const rawType = String((item as { type?: unknown }).type || 'core').trim().toLowerCase();
    const rawOptions = Array.isArray((item as { options?: unknown }).options)
      ? ((item as { options?: unknown }).options as unknown[])
          .map((option) => normalizeWhitespace(String(option || '')))
          .filter(Boolean)
      : [];
    const rawCorrect = Number((item as { correct?: unknown }).correct);

    // CRITICAL: Skip low-quality questions
    if (!question || question.length < 15 || question.length > 400) continue;
    if (!rawAnswer || rawAnswer.length < 5) continue;

    const questionLower = question.toLowerCase();

    // Slide/page number patterns
    if (/slide\s*\d+|chapter\s*\d+|page\s*\d+|\d+\.\d+\./.test(questionLower)) continue;

    // Nonsense patterns
    if (/the source rejects|this is presented as|according to some/i.test(questionLower)) continue;

    // CRITICAL: Ban meta-references to source material
    if (/based on the source|according to the passage|based on the material|in this chapter|as presented in the text|in the context of the source/i.test(questionLower)) continue;

    // Skip duplicates
    const questionKey = questionLower.slice(0, 60);
    if (seenQuestions.has(questionKey)) continue;

    const type = validTypes.includes(rawType) ? rawType as QuizQuestion['type'] : 'core';

    let options = uniqueOptions(rawOptions, 4);
    let correct = Number.isInteger(rawCorrect) ? rawCorrect : -1;

    if (options.length === 4) {
      if (!(correct >= 0 && correct < 4)) {
        const guessed = options.findIndex((opt) => opt.toLowerCase() === rawAnswer.toLowerCase());
        correct = guessed >= 0 ? guessed : 0;
      }
    } else {
      options = makeOptions(rawAnswer, extractConcepts(question));
      const guessed = options.findIndex((opt) => opt.toLowerCase() === rawAnswer.toLowerCase());
      correct = guessed >= 0 ? guessed : 0;
    }

    if (options.length !== 4 || !checkOptionDiversity(options) || !(correct >= 0 && correct < 4)) {
      continue;
    }

    seenQuestions.add(questionKey);
    questions.push({
      question,
      answer: rawAnswer,
      explanation: rawExplanation || rawAnswer,
      type,
      options,
      correct,
    });
    if (questions.length === itemCount) break;
  }

  return questions;
}

// Generate flashcards using AI for best quality
export async function generateFlashcardsWithAI(content: string, title: string, itemCount = MIN_ITEMS, flashcardStyle?: string): Promise<Flashcard[]> {
  const safeCount = clampItemCount(itemCount);
  const fallback = generateSimpleFlashcards(content, title, safeCount);
  const sourceTerms = extractTerms(content);
  
  // Determine flashcard style
  const isTermDefinition = flashcardStyle === 'term-definition';
  
  const styleInstructions = isTermDefinition
    ? `FLASHCARD STYLE: TERM-DEFINITION FORMAT
    - front: Just the key term/concept (1-5 words)
    - back: Brief definition (max 100 characters)
    - Example: front="OOSAD", back="Object-Oriented System Analysis and Design methodology"
    - Do NOT ask questions - just list terms with their definitions.`
    : `FLASHCARD STYLE: QUESTION-ANSWER FORMAT
    - front: Question asking about the concept
    - back: Detailed answer with explanation
    - Example: front="What is OOSAD?", back="Object-Oriented System Analysis and Design is a methodology..."`;

  const basePrompt = `Create ${safeCount} high-quality flashcards from this source material.

Source Title: ${title}
Source Content:
${content.substring(0, 30000)}

${styleInstructions}

DETAILED REQUIREMENTS:
1. Generate exactly ${safeCount} flashcards
2. Each flashcard MUST be grounded in the source content
3. If source is unclear, state "Source does not provide enough detail" in the answer
4. NO duplicate or near-duplicate cards - each must test unique knowledge
5. Use varied question stems: "How does...", "When would...", "Why does...", "Compare...", "What happens if..."

FLASHCARD FORMAT (JSON only, no markdown):
[
  {"front":"specific question or term","back":"complete answer with educational context"}
]

EXAMPLES OF GOOD FLASHCARDS (follow this quality):
- front: "What is the primary purpose of dependency injection?"
  back: "Dependency injection provides objects with their dependencies instead of creating them internally. This reduces coupling, enables easier testing with mocks, and allows flexible configuration without code changes."
  
- front: "When should you choose asynchronous processing over synchronous?"
  back: "Choose async when: UI must remain responsive, handling multiple independent requests, or operations have unpredictable duration. Avoid when: subsequent steps depend on results, or simplicity is prioritized over performance."
  
- front: "Compare MVC and MVVM architectural patterns"
  back: "MVC: Controller handles user input, updates Model. View observes Model changes. MVVM: ViewModel exposes data and commands, View binds directly to ViewModel. MVVM reduces boilerplate, better for data-binding frameworks."

EXAMPLES OF BAD FLASHCARDS (DO NOT CREATE):
- front: "What is MVC?" back: "A pattern" (too vague, no educational value)
- front: "Define everything about databases" back: "They store data" (too broad, obvious)
- front: "List all types of patterns" back: "MVC, MVVM, Singleton" (list without understanding)

QUALITY RULES:
- Questions: Specific, testable, under 100 characters
- Answers: Educational, grounded in source, 50-280 characters
- Avoid: Generic questions, invented facts, repetitive phrasing
- Diversity: Mix of definition (20%), application (30%), comparison (20%), analysis (20%), evaluation (10%)
- No duplicates: Each question must be unique in wording and concept tested

Generate ${safeCount} flashcards now:`;

  const fallbackQuality = evaluateFlashcardQuality(fallback, safeCount, sourceTerms);
  let bestCards = fallback;
  let bestQuality = fallbackQuality;

  for (let attempt = 0; attempt < 2; attempt++) {
    const qualityHints = bestQuality.issues.length > 0
      ? `Quality issues to fix from prior attempt: ${bestQuality.issues.join(' ')}`
      : '';
    const prompt = `${basePrompt}

${qualityHints}
Quality target:
- Reach at least ${Math.round(QUALITY_TARGET * 100)}% quality.
- Ensure diverse fronts and source-grounded answers.
- Avoid repetitive wording across cards.`;
    try {
      const response = await askTutor(prompt, {
        systemPrompt: FLASHCARD_SYSTEM_PROMPT,
        temperature: attempt === 0 ? 0.2 : 0.1,
        maxRetries: 2,
        validateOutput: (value) => validateFlashcardJsonOutput(value, safeCount),
      });
      const parsed = extractJsonArray<Flashcard>(response);
      const cards = sanitizeFlashcards(parsed || [], safeCount);
      const merged = mergeFlashcards(cards, fallback, safeCount);
      const quality = evaluateFlashcardQuality(merged, safeCount, sourceTerms);

      if (quality.score > bestQuality.score) {
        bestCards = merged;
        bestQuality = quality;
      }
      if (quality.score >= QUALITY_TARGET) {
        return merged;
      }
    } catch (error) {
      console.error('[app] AI flashcard generation attempt failed:', error);
    }
  }

  return bestCards;
}

function generateSimpleFlashcards(content: string, title: string, itemCount = MIN_ITEMS): Flashcard[] {
  const safeCount = clampItemCount(itemCount);
  const segments = getSegments(content);
  const sentences = getSentences(content).map(cleanSentence).filter(Boolean);
  const terms = extractTerms(content);
  const definitions = extractDefinitionPairs(content);
  const cards: Flashcard[] = [];
  const usedFronts = new Set<string>();
  const usedBacks = new Set<string>();

  const baseBits = segments.length > 0 ? segments : sentences;
  const fallbackSentence = baseBits[0] || 'The source does not provide enough detail to summarize this topic clearly.';
  const maxDefinitionCards = Math.max(3, Math.floor(safeCount * 0.35));
  const keyTerms = terms.slice(0, 60);

  // First: Generate cards from definition pairs (highest quality)
  for (const pair of definitions) {
    if (cards.length >= safeCount || cards.length >= maxDefinitionCards) break;
    const termLabel = sanitizeTermLabel(pair.term) || shorten(pair.term, 40);
    
    // Skip low-quality terms
    if (termLabel.length < 3 || termLabel.length > 50) continue;
    if (/slide \d+/i.test(termLabel)) continue;
    if (pair.definition.length < 30 || pair.definition.length > 300) continue;
    
    const front = `What is "${termLabel}"?`;
    const back = shorten(pair.definition, 220);
    const key = front.toLowerCase();
    const backKey = back.toLowerCase().slice(0, 100);
    if (usedFronts.has(key)) continue;
    if (usedBacks.has(backKey)) continue;
    usedFronts.add(key);
    usedBacks.add(backKey);
    cards.push({ front, back });
  }

  const frontTemplates = [
    (term: string) => `When should "${term}" be used?`,
    (term: string) => `What problem does "${term}" help solve?`,
    (term: string) => `Why is "${term}" important in this topic?`,
    (term: string) => `How does "${term}" work?`,
    (term: string) => `What is the main purpose of "${term}"?`,
  ];

  // Second: Generate comparison cards
  for (let i = 0; i < Math.min(definitions.length - 1, Math.floor(safeCount * 0.2)); i++) {
    if (cards.length >= safeCount) break;
    const left = definitions[i];
    const right = definitions[(i + 1) % definitions.length];
    const termA = sanitizeTermLabel(left.term) || shorten(left.term, 30);
    const termB = sanitizeTermLabel(right.term) || shorten(right.term, 30);
    
    // Skip if terms are too similar or too short
    if (termA.length < 3 || termB.length < 3) continue;
    if (termA.toLowerCase() === termB.toLowerCase()) continue;
    
    const front = `What is the key difference between "${termA}" and "${termB}"?`;
    const back = shorten(`${termA}: ${left.definition} | ${termB}: ${right.definition}`, 220);
    const key = front.toLowerCase();
    const backKey = back.toLowerCase().slice(0, 100);
    if (usedFronts.has(key) || usedBacks.has(backKey)) continue;
    usedFronts.add(key);
    usedBacks.add(backKey);
    cards.push({ front, back });
  }

  // Third: Generate cards from key terms
  let guard = 0;
  while (cards.length < safeCount && guard < safeCount * 14) {
    guard++;
    const index = cards.length + guard;
    const term = keyTerms[index % Math.max(keyTerms.length, 1)] || title;
    
    // Skip if term is too short or too long
    if (term.length < 4 || term.length > 40) continue;
    
    const sentence = cleanSentence(baseBits[(index * 2) % Math.max(baseBits.length, 1)] || fallbackSentence);
    
    // Skip if sentence is too short or nonsensical
    if (sentence.length < 30 || sentence.length > 300) continue;
    if (/slide \d+/i.test(sentence)) continue;
    
    const front = frontTemplates[index % frontTemplates.length](term);
    const back = shorten(sentence || fallbackSentence, 220);
    const backKey = back.toLowerCase().slice(0, 100);

    if (usedFronts.has(front.toLowerCase())) continue;
    if (usedBacks.has(backKey)) continue;
    usedFronts.add(front.toLowerCase());
    usedBacks.add(backKey);
    cards.push({ front, back });
  }

  // Fill remaining with diverse segment-based cards
  while (cards.length < safeCount) {
    const index = cards.length + 1;
    const segment = cleanSentence(baseBits[index % Math.max(baseBits.length, 1)] || fallbackSentence);
    
    // Skip low-quality segments
    if (segment.length < 40 || segment.length > 280) continue;
    if (/slide \d+/i.test(segment)) continue;
    
    const front = `Explain this concept: ${shorten(segment, 60)}?`;
    const back = segment;
    
    const frontKey = front.toLowerCase().slice(0, 50);
    const backKey = back.toLowerCase().slice(0, 80);
    if (usedFronts.has(frontKey) || usedBacks.has(backKey)) continue;
    
    usedFronts.add(frontKey);
    usedBacks.add(backKey);
    cards.push({ front, back });
    
    // Safety break to avoid infinite loop
    if (index > safeCount * 20) break;
  }

  return cards;
}

// Generate flashcards from content (sync fallback version)
export function generateFlashcards(content: string, title: string, itemCount = MIN_ITEMS): Flashcard[] {
  return generateSimpleFlashcards(content, title, itemCount);
}

// Generate quiz questions using AI
export async function generateQuizQuestionsWithAI(content: string, title: string, itemCount = MIN_ITEMS): Promise<QuizQuestion[]> {
  const safeCount = clampItemCount(itemCount);
  const fallback = generateSimpleQuizQuestions(content, title, safeCount);

  const basePrompt = `Generate exactly ${safeCount} MCQ questions testing deep understanding.

STRICT RULES:
- Questions must test understanding, not memorization
- NEVER use "Based on the source/passage/material"
- No meta-references — questions must be standalone like real exams
- Avoid NOT/EXCEPT/FALSE phrasing

REQUIRED MIX:
- Core Understanding: explain concept in own words
- Process/Mechanism: how things work step-by-step
- Application: real-world scenarios
- Confusion Test: compare similar concepts
- Edge Case: "what if" scenarios

FORMAT (JSON only, no markdown):
[
  {
    "question": "Exam-style question?",
    "options": ["A", "B", "C", "D"],
    "answer": "Correct option text",
    "explanation": "Brief reasoning"
  }
]

Title: ${title}
Content:
${content.substring(0, 8000)}
`;

  const fallbackQuality = evaluateQuizQuality(fallback, safeCount);
  let bestQuestions = fallback;
  let bestQuality = fallbackQuality;

  // Single attempt for speed - no retries
  try {
    const response = await askTutor(basePrompt, {
      systemPrompt: QUIZ_SYSTEM_PROMPT,
      temperature: 0.15,
      maxRetries: 0,
      validateOutput: (value) => validateQuizJsonOutput(value, safeCount),
    });
    const parsed = extractJsonArray<QuizQuestion>(response);
    const questions = sanitizeQuestions(parsed || [], safeCount);
    const merged = mergeQuestions(questions, fallback, safeCount);
    const quality = evaluateQuizQuality(merged, safeCount);

    if (quality.score > bestQuality.score) {
      bestQuestions = merged;
      bestQuality = quality;
    }
  } catch (error) {
    console.error('[app] AI quiz generation failed, using fallback:', error);
  }

  return bestQuestions;
}

/** Extract short, meaningful key phrases from content for question building. */
function extractConcepts(content: string): string[] {
  const lines = content
    .replace(/Slide \d+\b/gi, '')
    .replace(/\b\d+\s*\/\s*\d+\b/g, '')
    .replace(/\b[A-Z][a-z]+ Chapter\b/gi, '')
    .replace(/\bContents?\b/gi, '')
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 20 && !l.startsWith('#') && l.length < 200 && /[a-zA-Z]/.test(l));

  const concepts: string[] = [];
  for (const line of lines) {
    const parts = line.split(/[:–—]\s*/);
    if (parts.length > 1 && parts[0].trim().length > 2 && parts[0].trim().length < 60) {
      concepts.push(parts[0].trim());
    }
    const words = line.split(/\s+/);
    if (words.length >= 4 && words.length <= 15) {
      concepts.push(line.trim());
    }
  }
  return [...new Set(concepts)].slice(0, 12);
}



/** Build plausible distractor options around a correct answer. */
function makeOptions(correct: string, otherConcepts: string[]): string[] {
  const distractors = otherConcepts
    .filter((c) => c.length > 2 && c !== correct && !c.includes(correct) && !correct.includes(c))
    .map((c) => c.replace(/^[-•*] /, '').trim())
    .slice(0, 12);

  // Take 3 diverse distractors
  const chosen: string[] = [];
  for (const d of distractors) {
    if (chosen.length >= 3) break;
    if (!chosen.some((x) => x.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(x.toLowerCase()))) {
      chosen.push(d);
    }
  }

  // Pad with plausible generic distractors if needed
  const padOptions = [
    'It mainly improves visual layout but not decision quality',
    'It removes the need for human review entirely',
    'It affects user count more than system function',
    'It speeds up one step but does not solve the core problem',
    'It is useful only in ideal conditions with no constraints',
  ];
  for (const p of padOptions) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(p)) chosen.push(p);
  }

  // Insert correct answer at random position
  const pos = Math.floor(Math.random() * 4);
  const opts = [...chosen.slice(0, pos), correct, ...chosen.slice(pos)];

  return opts.slice(0, 4);
}

/** Generate MCQ quiz questions from content (sync fallback). */
function generateSimpleQuizQuestions(content: string, title: string, itemCount = MIN_ITEMS): QuizQuestion[] {
  const safeCount = clampItemCount(itemCount);
  const pool = extractConcepts(content);
  const primary = pool[0] || title;
  const secondary = pool[1] || pool[0] || 'the system';
  const tertiary = pool[2] || secondary;

  const patterns: Array<(i: number) => QuizQuestion> = [
    () => {
      const correct = 'Unified handling of stakeholders and data in one workflow';
      const options = makeOptions(correct, [
        'Only visual dashboard redesign for users',
        'Manual tracking by separate spreadsheets',
        'Independent tools without integration',
        ...pool,
      ]);
      return {
        question: `Which approach best fixes fragmentation problems in ${title}?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Fragmentation is solved by centralization and integrated workflow, not isolated tools.',
        type: 'core',
      };
    },
    () => {
      const correct = 'It limits each role to relevant actions and data';
      const options = makeOptions(correct, [
        'It removes authentication needs completely',
        'It increases user count by default',
        'It replaces review and governance',
        ...pool,
      ]);
      return {
        question: `Why is role-based access important when implementing ${title}?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Role boundaries reduce misuse and keep each stakeholder focused on relevant functions.',
        type: 'process',
      };
    },
    () => {
      const correct = 'Use KPI-style performance tracking to monitor progress over time';
      const options = makeOptions(correct, [
        'Only collect one-time registration data',
        'Skip metrics and rely on intuition',
        'Track UI colors as a core metric',
        ...pool,
      ]);
      return {
        question: `A team wants to evaluate progress after deployment. What feature is most useful?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Longitudinal tracking needs structured metrics, not one-time snapshots.',
        type: 'application',
      };
    },
    () => {
      const correct = `${primary} defines function, while ${secondary} often defines execution context`;
      const options = makeOptions(correct, [
        `${primary} and ${secondary} are always identical`,
        `${primary} is purely visual while ${secondary} stores passwords`,
        `${secondary} replaces all decisions made by ${primary}`,
        ...pool,
      ]);
      return {
        question: `What is the most accurate distinction between ${primary} and ${secondary}?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Strong answers separate function-level purpose from context or implementation details.',
        type: 'confusion',
      };
    },
    () => {
      const correct = 'Apply structured criteria before downstream decisions to keep evaluation consistent';
      const options = makeOptions(correct, [
        'Approve everything first, validate later',
        'Use random ordering to avoid bias',
        'Skip criteria if timeline is short',
        ...pool,
      ]);
      return {
        question: `Which step should come first to keep decisions fair and consistent?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Consistent decisions require explicit criteria before approvals and execution.',
        type: 'edge',
      };
    },
    () => {
      const correct = 'Connect problem signals to feature purpose before selecting implementation';
      const options = makeOptions(correct, [
        'Pick the most complex architecture first',
        'Choose features based only on trend popularity',
        'Ignore constraints until final testing',
        ...pool,
      ]);
      return {
        question: `When designing ${title}, what best prevents shallow feature selection?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Problem-to-function mapping prevents random or cosmetic feature choices.',
        type: 'application',
      };
    },
    () => {
      const correct = `${tertiary} should be evaluated by its effect on workflow quality and outcomes`;
      const options = makeOptions(correct, [
        `${tertiary} should be judged only by visual appeal`,
        `${tertiary} has value only if it removes all human input`,
        `${tertiary} matters only at login stage`,
        ...pool,
      ]);
      return {
        question: `Which criterion best measures whether ${tertiary} is actually valuable?`,
        options,
        correct: options.indexOf(correct),
        explanation: 'Useful features are measured by impact on process and decisions, not surface metrics.',
        type: 'core',
      };
    },
  ];

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < safeCount; i++) {
    const built = patterns[i % patterns.length](i);
    const options = Array.isArray(built.options) ? built.options : [];
    const correct = typeof built.correct === 'number' ? built.correct : -1;
    if (options.length === 4 && correct >= 0 && correct < 4) {
      questions.push(built);
    }
  }

  return questions.slice(0, safeCount);
}

// Generate quiz questions from content (sync fallback version)
export function generateQuizQuestions(content: string, title: string, itemCount = MIN_ITEMS): QuizQuestion[] {
  return generateSimpleQuizQuestions(content, title, itemCount);
}

// Extract keywords from content
export function extractKeywords(content: string): string[] {
  return extractTerms(content).slice(0, 20);
}
