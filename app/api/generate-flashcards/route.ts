import { NextRequest, NextResponse } from 'next/server';
import { generateFlashcardsWithAI } from '@/lib/data-generator';

export async function POST(request: NextRequest) {
  try {
    const { content, title, count, flashcardStyle } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const flashcards = await generateFlashcardsWithAI(content, title || 'Untitled Note', count, flashcardStyle);

    return NextResponse.json({
      success: true,
      flashcards,
    });
  } catch (error) {
    console.error('[app] Generate flashcards error:', error);
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 });
  }
}
