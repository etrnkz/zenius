'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import dynamic from 'next/dynamic';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PPTXViewer = dynamic(() => import('./PPTXViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
    </div>
  )
});

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.odt', '.ods', '.odp'];

function getFileExtension(filename: string): string {
  const ext = (filename || '').toLowerCase().slice((filename || '').lastIndexOf('.'));
  return ext.replace('.', '');
}

function getFileType(filename: string): string {
  const ext = getFileExtension(filename);
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['xls', 'xlsx'].includes(ext)) return 'xlsx';
  if (['ppt', 'pptx'].includes(ext)) return 'pptx';
  return 'text';
}

interface UniversalDocViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function UniversalDocViewer({ fileUrl, fileName, onClose }: UniversalDocViewerProps) {
  const fileType = getFileType(fileName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (fileType === 'pdf') {
    return <PdfViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }
  
  if (fileType === 'xlsx') {
    return <ExcelViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }
  
  if (fileType === 'docx') {
    return <DocxViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }

  if (fileType === 'pptx') {
    return <PPTXViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
        <button
          onClick={onClose}
          className="ml-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <p className="text-lg mb-2">📄 Preview not available</p>
          <p className="text-sm">This file type will open in the native app</p>
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Open in App
          </a>
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ fileUrl, fileName, onClose }: { fileUrl: string; fileName: string; onClose: () => void }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF');
    setLoading(false);
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1));
  const zoomIn = () => setScale(prev => Math.min(2.5, prev + 0.25));
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.25));

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
        <div className="flex items-center gap-2 ml-4">
          <button onClick={zoomOut} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-zinc-400 min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-2" />
          <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-zinc-400 min-w-[60px] text-center">
            {pageNumber} / {numPages || '?'}
          </span>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-2" />
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-zinc-800 flex justify-center p-4">
        {loading && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center text-red-400">
            {error}
          </div>
        )}
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="shadow-2xl"
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            className="shadow-2xl"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

function ExcelViewer({ fileUrl, fileName, onClose }: { fileUrl: string; fileName: string; onClose: () => void }) {
  const [sheets, setSheets] = useState<Array<{ name: string; data: any[] }>>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExcel();
  }, [fileUrl]);

  const loadExcel = async () => {
    try {
      let data: any;
      if (fileUrl.startsWith('data:')) {
        const base64 = fileUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        data = bytes;
      } else {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        data = arrayBuffer;
      }

      const workbook = XLSX.read(data, { type: 'array' });
      const sheetData = workbook.SheetNames.map(name => {
        const worksheet = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return { name, data: json };
      });
      
      setSheets(sheetData);
      setLoading(false);
    } catch (err) {
      console.error('Excel load error:', err);
      setError('Failed to load Excel file');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex justify-end p-4">
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
        <button onClick={onClose} className="ml-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-2 flex gap-2 overflow-x-auto">
        {sheets.map((sheet, index) => (
          <button
            key={index}
            onClick={() => setActiveSheet(index)}
            className={`px-3 py-1.5 text-sm rounded whitespace-nowrap ${
              activeSheet === index 
                ? 'bg-blue-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {sheet.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {currentSheet.data.slice(0, 100).map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-100 font-semibold' : ''}>
                {row.map((cell: any, cellIndex: number) => (
                  <td 
                    key={cellIndex} 
                    className="border border-gray-200 px-2 py-1 text-gray-800 min-w-[80px] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {cell !== undefined && cell !== null ? String(cell) : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocxViewer({ fileUrl, fileName, onClose }: { fileUrl: string; fileName: string; onClose: () => void }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocx();
  }, [fileUrl]);

  const loadDocx = async () => {
    try {
      let arrayBuffer: ArrayBuffer;
      if (fileUrl.startsWith('data:')) {
        const base64 = fileUrl.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const response = await fetch(fileUrl);
        arrayBuffer = await response.arrayBuffer();
      }

      const result = await mammoth.convertToHtml({ arrayBuffer });
      setHtml(result.value);
      setLoading(false);
    } catch (err) {
      console.error('DOCX load error:', err);
      setError('Failed to load Word document');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex justify-end p-4">
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm text-zinc-300 truncate flex-1">{fileName}</span>
        <button onClick={onClose} className="ml-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto bg-white p-8">
        <div 
          className="max-w-3xl mx-auto prose prose-sm prose-gray"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}