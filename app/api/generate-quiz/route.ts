import { NextRequest, NextResponse } from 'next/server';
import { askTutor } from '@/lib/ai';
import { buildZeniusSystemPrompt } from '@/lib/zenius-prompts';
import { generateQuizQuestionsWithAI } from '@/lib/data-generator';

interface QuizQuestion {
  question: string;
  correctAnswer?: string;
  type?: 'core' | 'process' | 'application' | 'confusion' | 'edge';
  explanation?: string;
  options?: string[];
  correct?: number;
}

export async function POST(req: NextRequest) {
  // Add timeout to prevent hanging requests
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Quiz generation timeout')), 60000); // 60 second timeout
  });

  try {
    const body = await Promise.race([req.json(), timeoutPromise]);
    let { topic, source, count = 8, difficulty = 'medium' } = body;
    topic = topic || body?.title || 'Study Topic';
    source = source || body?.content || '';

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    // Normalize count
    count = Math.max(4, Math.min(12, count));

    // If source content is provided, use the full Q&A generation engine
    if (source && source.trim().length > 50) {
      // Truncate content for faster processing
      const truncatedSource = source.substring(0, 8000);
      
      // Add timeout to AI call
      const aiPromise = generateQuizQuestionsWithAI(truncatedSource, topic, count);
      const questions = await Promise.race([
        aiPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI generation timed out')), 45000)
        ),
      ]);
      return NextResponse.json({ questions, topic });
    }

    // Otherwise generate MCQ questions from topic alone
    const systemPrompt = buildZeniusSystemPrompt({
      role: 'Expert quiz designer who creates deep-understanding Q&A questions, not surface-recall.',
      goals: [
        'Generate quiz questions that force the student to THINK, not just recall facts.',
        'Each question tests genuine understanding — if a student can answer without truly understanding, the question is too easy.',
        'Use scenario-based, application, mechanism, and confusion-test questions.',
        'Never reference "the source", "the material", "the passage", or anything like that — questions must read like real exam questions.',
      ],
      outputRules: [
        'Return a valid JSON array only.',
        'Each item must be an object with: "question" (string), "options" (array of 4 strings), "correct" (0-3 index), and "type" (string).',
        '"type" must be one of: "core", "process", "application", "confusion", "edge".',
        'Questions must be multiple choice with exactly 4 options and one correct answer.',
        'Do not include markdown or explanation outside the JSON array.',
      ],
      taskRules: [
        `Generate ${count} questions about: ${topic}.`,
        'If additional context was provided, use it to inform question accuracy.',

        // === CRITICAL HARD BANS ===
        'CRITICAL: NEVER use meta-references like:',
        '  - "Based on the source", "According to the passage", "Based on the material"',
        '  - "In this chapter", "As presented in the text", "In the context of the source"',
        '  Questions must be standalone MCQ — like real exam questions with no preamble.',

        'CRITICAL: MUST be multiple choice questions with 4 options each.',
        'CRITICAL: Each question MUST have exactly 4 options: A, B, C, D.',
        'CRITICAL: One option is correct, three are plausible distractors.',

        // === Question type requirements ===
        'You MUST include a mix of question types:',
        '  1) CORE UNDERSTANDING: Test if student really understands the concept',
        '  2) APPLICATION: Real-world scenario based questions',
        '  3) CONFUSION TEST: Compare similar concepts to find the difference',
        '  4) PROCESS/MECHANISM: How things work step-by-step',
        '  5) PROBLEM SOLVING: Given X, what is the best solution',
        `Total: ${count} questions.`,

        // === MCQ Format ===
        'Each question needs: question, options (array of 4), correct (0-3 index)',
        'Distractors must be plausible but clearly wrong based on the material',

        // === Quality check ===
        'Before including any question: Would failing this reveal real gaps? If no, rewrite.',
        'Never copy exact text from source material into options.',
      ],
    });

    const userPrompt = `Generate ${count} multiple choice questions about: ${topic}.

MCQ FORMAT (JSON only):
[
  {
    "question": "Exam-style question?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

Difficulty: ${difficulty}

IMPORTANT: 
- ONE correct answer (correct: 0-3)
- Three plausible distractors
- Questions must test understanding, not memorization
- No "Based on the source" or "According to" phrasing
- Feel like real exam MCQ`;

    const quizResult = await askTutor(
      `${systemPrompt}\n\n${userPrompt}`,
      { temperature: 0.2 }
    );

    function extractJSON(text: string): unknown[] | null {
      try {
        return JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch {
            return null;
          }
        }
        return null;
      }
    }

    function validateQuestion(candidate: unknown): QuizQuestion | null {
      if (!candidate || typeof candidate !== 'object') {
        return null;
      }

      const q = candidate as Record<string, unknown>;

      // Check for MCQ format (options array + correct index)
      const options = q.options as unknown[];
      const correct = q.correct as number;
      
      if (Array.isArray(options) && options.length === 4 && typeof correct === 'number' && correct >= 0 && correct <= 3) {
        const question = q.question as string;
        if (!question || question.length < 15) return null;
        
        // Check for bad phrasing
        const lowerQ = question.toLowerCase();
        if (/based on|according to|from the passage|from the source/i.test(lowerQ)) {
          return null;
        }
        
        return {
          question: question,
          options: options.map((o: unknown) => String(o)).slice(0, 4),
          correct: correct,
        };
      }

      return null;
    }

    let parsed = extractJSON(quizResult);

    if (!parsed || !Array.isArray(parsed)) {
      parsed = generateFallbackMCQQuestions(topic, count) as unknown as Record<string, unknown>[];
    }

    const validQuestions: QuizQuestion[] = [];
    for (const q of parsed) {
      const validated = validateQuestion(q);
      if (validated) validQuestions.push(validated);
    }

    while (validQuestions.length < count) {
      const fallback = generateFallbackMCQQuestions(topic, 1)[0];
      if (fallback && !validQuestions.some((q) => q.question === fallback.question)) {
        validQuestions.push(fallback);
      } else {
        break;
      }
    }

    return NextResponse.json({
      questions: validQuestions.slice(0, count),
      topic,
    });
  } catch (error: unknown) {
    console.error('Quiz generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate quiz';
    
    // Check if it's a timeout
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return NextResponse.json(
        { error: 'Quiz generation is taking longer than expected. Please try again in a moment.' },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}

// Fallback MCQ generator
function generateFallbackMCQQuestions(topic: string, count: number): QuizQuestion[] {
  const templates: Array<() => QuizQuestion> = [
    () => ({
      question: `What is the most likely result if a core part of ${topic} is removed?`,
      options: [
        'System behavior becomes unstable or incomplete due to dependency breakage',
        'The system automatically improves performance in all scenarios',
        'Only the user interface changes while core logic is unaffected',
        'The concept becomes easier to apply without any trade-off',
      ],
      correct: 0,
      type: 'edge',
    }),
    () => ({
      question: `Which option best explains why ${topic} is often misunderstood?`,
      options: [
        'People memorize terms but skip mechanism-level understanding',
        'It has no connection to real-world systems',
        'It never changes with context',
        'It can only be learned by advanced researchers',
      ],
      correct: 0,
      type: 'confusion',
    }),
    () => ({
      question: `In a practical scenario, what is the best first step when applying ${topic}?`,
      options: [
        'Identify context and constraints before choosing an approach',
        'Select the most complex method immediately',
        'Ignore assumptions and optimize only for speed',
        'Apply the same solution regardless of conditions',
      ],
      correct: 0,
      type: 'application',
    }),
    () => ({
      question: `Which statement best captures the core idea of ${topic}?`,
      options: [
        'Interacting parts produce outcomes through a defined process',
        'It is just a list of unrelated facts',
        'It works only in perfect theoretical settings',
        'It replaces the need for reasoning',
      ],
      correct: 0,
      type: 'core',
    }),
    () => ({
      question: `What usually comes first in the process when working with ${topic}?`,
      options: [
        'Establish input/context, then apply rules, then verify output',
        'Publish final result before analysis',
        'Skip intermediate steps and guess final state',
        'Start by comparing unrelated topics',
      ],
      correct: 0,
      type: 'process',
    }),
  ];

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) {
    questions.push(templates[i % templates.length]());
  }
  return questions.slice(0, count);
}
