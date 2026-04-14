#!/usr/bin/env python3
import sys
import json
import re
import requests
from urllib.parse import urlparse

# Try to import yt_dlp, fallback to None if not available
try:
    import yt_dlp
    YTDLP_AVAILABLE = True
except ImportError:
    YTDLP_AVAILABLE = False
    print("yt-dlp not available, using fallback methods", file=sys.stderr)

def parse_json3_transcript(json3_text):
    try:
        data = json.loads(json3_text)
        events = data.get('events', [])
        texts = []
        for event in events:
            segs = event.get('segs', [])
            for seg in segs:
                utf8 = seg.get('utf8', '')
                if utf8:
                    texts.append(utf8)
        return ' '.join(texts)
    except:
        return json3_text

def extract_video_id(url):
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([^&\n?#]+)',
        r'youtube\.com/shorts/([^&\n?#]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def extract_youtube(url):
    video_id = extract_video_id(url)
    if not video_id:
        return {'error': 'Invalid YouTube URL'}
    
    result = {'video_id': video_id, 'source': url, 'type': 'youtube'}
    
    if YTDLP_AVAILABLE:
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                result['title'] = info.get('title', '')
                result['description'] = info.get('description', '')[:2000]
                result['duration'] = info.get('duration', 0)
                
                subtitles = info.get('subtitles', {})
                auto_captions = info.get('automatic_captions', {})
                
                for lang in ['en', 'en-US']:
                    for caption_dict in [subtitles, auto_captions]:
                        if lang in caption_dict:
                            sub = caption_dict[lang]
                            if sub and len(sub) > 0:
                                sub_url = sub[0].get('url')
                                if sub_url:
                                    try:
                                        resp = requests.get(sub_url, timeout=10)
                                        if resp.status_code == 200:
                                            content = resp.text
                                            if content.strip().startswith('{'):
                                                content = parse_json3_transcript(content)
                                            result['transcript'] = content
                                            result['transcript_source'] = 'yt-dlp'
                                            return result
                                    except:
                                        pass
        except Exception as e:
            result['ydl_error'] = str(e)
    
    # Fallback: Try YouTube timedtext API
    try:
        timedtext_url = f"https://www.youtube.com/api/timedtext?v={video_id}&lang=en&fmt=json3"
        resp = requests.get(timedtext_url, timeout=10)
        if resp.status_code == 200 and len(resp.text) > 100:
            result['transcript'] = parse_json3_transcript(resp.text)
            result['transcript_source'] = 'timedtext'
            return result
    except:
        pass
    
    try:
        timedtext_url = f"https://www.youtube.com/api/timedtext?v={video_id}&lang=en&fmt=vtt"
        resp = requests.get(timedtext_url, timeout=10)
        if resp.status_code == 200 and len(resp.text) > 100:
            result['transcript'] = resp.text
            result['transcript_source'] = 'timedtext-vtt'
            return result
    except:
        pass
    
    # Try to get title via oEmbed
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        resp = requests.get(oembed_url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            result['title'] = data.get('title', result.get('title', ''))
    except:
        pass
    
    return result

def extract_website(url):
    result = {'source': url, 'type': 'website'}
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        resp = requests.get(url, timeout=15, headers=headers)
        result['status_code'] = resp.status_code
        
        if resp.status_code != 200:
            result['error'] = f"HTTP {resp.status_code}"
            return result
        
        html = resp.text
        
        # Extract title
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
        if title_match:
            result['title'] = title_match.group(1).strip()
        
        # Extract meta description
        desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
        if not desc_match:
            desc_match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']description["\']', html, re.I)
        if desc_match:
            result['description'] = desc_match.group(1)[:500]
        
        # Remove script and style tags
        cleaned = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', html, flags=re.I)
        cleaned = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', cleaned, flags=re.I)
        
        # Extract main content
        text = re.sub(r'<[^>]+>', ' ', cleaned)
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Limit size
        if len(text) > 50000:
            text = text[:50000]
        
        result['content'] = text
        result['word_count'] = len(text.split())
        
        # Look for embedded videos
        videos = []
        for match in re.findall(r'<iframe[^>]*src=["\']([^"\']+)["\']', html, re.I):
            if 'youtube' in match or 'vimeo' in match or 'player' in match:
                videos.append(match)
        
        if videos:
            result['embedded_videos'] = videos[:5]
        
        return result
        
    except Exception as e:
        result['error'] = str(e)
        return result

def extract_direct_video(url):
    result = {'source': url, 'type': 'direct_video'}
    
    try:
        # HEAD request to get info
        head = requests.head(url, timeout=10, allow_redirects=True)
        content_type = head.headers.get('content-type', '').lower()
        content_length = int(head.headers.get('content-length', 0) or 0)
        
        result['content_type'] = content_type
        result['size_bytes'] = content_length
        
        if YTDLP_AVAILABLE:
            try:
                ydl_opts = {'skip_download': True, 'quiet': True}
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    result['title'] = info.get('title', '')
                    result['duration'] = info.get('duration', 0)
                    result['thumbnail'] = info.get('thumbnail', '')
            except:
                pass
        
        result['ready_for_transcription'] = True
        return result
        
    except Exception as e:
        result['error'] = str(e)
        return result

def analyze_and_extract(url):
    """Main function - detects type and extracts content"""
    
    parsed = urlparse(url)
    path = parsed.path.lower()
    query = parsed.query.lower()
    
    # YouTube detection
    if 'youtube.com' in url or 'youtu.be' in url:
        return extract_youtube(url)
    
    # Video file extensions
    video_exts = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v', '.3gp']
    if any(path.endswith(ext) for ext in video_exts):
        return extract_direct_video(url)
    
    # Audio file extensions
    audio_exts = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']
    if any(path.endswith(ext) for ext in audio_exts):
        return {'source': url, 'type': 'audio', 'ready_for_transcription': True}
    
    # PDF detection
    if path.endswith('.pdf'):
        return {'source': url, 'type': 'pdf', 'note': 'PDF extraction not implemented yet'}
    
    # Default: treat as website
    return extract_website(url)

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else ''
    if not url:
        print(json.dumps({'error': 'No URL provided'}))
    else:
        result = analyze_and_extract(url)
        print(json.dumps(result, ensure_ascii=False))