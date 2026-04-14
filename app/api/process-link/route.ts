import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
      }

      // Use Python script for better YouTube extraction
      try {
        const { execSync } = require('child_process');
        const scriptPath = require('path').join(process.cwd(), 'scripts', 'youtube-extractor.py');
        
        const result = execSync(`python3 "${scriptPath}" "${url}"`, {
          encoding: 'utf-8',
          timeout: 30000,
        });
        
        const data = JSON.parse(result);
        
        if (data.error) {
          return NextResponse.json({ error: data.error }, { status: 400 });
        }
        
        return NextResponse.json({
          success: true,
          type: 'youtube',
          content: data.transcript || data.description || '',
          title: data.title || `YouTube Video (${videoId})`,
          description: data.description,
          warning: data.transcript ? undefined : 'No transcript available, using description',
        });
      } catch (error) {
        console.error('[app] Python YouTube extraction error:', error);
        
        // Fallback to the original method
        try {
          const transcript = await getYouTubeTranscript(videoId);
          return NextResponse.json({
            success: true,
            type: 'youtube',
            content: transcript,
            title: `YouTube Video (${videoId})`,
          });
        } catch (fallbackError) {
          console.error('[app] YouTube fallback error:', fallbackError);
          return NextResponse.json({
            success: true,
            type: 'youtube',
            content: 'YouTube video - no transcript available. Content will be based on video title and description if provided.',
            title: `YouTube Video (${videoId})`,
            warning: 'No transcript available for this video',
          });
        }
      }
    }

    // For all other URLs (websites, videos, etc.), use the Python universal extractor
    try {
      const { execSync } = require('child_process');
      const scriptPath = require('path').join(process.cwd(), 'scripts', 'youtube-extractor.py');
      
      const result = execSync(`python3 "${scriptPath}" "${url}"`, {
        encoding: 'utf-8',
        timeout: 30000,
      });
      
      const data = JSON.parse(result);
      
      if (data.error) {
        return NextResponse.json({ error: data.error }, { status: 400 });
      }
      
      // Determine content based on type
      let content = '';
      if (data.transcript) {
        content = data.transcript;
      } else if (data.content) {
        content = data.content;
      } else if (data.description) {
        content = data.description;
      }
      
      return NextResponse.json({
        success: true,
        type: data.type || 'website',
        content: content || 'Unable to extract content from this URL.',
        title: data.title || `Web Resource: ${url}`,
        description: data.description,
        embedded_videos: data.embedded_videos,
        word_count: data.word_count,
      });
    } catch (error) {
      console.error('[app] Python extraction error:', error);
      
      // Fallback to original method
      try {
        const content = await extractWebPageText(url);
        return NextResponse.json({
          success: true,
          type: 'website',
          content: content || 'Unable to extract content from this URL. Please provide the main content manually.',
          title: `Web Resource: ${url}`,
        });
      } catch (fallbackError) {
        console.error('[app] Fallback extraction error:', fallbackError);
        return NextResponse.json({
          success: true,
          type: 'website',
          content: 'Unable to extract content from this URL. Please provide the main content manually.',
          title: `Web Resource: ${url}`,
        });
      }
    }
  } catch (error) {
    console.error('[app] Link processing error:', error);
    return NextResponse.json({ error: 'Failed to process link' }, { status: 500 });
  }
}

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function getYouTubeTranscript(videoId: string): Promise<string> {
  const errors: string[] = [];

  // Method 1: Try YouTube's embedded transcript data
  try {
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch video page');
    }

    const html = await response.text();
    
    // Try to find transcript data in player response
    const playerResponseMatch = html.match(/"playerResponse":\s*({[^}]+})/);
    if (playerResponseMatch) {
      try {
        const playerData = JSON.parse(playerResponseMatch[1]);
        const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (captions && Array.isArray(captions) && captions.length > 0) {
          // Get the first available caption track
          const transcriptUrl = captions[0].baseUrl;
          
          // Fetch the transcript XML
          const transcriptResponse = await fetch(transcriptUrl);
          if (transcriptResponse.ok) {
            const transcriptXml = await transcriptResponse.text();
            
            // Parse XML to extract text
            const textMatches = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/g);
            if (textMatches) {
              const texts = textMatches.map(match => {
                const textMatch = match.match(/<text[^>]*>([^<]*)<\/text>/);
                return textMatch ? textMatch[1] : '';
              });
              
              const transcript = texts
                .map(t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              if (transcript.length > 100) {
                return transcript;
              }
            }
          }
        }
      } catch (parseError) {
        console.warn('[app] Failed to parse YouTube player response:', parseError);
      }
    }
    
    // Alternative: Look for transcript in page text
    const transcriptMatch = html.match(/"transcriptBody":"([^"]*)"/);
    if (transcriptMatch) {
      return decodeURIComponent(transcriptMatch[1]).replace(/\\"/g, '"');
    }
  } catch (error) {
    errors.push('Method 1: ' + String(error));
    console.warn('[app] YouTube transcript method 1 failed:', error);
  }

  // Method 2: Try alternative transcript endpoints
  try {
    const altResponse = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    
    if (altResponse.ok) {
      const xml = await altResponse.text();
      const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g);
      if (textMatches && textMatches.length > 0) {
        const texts = textMatches.map(match => {
          const textMatch = match.match(/<text[^>]*>([^<]*)<\/text>/);
          return textMatch ? textMatch[1] : '';
        });
        
        const transcript = texts
          .map(t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (transcript.length > 100) {
          return transcript;
        }
      }
    }
  } catch (error) {
    errors.push('Method 2: ' + String(error));
    console.warn('[app] YouTube transcript method 2 failed:', error);
  }

  // Method 3: Try Invidious API (privacy-friendly YouTube frontend)
  try {
    const invidiousResponses = [
      'https://invidious.fdn.fr/api/v1/videos/' + videoId,
      'https://invidious.snopyta.org/api/v1/videos/' + videoId,
      'https://yewtu.be/api/v1/videos/' + videoId,
    ];

    for (const apiUrl of invidiousResponses) {
      try {
        const response = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Try to get transcript from captions
          if (data.captions && Array.isArray(data.captions) && data.captions.length > 0) {
            const captionUrl = data.captions[0].url;
            const captionResponse = await fetch(captionUrl);
            if (captionResponse.ok) {
              const xml = await captionResponse.text();
              const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g);
              if (textMatches && textMatches.length > 0) {
                const texts = textMatches.map(match => {
                  const textMatch = match.match(/<text[^>]*>([^<]*)<\/text>/);
                  return textMatch ? textMatch[1] : '';
                });
                
                const transcript = texts
                  .map(t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
                  .join(' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (transcript.length > 100) {
                  return transcript;
                }
              }
            }
          }
          
          // Fall back to description if available
          if (data.description) {
            const desc = typeof data.description === 'string' ? data.description : data.description.join('\n');
            if (desc.length > 200) {
              return '[Video Description]\n' + desc + '\n\n[Note: No transcript available. Content extracted from video description.]';
            }
          }
        }
      } catch (e) {
        console.warn('[app] Invidious API attempt failed:', e);
      }
    }
  } catch (error) {
    errors.push('Method 3: ' + String(error));
    console.warn('[app] YouTube transcript method 3 (Invidious) failed:', error);
  }

  // Method 4: Try oEmbed to get description
  try {
    const oembedResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );
    
    if (oembedResponse.ok) {
      const oembedData = await oembedResponse.json();
      if (oembedData.title) {
        const fallbackContent = `[Video Title: ${oembedData.title}]\n\n[Note: No transcript or full description available. The video content could not be extracted.]\n\nTo get the full video content, you may need to:\n1. Use a YouTube transcript browser extension\n2. Manually paste the video content\n3. Use a desktop app like yt-dlp to download the transcript`;
        return fallbackContent;
      }
    }
  } catch (error) {
    errors.push('Method 4: ' + String(error));
    console.warn('[app] YouTube oEmbed method failed:', error);
  }

  console.error('[app] All YouTube transcript methods failed. Errors:', errors);
  throw new Error('No transcript found. Tried: ' + errors.join(', '));
}

async function extractWebPageText(url: string): Promise<string> {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Parse HTML and extract text
    const text = extractTextFromHTML(html);
    
    // Limit content length
    return text.slice(0, 50000);
  } catch (error) {
    console.error('[app] Web page extraction error:', error);
    return '';
  }
}

function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  
  // Remove common non-content elements
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ');
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ');
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ');
  cleaned = cleaned.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ');
  
  // Remove ads and sidebar patterns
  cleaned = cleaned.replace(/<div[^>]*class=["'][^"']*(?:ad|sidebar|widget)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ');
  
  // Extract text from remaining HTML
  // Remove all HTML tags
  const text = cleaned.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return cleanedText;
}
