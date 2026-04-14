import { askTutor } from '@/lib/ai';
import { buildZeniusSystemPrompt } from '@/lib/zenius-prompts';

const CHAT_SYSTEM_PROMPT = buildZeniusSystemPrompt({
  role: 'Interactive chat tutor and academic mentor for Zenius.',
  goals: [
    'Act like the helpful senior student described in the README: warm, encouraging, and easy to learn from.',
    'Prioritize uploaded notes and study material before adding careful background knowledge.',
    'Explain complex topics simply, accurately, and in a way that keeps the learner engaged.',
  ],
  includeChatStyle: true,
  outputRules: [
    'For greetings or small talk, reply in one or two short friendly sentences.',
    'For study questions, give the direct answer first, then clarify or expand if helpful.',
    'Avoid markdown headings unless the user explicitly asks for notes or a structured summary.',
    'Break dense explanations into short paragraphs or lists when that improves readability.',
  ],
  taskRules: [
    'When note context is provided, treat it as the primary source of truth.',
    'If the uploaded material does not answer the question, say so clearly before adding limited general explanation.',
    'Continue follow-up conversations naturally without restarting from the beginning.',
    'Ask at most one focused clarifying question when the student request is genuinely ambiguous.',
    'When asked who made you, say: "I am Zenius, created by Semeriya Seid (Suda) to help you study."',
    'Never become random social chat while study context is active.',
    'Never answer a study question with only the final answer and no explanation.',
  ],
});

function isContinuationCue(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value) return false;

  return /^(yeah|yep|yes|ok|okay|sure|continue|go on|more|elaborate|explain more|so|thats it\??|that's it\??)$/i.test(value);
}

function isSmallTalk(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (!value) return true;

  // Explicit small talk patterns
  const smallTalkPatterns = [
    /^hi$/i, /^hello$/i, /^hey$/i, /^hiya$/i,
    /^how are you$/i, /^how r you$/i, /^how's it going$/i, /^how do you do$/i,
    /^who are you$/i, /^what are you$/i,
    /^who made you$/i, /^who created you$/i, /^who is your creator$/i,
    /^what is your name$/i, /^what's your name$/i,
    /^thank(s| you)?$/i, /^thanks$/i, /^nice$/i, /^cool$/i, /^great$/i, /^good$/i,
    /^bye$/i, /^goodbye$/i, /^see you$/i, /^later$/i,
    /^no$/i,
    /^what can you do$/i, /^help me$/i, /^help$/i,
  ];

  for (const pattern of smallTalkPatterns) {
    if (pattern.test(value)) return true;
  }

  // Check for study-related keywords - if found, it's NOT small talk
  const studyKeywords = /\b(explain|summarize|summary|quiz|flashcard|podcast|note|chapter|slide|ppt|pdf|define|compare|question|answer|test|exam|study|learn|teach|lesson|concept|topic|understand|meaning|example|help|explain|describe|difference|what is|how does|why does|when do|which|where)/i;
  if (studyKeywords.test(value)) return false;

  // Short casual messages
  if (value.length <= 24 && /^[a-z\s?'!.,]+$/.test(value)) return true;

  return false;
}

export async function POST(request: Request) {
  try {
    const { prompt, question, context, noteTitle, history } = await request.json();

    const fallbackPrompt = typeof prompt === 'string' ? prompt : '';
    const userQuestion = typeof question === 'string' ? question.trim() : '';
    const noteContext = typeof context === 'string' ? context.trim() : '';
    const title = typeof noteTitle === 'string' && noteTitle.trim() ? noteTitle.trim() : 'Untitled Note';
    const chatHistory = Array.isArray(history)
      ? history
          .filter((item: unknown): item is { role?: unknown; content?: unknown } => typeof item === 'object' && item !== null)
          .map((item) => ({
            role: typeof item.role === 'string' ? item.role.trim().toLowerCase() : '',
            content: typeof item.content === 'string' ? item.content.trim() : '',
          }))
          .filter((item) => (item.role === 'user' || item.role === 'assistant') && item.content.length > 0)
          .slice(-8)
      : [];
    const hasContext = noteContext.length > 40;
    const continuation = hasContext && isContinuationCue(userQuestion);

    const userIsSmallTalk = !continuation && isSmallTalk(userQuestion);

    const effectiveContext = userIsSmallTalk ? '' : noteContext;
    const intent = continuation ? 'follow_up_study_query' : (userIsSmallTalk ? 'small_talk' : 'study_query');
    const historyBlock = chatHistory.length > 0
      ? chatHistory
          .map((item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.content}`)
          .join('\n')
      : '[none]';

    const finalPrompt = userQuestion
      ? `User Question:
${userQuestion}

Recent Conversation:
${historyBlock}

Note Title:
${title}

Note Context (may be empty if not relevant):
${effectiveContext || '[none provided]'}

Intent:
${intent}

Response rules:
- If intent is small_talk: reply naturally in 1-2 short sentences.
- If intent is study_query or follow_up_study_query: answer from note context first, then add brief clarification.
- If intent is follow_up_study_query: continue explanation directly and do not reset the conversation.
- When recent conversation exists, maintain continuity and avoid re-introducing yourself unless asked.
- Never reply with unrelated social questions when note context is active.
- Never output markdown headings unless asked.`
      : fallbackPrompt;

    if (!finalPrompt) {
      return Response.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      );
    }

    let response = '';
    try {
      response = await askTutor(finalPrompt, {
        systemPrompt: CHAT_SYSTEM_PROMPT,
        temperature: 0.2,
      });
      // If response is empty or undefined, use fallback
      if (!response || response.trim() === '') {
        response = 'I received an empty response. Please try again.';
      }
    } catch (aiError: unknown) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error('[app] Chat AI error:', errMsg);
      const exposeDebugError = process.env.CHAT_DEBUG_ERRORS === 'true' || process.env.NODE_ENV !== 'production';
      // Return a more helpful message based on the error
      if (errMsg.includes('API key') || errMsg.includes('401') || errMsg.includes('403')) {
        response = 'AI API authentication failed. Please check API keys configuration.';
      } else if (errMsg.includes('429') || errMsg.includes('rate limit')) {
        response = 'AI service rate limit reached. Please wait a moment and try again.';
      } else if (errMsg.includes('No AI API keys')) {
        response = 'AI service not configured. Please add API keys to the environment.';
      } else {
        response = 'I encountered an error connecting to the AI. Please try again.';
      }
      if (exposeDebugError) {
        response = `${response}\n\nDebug: ${errMsg}`;
      }
    }

    return Response.json({
      response,
      success: true,
    });
  } catch (error) {
    console.error('[app] API error:', error);
    return Response.json({
      response: 'An unexpected error occurred. Please try again.',
      success: false,
    });
  }
}
