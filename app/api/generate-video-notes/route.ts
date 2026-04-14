import { NextRequest, NextResponse } from 'next/server';
import { askTutor } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { url, type } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Extract content using Python script
    let content = '';
    let title = '';
    let extractedData: Record<string, unknown> = {};

    try {
      const { execSync } = require('child_process');
      const scriptPath = require('path').join(process.cwd(), 'scripts', 'youtube-extractor.py');
      
      const result = execSync(`python3 "${scriptPath}" "${url}"`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      
      extractedData = JSON.parse(result);
      
      // Get content in priority order: transcript > content > description
      content = (extractedData.transcript as string) || (extractedData.content as string) || (extractedData.description as string) || '';
      title = (extractedData.title as string) || 'Video Lesson';
      
    } catch (error) {
      console.error('[app] Content extraction error:', error);
      return NextResponse.json({ error: 'Failed to extract content from URL' }, { status: 500 });
    }

    if (!content || content.length < 100) {
      return NextResponse.json({ 
        error: 'Not enough content to generate notes. Please try a different URL.' 
      }, { status: 400 });
    }

    // Generate beautiful structured notes using LLM
    const notes = await generateBeautifulNotes(content, title, url);

    return NextResponse.json({
      success: true,
      url,
      title,
      ...notes,
    });
  } catch (error) {
    console.error('[app] Generate notes error:', error);
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 });
  }
}

async function generateBeautifulNotes(content: string, title: string, url: string) {
  // Detect topic and create appropriate prompt
  const topicDetection = await detectTopic(content);
  
  const prompt = buildNotesPrompt(content, title, topicDetection);
  
  const response = await askTutor(prompt, {
    systemPrompt: 'You are an expert tutor who TEACHES concepts clearly. Your notes should explain ideas in simple terms, not just copy video text. Students use your notes to learn without watching the video.',
  });

  const rawNotes = response.trim();
  
  // Parse structured data from response
  const structured = parseStructuredNotes(rawNotes, topicDetection);
  
  // Generate additional elements
  const summary = await generateSummary(content);
  const quiz = await generateQuiz(content, topicDetection);
  const actionItems = extractActionItems(rawNotes);
  
  return {
    topic: topicDetection,
    notes: rawNotes,
    structured: {
      ...structured,
      summary,
      quiz,
      actionItems,
      estimatedDuration: estimateDuration(content),
      wordCount: content.split(/\s+/).length,
    },
    formattedHtml: convertToHtml(rawNotes, topicDetection),
  };
}

async function detectTopic(content: string): Promise<string> {
  const contentLower = content.toLowerCase();
  
  const keywords = {
    math: ['equation', 'solve', 'formula', 'integral', 'derivative', 'triangle', 'sqrt', 'x²', 'calculate', 'theorem', 'proof', 'quadratic', 'function', 'algebra'],
    coding: ['def ', 'function', 'import', 'class ', 'variable', 'loop', 'if ', 'else', 'return', 'print', 'code', 'programming', 'algorithm', 'syntax'],
    science: ['atom', 'molecule', 'cell', 'organ', 'DNA', 'physics', 'chemistry', 'biology', 'reaction', 'experiment', 'force', 'energy'],
    history: ['war', 'king', 'empire', 'century', 'ancient', 'revolution', 'treaty', 'president', 'country', 'civilization'],
    general: []
  };

  let maxScore = 0;
  let detectedTopic = 'general';

  for (const [topic, words] of Object.entries(keywords)) {
    if (topic === 'general') continue;
    const score = words.filter(w => contentLower.includes(w)).length;
    if (score > maxScore) {
      maxScore = score;
      detectedTopic = topic;
    }
  }

  return detectedTopic;
}

function buildNotesPrompt(content: string, title: string, topic: string): string {
  const truncatedContent = content.slice(0, 12000);
  
  const topicPrompts: Record<string, string> = {
    math: `You are an expert math tutor. ANALYZE and SUMMARIZE this math video content.

TASK:
- Extract the MAIN CONCEPTS being taught (not just raw caption)
- Explain the KEY FORMULAS with step-by-step solutions
- Identify what the student should LEARN, not just hear
- Summarize the core idea in simple terms
- Include PRACTICE PROBLEMS with answers
- Point out COMMON MISTAKES to avoid

IMPORTANT: Don't just copy the video caption. UNDERSTAND and EXPLAIN the concepts in your own words as a teacher would.

VIDEO TITLE: ${title}

TRANSCRIPT:
${truncatedContent}`,

    coding: `You are an expert programmer. ANALYZE and SUMMARIZE this coding video.

TASK:
- Extract the MAIN CONCEPTS being taught (what programming concepts?)
- Explain code LOGIC and how it works (not just show code)
- Break down the implementation into clear STEPS
- Identify what the student should be able to DO after watching
- Summarize the core idea simply
- Point out COMMON ERRORS and how to fix them

IMPORTANT: Don't dump the video text. TEACH the concepts as a tutor would explain them.

VIDEO TITLE: ${title}

TRANSCRIPT:
${truncatedContent}`,

    science: `You are an expert science teacher. ANALYZE and SUMMARIZE this science video.

TASK:
- Extract the core SCIENTIFIC CONCEPTS being explained
- Explain how things WORK with clear explanations
- Identify KEY FACTS students must remember
- Summarize each main idea simply
- Include real-world EXAMPLES or applications
- Point out COMMON MISCONCEPTIONS

IMPORTANT: Don't copy the video. TEACH the science concepts clearly.

VIDEO TITLE: ${title}

TRANSCRIPT:
${truncatedContent}`,

    general: `You are an expert educator. ANALYZE and SUMMARIZE this video content.

TASK:
- Extract the MAIN LESSONS/KEY POINTS being taught
- Explain the core idea simply in YOUR WORDS (not video's words)
- Break down complex ideas into digestible pieces
- Identify what students should REMEMBER
- Include actionable STEPS if this is a how-to video
- Give PRACTICAL examples
- Summarize each section with the key takeaway

IMPORTANT: This is a study app - students come here to learn, not to read video transcripts. TEACH the content!

VIDEO TITLE: ${title}

TRANSCRIPT:
${truncatedContent}`
  };

  return topicPrompts[topic] || topicPrompts.general;
}

function parseStructuredNotes(rawNotes: string, topic: string) {
  const sections: Record<string, string[]> = {};
  let currentSection = '';
  
  const lines = rawNotes.split('\n');
  for (const line of lines) {
    // Detect section headers
    if (line.match(/^#{1,3}\s+|^[A-Z][A-Z\s]+:|^[📚🎯💡✨📝🔬🧬💻🔧⚡]+/)) {
      currentSection = line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
    } else if (currentSection && line.trim()) {
      sections[currentSection].push(line.trim());
    }
  }

  return sections;
}

async function generateSummary(content: string): Promise<string> {
  const truncated = content.slice(0, 3000);
  
  const prompt = `As an expert tutor, explain what this video teaches in simple terms. 

Focus on:
- What is the MAIN CONCEPT being taught?
- What will a student learn or be able to do after watching?
- Why is this important?

Keep it concise but meaningful - not just "this video is about X".

CONTENT:
${truncated}`;

  try {
    const response = await askTutor(prompt, {
      systemPrompt: 'You explain concepts clearly and concisely in simple terms.',
    });
    return response.trim();
  } catch {
    return 'Summary not available.';
  }
}

async function generateQuiz(content: string, topic: string): Promise<Array<{question: string; options: string[]; answer: string}>> {
  const truncated = content.slice(0, 5000);
  
  const prompt = `Create 3 quiz questions that TEST UNDERSTANDING (not just memory) from this video content.

Questions should:
- Test if student UNDERSTANDS the concept, not just memorized words
- Include some "why" or "how" questions
- Have one correct answer and plausible wrong options
- Cover the main ideas taught

FORMAT (JSON only):
[
  {"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}
]

CONTENT:
${truncated}`;

  try {
    const response = await askTutor(prompt, {
      systemPrompt: 'You create quiz questions that test understanding, not just recall. Return ONLY valid JSON.',
    });
    return JSON.parse(response.trim());
  } catch {
    return [];
  }
}

function extractActionItems(rawNotes: string): string[] {
  const actionKeywords = ['try', 'practice', 'do', 'install', 'create', 'build', 'make', 'start', 'remember', 'don\'t forget'];
  const items: string[] = [];
  
  const lines = rawNotes.toLowerCase().split('\n');
  for (const line of lines) {
    if (actionKeywords.some(kw => line.includes(kw)) && line.length > 20 && line.length < 150) {
      items.push(line.trim());
    }
  }
  
  return items.slice(0, 5);
}

function estimateDuration(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.ceil(words / 150);
  return `${minutes}-${minutes + 2} minutes`;
}

function convertToHtml(markdown: string, topic: string): string {
  // Topic-based color schemes
  const themeColors: Record<string, {primary: string; secondary: string; accent: string}> = {
    math: { primary: '#6366f1', secondary: '#818cf8', accent: '#c7d2fe' },
    coding: { primary: '#10b981', secondary: '#34d399', accent: '#a7f3d0' },
    science: { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#ddd6fe' },
    general: { primary: '#0ea5e9', secondary: '#38bdf8', accent: '#bae6fd' }
  };
  
  const theme = themeColors[topic] || themeColors.general;
  
  // Convert markdown to styled HTML
  let html = markdown
    // Headers
    .replace(/^### (.+)$/gm, `<h3 style="color: ${theme.primary}; border-bottom: 2px solid ${theme.secondary}; padding-bottom: 8px; margin-top: 24px;">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="color: ${theme.primary}; font-size: 1.5rem; margin-top: 28px;">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="color: ${theme.primary}; font-size: 1.8rem; border-bottom: 3px solid ${theme.secondary}; padding-bottom: 12px;">$1</h1>`)
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, `<strong style="color: #dc2626;">$1</strong>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color: ${theme.primary};">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="color: #475569;">$1</em>`)
    // Lists
    .replace(/^- (.+)$/gm, `<li style="margin: 8px 0; padding-left: 8px;">$1</li>`)
    .replace(/^\d+\. (.+)$/gm, `<li style="margin: 8px 0; padding-left: 8px; list-style-type: decimal;">$1</li>`)
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, `<pre style="background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: monospace;"><code>$2</code></pre>`)
    .replace(/`([^`]+)`/g, `<code style="background: ${theme.accent}; color: ${theme.primary}; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>`)
    // Line breaks
    .replace(/\n\n/g, '</p><p style="margin: 12px 0; line-height: 1.7;">')
    .replace(/\n/g, '<br>');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1e293b;">
      <style>
        .note-box { border-radius: 12px; padding: 16px; margin: 16px 0; }
        .concept-box { background: linear-gradient(135deg, ${theme.accent}, #fff); border-left: 4px solid ${theme.primary}; }
        .practice-box { background: #f0fdf4; border: 2px dashed #22c55e; padding: 16px; border-radius: 12px; }
        .warning-box { background: #fef2f2; border: 2px dashed #ef4444; padding: 16px; border-radius: 12px; }
      </style>
      <p style="margin: 12px 0; line-height: 1.7;">${html}</p>
    </div>
  `;
}