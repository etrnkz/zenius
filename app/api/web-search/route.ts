import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    }

    // Try Serper API first
    const serperKey = process.env.SERPER_API_KEY;
    
    if (serperKey?.trim()) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 10 }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const results = ((data as { organic?: Array<{ title?: string; link?: string; snippet?: string }> }).organic || []).map((item) => ({
          title: item.title || 'Untitled',
          url: item.link || '',
          snippet: item.snippet || '',
        }));
        return NextResponse.json({ results, query, source: 'serper' });
      }
    }

    // Fallback to DuckDuckGo (free, no key needed)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(ddgUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    const data = await response.json();
    
    const results = ((data.RelatedTopics as Array<{ Text?: string; FirstURL?: string }>) || []).map((item) => ({
      title: item.Text || 'Untitled',
      url: item.FirstURL || '',
      snippet: item.Text || '',
    })).slice(0, 10);

    return NextResponse.json({ results, query, source: 'duckduckgo' });
  } catch (error) {
    console.error('[app] Web search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}