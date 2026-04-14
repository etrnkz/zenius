import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods', '.odp'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('id');
    
    if (!noteId) {
      return NextResponse.json({ error: 'No file specified' }, { status: 400 });
    }

    // In this app, notes are stored client-side in localStorage
    // The frontend will handle the actual download using the fileUrl
    // This endpoint is a placeholder for server-side file handling if needed
    
    return NextResponse.json({ 
      error: 'This endpoint works with frontend. Use the fileUrl from note data.',
      noteId 
    }, { status: 400 });
  } catch (error) {
    console.error('[app] File download error:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}