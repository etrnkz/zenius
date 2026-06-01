'use client';

import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { X, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react';

interface PPTXViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

interface Slide {
  title: string;
  texts: string[];
  images: string[];
  background: string;
}

export default function PPTXViewer({ fileUrl, fileName, onClose }: PPTXViewerProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPPTX();
  }, [fileUrl]);

  useEffect(() => {
    if (slides.length > 0 && canvasRef.current) {
      renderSlide(slides[currentSlide]);
    }
  }, [currentSlide, slides]);

  const loadPPTX = async () => {
    try {
      setLoading(true);
      let buffer: ArrayBuffer;
      
      if (fileUrl.startsWith('data:')) {
        const base64 = fileUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        buffer = await blob.arrayBuffer();
      }

      const zip = await JSZip.loadAsync(buffer);
      const parsedSlides = await parseAllSlides(zip);
      
      if (parsedSlides.length === 0) {
        throw new Error('No slides found');
      }
      
      setSlides(parsedSlides);
      setLoading(false);
    } catch (err) {
      console.error('PPTX load error:', err);
      setError('Failed to load PowerPoint file');
      setLoading(false);
    }
  };

  async function parseAllSlides(zip: JSZip): Promise<Slide[]> {
    const slides: Slide[] = [];
    const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
    
    for (const slideFile of slideFiles.slice(0, 20)) {
      try {
        const content = await zip.file(slideFile)?.async('text');
        if (content) {
          const slide = parseSlideContent(content);
          slides.push(slide);
        }
      } catch (e) {
        // Skip problematic slides
      }
    }
    
    return slides;
  }

  function parseSlideContent(xml: string): Slide {
    const titleMatch = xml.match(/<a:t>([^<]+)<\/a:t>/);
    const allTextMatches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    
    const texts = allTextMatches.map(m => m.replace(/<[^>]+>/g, ''));
    const title = titleMatch ? titleMatch[1] : (texts[0] || 'Slide');
    
    return {
      title,
      texts: texts.slice(1),
      images: [],
      background: '#ffffff'
    };
  }

  function renderSlide(slide: Slide) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.fillStyle = slide.background || '#ffffff';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(slide.title || 'Slide', w / 2, 60);
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, 90);
    ctx.lineTo(w - 80, 90);
    ctx.stroke();
    
    ctx.fillStyle = '#374151';
    ctx.font = '18px Arial, sans-serif';
    ctx.textAlign = 'left';
    
    const startY = 140;
    const lineHeight = 32;
    
    slide.texts.slice(0, 12).forEach((text, i) => {
      const displayText = text.length > 60 ? text.substring(0, 60) + '...' : text;
      ctx.fillText(`• ${displayText}`, 100, startY + i * lineHeight);
    });
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Slide ${currentSlide + 1} of ${slides.length}`, w / 2, h - 30);
  }

  const goToPrev = () => setCurrentSlide(prev => Math.max(0, prev - 1));
  const goToNext = () => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
          <button onClick={onClose} className="ml-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-zinc-400">Loading PowerPoint...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
          <button onClick={onClose} className="ml-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">{error}</h3>
            <p className="text-zinc-400 mb-6">This PowerPoint file couldn't be previewed</p>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Download className="h-4 w-4" />
              Download & Open in PowerPoint
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-zinc-400">
            Slide {currentSlide + 1} / {slides.length}
          </span>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-zinc-800">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="max-w-full h-auto rounded-lg shadow-2xl border border-zinc-700"
          style={{ cursor: 'pointer' }}
          onClick={goToNext}
        />
        
        <div className="flex items-center gap-4 mt-6">
          <button 
            onClick={goToPrev}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          
          <div className="flex gap-1">
            {slides.slice(0, 10).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentSlide ? 'bg-blue-500' : 'bg-zinc-600 hover:bg-zinc-500'
                }`}
              />
            ))}
            {slides.length > 10 && <span className="text-zinc-500 text-xs">...</span>}
          </div>
          
          <button 
            onClick={goToNext}
            disabled={currentSlide === slides.length - 1}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-xs text-zinc-500 mt-4">Click slide or use arrows to navigate</p>
      </div>
    </div>
  );
}