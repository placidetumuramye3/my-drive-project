import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  History, 
  Edit3, 
  Save, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Archive,
  Code,
  CheckCircle2, 
  Eye, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Search,
  Printer,
  Table,
  FileCode,
  FlipHorizontal,
  Grid,
  FileCheck,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { FileItem } from '../../types/drive';
import { formatBytes } from '../../services/db';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  files?: FileItem[];
  onNavigateFile?: (file: FileItem) => void;
  onOpenShare: (fileId: string) => void;
  onOpenVersions: (fileId: string) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  files = [],
  onNavigateFile,
  onOpenShare,
  onOpenVersions,
}) => {
  const { downloadFile, getFileBlob, saveFileNewVersion } = useDrive();

  // Content state
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);
  const [copiedFilename, setCopiedFilename] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Image controls
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFlipH, setImageFlipH] = useState(false);
  const [imageBgMode, setImageBgMode] = useState<'dark' | 'light' | 'checkerboard'>('dark');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // PDF controls
  const [pdfMode, setPdfMode] = useState<'embed' | 'reader'>('embed');
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfSearch, setPdfSearch] = useState('');

  // Text & Document controls
  const [textViewTab, setTextViewTab] = useState<'formatted' | 'raw' | 'table'>('formatted');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [textSearch, setTextSearch] = useState('');
  const [wrapLines, setWrapLines] = useState(true);

  // CSV controls
  const [csvSortCol, setCsvSortCol] = useState<number | null>(null);
  const [csvSortAsc, setCsvSortAsc] = useState(true);
  const [csvFilter, setCsvFilter] = useState('');

  // Reset controls when active file changes
  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;

    async function loadPreview() {
      if (!file) return;
      setIsLoading(true);
      setIsEditing(false);
      setSaveSuccess(false);
      setImageZoom(1);
      setImageRotation(0);
      setImageFlipH(false);
      setPanPosition({ x: 0, y: 0 });
      setImageDimensions(null);
      setPdfZoom(1);
      setTextSearch('');
      setPdfSearch('');
      setCsvFilter('');

      // Auto-select best tab for text document
      if (file.extension === 'csv' || file.extension === 'tsv') {
        setTextViewTab('table');
      } else if (file.extension === 'md' || file.extension === 'markdown') {
        setTextViewTab('formatted');
      } else {
        setTextViewTab('raw');
      }

      try {
        const blob = await getFileBlob(file.blobId);
        if (blob && isMounted) {
          activeUrl = URL.createObjectURL(blob);
          setBlobUrl(activeUrl);

          // Extract text for text-like documents or fallback text
          if (
            file.category === 'document' || 
            file.category === 'code' || 
            file.mimeType.startsWith('text/') ||
            file.extension === 'json' ||
            file.extension === 'xml' ||
            file.extension === 'csv' ||
            file.extension === 'md' ||
            file.extension === 'txt' ||
            file.extension === 'pdf'
          ) {
            try {
              const txt = await blob.text();
              // Check if text is legible text or binary
              const isBinary = /[\x00-\x08\x0E-\x1F]/.test(txt.slice(0, 500));
              if (!isBinary) {
                setTextContent(txt);
                setEditedText(txt);
              } else if (file.textContent) {
                setTextContent(file.textContent);
                setEditedText(file.textContent);
              } else {
                setTextContent('');
                setEditedText('');
              }
            } catch {
              setTextContent(file.textContent || '');
              setEditedText(file.textContent || '');
            }
          }
        } else if (file.textContent) {
          setTextContent(file.textContent);
          setEditedText(file.textContent);
        }
      } catch (err) {
        console.error('Failed to load file blob:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (isOpen && file) {
      loadPreview();
    }

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [isOpen, file, getFileBlob]);

  // Current file index in list for Previous/Next navigation
  const currentIndex = useMemo(() => {
    if (!file || !files.length) return -1;
    return files.findIndex(f => f.id === file.id);
  }, [file, files]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < files.length - 1;

  const handlePrevFile = () => {
    if (hasPrev && onNavigateFile) {
      onNavigateFile(files[currentIndex - 1]);
    }
  };

  const handleNextFile = () => {
    if (hasNext && onNavigateFile) {
      onNavigateFile(files[currentIndex + 1]);
    }
  };

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is editing in a textarea/input
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (!isInput) {
        if (e.key === 'ArrowLeft' && hasPrev) {
          e.preventDefault();
          handlePrevFile();
        } else if (e.key === 'ArrowRight' && hasNext) {
          e.preventDefault();
          handleNextFile();
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setIsFullscreen(prev => !prev);
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          if (file?.category === 'image') {
            setImageZoom(prev => Math.min(prev + 0.25, 4));
          } else if (file?.extension === 'pdf') {
            setPdfZoom(prev => Math.min(prev + 0.25, 2.5));
          }
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          if (file?.category === 'image') {
            setImageZoom(prev => Math.max(prev - 0.25, 0.25));
          } else if (file?.extension === 'pdf') {
            setPdfZoom(prev => Math.max(prev - 0.25, 0.5));
          }
        } else if (e.key === 'r' || e.key === 'R') {
          if (file?.category === 'image') {
            e.preventDefault();
            setImageRotation(prev => (prev + 90) % 360);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, currentIndex, file]);

  if (!isOpen || !file) return null;

  // File categorization helpers
  const isImage = file.category === 'image';
  const isPdf = file.extension === 'pdf' || file.mimeType === 'application/pdf';
  const isAudio = file.category === 'audio';
  const isVideo = file.category === 'video';
  const isArchive = file.category === 'archive';
  const isMarkdown = file.extension === 'md' || file.extension === 'markdown';
  const isCsv = file.extension === 'csv' || file.extension === 'tsv';
  const isTextLike = !isImage && !isPdf && !isAudio && !isVideo && !isArchive && (
    file.category === 'document' || 
    file.category === 'code' || 
    file.mimeType.startsWith('text/') ||
    ['txt', 'md', 'csv', 'tsv', 'json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'sql', 'sh', 'xml', 'yaml', 'yml', 'log'].includes(file.extension.toLowerCase())
  );

  // Copy helpers
  const handleCopyChecksum = () => {
    navigator.clipboard.writeText(file.checksum);
    setCopiedChecksum(true);
    setTimeout(() => setCopiedChecksum(false), 2000);
  };

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(file.name);
    setCopiedFilename(true);
    setTimeout(() => setCopiedFilename(false), 2000);
  };

  const handleCopyFullText = () => {
    navigator.clipboard.writeText(textContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Save new revision
  const handleSaveText = async () => {
    if (!editedText.trim()) return;
    setIsSaving(true);
    const res = await saveFileNewVersion(file.id, editedText, 'Edited in Drive Text Viewer');
    setIsSaving(false);
    if (res.success) {
      setTextContent(editedText);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }
  };

  // Image pan & drag
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (imageZoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanPosition({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y
    });
  };

  const handleImageMouseUp = () => {
    setIsPanning(false);
  };

  // Parsed CSV data for Table View
  const parsedCsv = useMemo(() => {
    if (!isCsv || !textContent) return { headers: [], rows: [] };
    const lines = textContent.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (l: string) => {
      // Basic CSV parser handling quotes
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if ((c === ',' || c === '\t') && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    let rows = lines.slice(1).map(parseLine);

    // Apply search filter
    if (csvFilter.trim()) {
      const q = csvFilter.toLowerCase();
      rows = rows.filter(r => r.some(cell => cell.toLowerCase().includes(q)));
    }

    // Apply sorting
    if (csvSortCol !== null && csvSortCol < headers.length) {
      rows.sort((a, b) => {
        const valA = a[csvSortCol] || '';
        const valB = b[csvSortCol] || '';
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return csvSortAsc ? numA - numB : numB - numA;
        }
        return csvSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return { headers, rows, totalLines: lines.length - 1 };
  }, [isCsv, textContent, csvFilter, csvSortCol, csvSortAsc]);

  // Markdown rendering helper
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      // Headings
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-xl sm:text-2xl font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4 mt-6 first:mt-0">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-lg sm:text-xl font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-3 mt-5">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-base font-semibold text-slate-800 mb-2 mt-4">{line.slice(4)}</h3>;
      }
      // Blockquote
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-4 border-blue-500 pl-4 py-1.5 my-2.5 bg-blue-50/50 text-slate-700 italic rounded-r-lg text-xs sm:text-sm">
            {line.slice(2)}
          </blockquote>
        );
      }
      // Unordered list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().slice(2);
        const isCheckmark = bulletText.startsWith('[x] ') || bulletText.startsWith('[ ] ');
        if (isCheckmark) {
          const checked = bulletText.startsWith('[x] ');
          const label = bulletText.slice(4);
          return (
            <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 my-1 ml-2">
              <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checked ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                {checked && '✓'}
              </span>
              <span className={checked ? 'line-through text-slate-400' : ''}>{label}</span>
            </div>
          );
        }
        return (
          <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 my-1 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
            <span>{bulletText}</span>
          </div>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-3" />;
      }
      // Standard paragraph
      return (
        <p key={idx} className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-2">
          {line}
        </p>
      );
    });
  };

  // Code line count / stats
  const textStats = useMemo(() => {
    if (!textContent) return { lines: 0, words: 0, chars: 0 };
    const lines = textContent.split('\n').length;
    const words = textContent.trim().split(/\s+/).filter(Boolean).length;
    const chars = textContent.length;
    return { lines, words, chars };
  }, [textContent]);

  // Filtered lines for search in text
  const highlightedTextLines = useMemo(() => {
    if (!textContent) return [];
    const lines = textContent.split('\n');
    return lines;
  }, [textContent]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-5'
      }`}
    >
      <div 
        className={`bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'w-full max-w-6xl h-[92vh] rounded-3xl'
        }`}
      >
        {/* Top Header Toolbar */}
        <header className="h-16 px-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          {/* File identity */}
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              {isImage && <ImageIcon className="w-4 h-4 text-pink-400" />}
              {isPdf && <FileText className="w-4 h-4 text-red-400" />}
              {isTextLike && !isPdf && <FileText className="w-4 h-4 text-blue-400" />}
              {isAudio && <Music className="w-4 h-4 text-amber-400" />}
              {isVideo && <Video className="w-4 h-4 text-purple-400" />}
              {isArchive && <Archive className="w-4 h-4 text-orange-400" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm truncate text-white" title={file.name}>
                  {file.name}
                </h2>
                <button
                  type="button"
                  onClick={handleCopyFilename}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title="Copy Filename"
                >
                  {copiedFilename ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
                <span className="font-mono">{formatBytes(file.sizeBytes)}</span>
                <span>•</span>
                <span className="bg-white/10 text-slate-300 px-1.5 py-0.2 rounded text-[10px] font-medium uppercase font-mono">
                  {file.extension}
                </span>
                <span>•</span>
                <span>v{file.versions?.length || 1}</span>
                {files.length > 1 && currentIndex !== -1 && (
                  <>
                    <span>•</span>
                    <span className="text-slate-300 font-medium">
                      {currentIndex + 1} of {files.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions & Format Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Previous / Next file buttons if list available */}
            {files.length > 1 && (
              <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 mr-1">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={handlePrevFile}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                  title="Previous File (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={handleNextFile}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                  title="Next File (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Document specific controls */}
            {isTextLike && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isEditing 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                  title={isEditing ? 'Exit edit mode' : 'Edit document text'}
                >
                  {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isEditing ? 'View Mode' : 'Edit'}</span>
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleCopyFullText}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    title="Copy full text to clipboard"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden lg:inline">{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>
                )}
              </>
            )}

            {/* Version History */}
            <button
              type="button"
              onClick={() => onOpenVersions(file.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Version Revisions"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Versions ({file.versions?.length || 1})</span>
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={() => onOpenShare(file.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Share File"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={() => downloadFile(file.id)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-red-500/80 text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Format Sub-Toolbar */}
        <div className="h-11 px-4 sm:px-6 bg-slate-800/90 text-slate-200 border-b border-slate-700/60 flex items-center justify-between text-xs shrink-0 overflow-x-auto">
          {/* Left sub-toolbar tabs / modes */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Image Sub-toolbar */}
            {isImage && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">Zoom:</span>
                <button
                  type="button"
                  onClick={() => setImageZoom(prev => Math.max(0.25, prev - 0.25))}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-12 text-center text-slate-300 font-semibold">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImageZoom(prev => Math.min(4, prev + 0.25))}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setImageZoom(1); setPanPosition({ x: 0, y: 0 }); }}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer ml-1"
                >
                  Actual (100%)
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button
                  type="button"
                  onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                  title="Rotate 90° Clockwise (R)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rotate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageFlipH(prev => !prev)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Flip</span>
                </button>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <div className="flex items-center bg-black/30 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setImageBgMode('dark')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      imageBgMode === 'dark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageBgMode('light')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      imageBgMode === 'light' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageBgMode('checkerboard')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      imageBgMode === 'checkerboard' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Checkerboard grid for transparent PNG/SVG"
                  >
                    Grid
                  </button>
                </div>
              </div>
            )}

            {/* PDF Sub-toolbar */}
            {isPdf && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/30 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setPdfMode('embed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      pdfMode === 'embed' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Native PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfMode('reader')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      pdfMode === 'reader' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Document Reader
                  </button>
                </div>

                {pdfMode === 'reader' && (
                  <>
                    <div className="w-px h-4 bg-slate-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => setPdfZoom(prev => Math.max(0.6, prev - 0.2))}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] w-12 text-center text-slate-300 font-semibold">
                      {Math.round(pdfZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdfZoom(prev => Math.min(2.0, prev + 0.2))}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfZoom(1)}
                      className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-[11px] transition-colors cursor-pointer"
                    >
                      Fit (100%)
                    </button>
                  </>
                )}

                <div className="w-px h-4 bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {blobUrl && (
                  <a
                    href={blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                    title="Open in new browser tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open in Tab</span>
                  </a>
                )}
              </div>
            )}

            {/* Text / Markdown / CSV Sub-toolbar */}
            {isTextLike && !isEditing && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-black/30 rounded-xl p-0.5">
                  {isMarkdown && (
                    <button
                      type="button"
                      onClick={() => setTextViewTab('formatted')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        textViewTab === 'formatted' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Formatted View
                    </button>
                  )}
                  {isCsv && (
                    <button
                      type="button"
                      onClick={() => setTextViewTab('table')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        textViewTab === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Table Grid</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTextViewTab('raw')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      textViewTab === 'raw' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Raw Code / Text</span>
                  </button>
                </div>

                {textViewTab === 'raw' && (
                  <>
                    <div className="w-px h-4 bg-slate-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => setShowLineNumbers(!showLineNumbers)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        showLineNumbers ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Line Numbers
                    </button>
                    <button
                      type="button"
                      onClick={() => setWrapLines(!wrapLines)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        wrapLines ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Wrap Lines
                    </button>
                  </>
                )}

                {/* Search in Document */}
                <div className="relative ml-2">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={isCsv && textViewTab === 'table' ? csvFilter : textSearch}
                    onChange={(e) => {
                      if (isCsv && textViewTab === 'table') {
                        setCsvFilter(e.target.value);
                      } else {
                        setTextSearch(e.target.value);
                      }
                    }}
                    placeholder={isCsv && textViewTab === 'table' ? 'Filter rows...' : 'Find text...'}
                    className="w-32 sm:w-44 pl-7 pr-2.5 py-1 bg-black/25 text-slate-200 placeholder-slate-500 rounded-lg text-[11px] outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700/60"
                  />
                  {(isCsv && textViewTab === 'table' ? csvFilter : textSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCsv && textViewTab === 'table') setCsvFilter('');
                        else setTextSearch('');
                      }}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right sub-toolbar statistics & pills */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
            {isImage && imageDimensions && (
              <span className="font-mono bg-black/20 px-2 py-0.5 rounded border border-white/5">
                {imageDimensions.width} × {imageDimensions.height} px
              </span>
            )}
            {isTextLike && !isEditing && (
              <div className="hidden sm:flex items-center gap-2">
                <span>{textStats.lines} lines</span>
                <span>•</span>
                <span>{textStats.words} words</span>
                <span>•</span>
                <span>{textStats.chars} chars</span>
              </div>
            )}
            {isCsv && textViewTab === 'table' && parsedCsv.rows && (
              <span className="font-medium text-slate-300">
                Showing {parsedCsv.rows.length} of {parsedCsv.totalLines} row(s)
              </span>
            )}
          </div>
        </div>

        {/* Main Content Stage */}
        <div className="flex-1 bg-slate-900/95 overflow-hidden flex flex-col relative select-text">
          {/* Previous / Next floating arrows on large screen */}
          {files.length > 1 && (
            <>
              {hasPrev && (
                <button
                  type="button"
                  onClick={handlePrevFile}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white shadow-xl backdrop-blur border border-white/10 transition-all cursor-pointer group"
                  title="Previous File (Left Arrow)"
                >
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
              {hasNext && (
                <button
                  type="button"
                  onClick={handleNextFile}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white shadow-xl backdrop-blur border border-white/10 transition-all cursor-pointer group"
                  title="Next File (Right Arrow)"
                >
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </>
          )}

          {/* 1. IMAGE PREVIEW */}
          {isImage && (
            <div 
              className={`w-full h-full overflow-hidden flex items-center justify-center p-4 relative ${
                imageBgMode === 'dark' 
                  ? 'bg-slate-950' 
                  : imageBgMode === 'light' 
                  ? 'bg-slate-100' 
                  : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-200'
              }`}
              onMouseDown={handleImageMouseDown}
              onMouseMove={handleImageMouseMove}
              onMouseUp={handleImageMouseUp}
              onMouseLeave={handleImageMouseUp}
              style={{ cursor: imageZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
            >
              {blobUrl ? (
                <div 
                  className="transition-transform duration-100 ease-out flex items-center justify-center select-none"
                  style={{
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${imageZoom}) rotate(${imageRotation}deg) scaleX(${imageFlipH ? -1 : 1})`,
                  }}
                  onDoubleClick={() => {
                    if (imageZoom > 1) {
                      setImageZoom(1);
                      setPanPosition({ x: 0, y: 0 });
                    } else {
                      setImageZoom(1.75);
                    }
                  }}
                >
                  <img
                    src={blobUrl}
                    alt={file.name}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl pointer-events-none"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Loading image asset...</p>
                </div>
              )}

              {/* Floating overlay hint on bottom of image stage */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 text-[11px] text-slate-300 flex items-center gap-3 shadow-lg pointer-events-none">
                <span>Double-click to toggle zoom</span>
                <span>•</span>
                <span>Scroll or +/- to scale</span>
                {imageZoom > 1 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-400 font-medium">Click & drag to pan</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 2. PDF PREVIEW */}
          {isPdf && (
            <div className="w-full h-full bg-slate-900 flex flex-col overflow-hidden">
              {pdfMode === 'embed' && blobUrl ? (
                <div className="w-full h-full flex flex-col bg-slate-800">
                  <iframe
                    src={`${blobUrl}#toolbar=1&navpanes=0`}
                    title={file.name}
                    className="w-full h-full border-0 bg-slate-800"
                  />
                </div>
              ) : (
                /* Document Reader Mode */
                <div className="w-full h-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center bg-slate-950/90">
                  <div 
                    className="bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-3xl transition-transform duration-150 origin-top min-h-[700px] border border-slate-200"
                    style={{ transform: `scale(${pdfZoom})` }}
                  >
                    {/* Simulated PDF Header */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Enterprise Document
                        </span>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                          {file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                          Generated and encrypted on Storage Drive • SHA-256 Verified
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                        <FileText className="w-6 h-6" />
                      </div>
                    </div>

                    {/* PDF Document Body / Extracted Content */}
                    <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed space-y-4">
                      {textContent ? (
                        <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                          {textContent}
                        </div>
                      ) : (
                        <div className="space-y-4 py-6">
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <h4 className="font-semibold text-slate-800 text-sm">Document Overview</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              This PDF file contains structured binary formatting and vectorized layout. Use the <strong>Native PDF</strong> view toggle above to interact with browser native zooming, outlines, and pagination.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block text-[10px] uppercase">File Format</span>
                              <span className="font-semibold text-slate-700">Adobe Portable Document Format (PDF)</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block text-[10px] uppercase">Integrity Check</span>
                              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> SHA-256 Validated
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Document Footer */}
                    <div className="mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Confidential & Proprietary • Storage Drive Enterprise</span>
                      <span>Page 1 of 1</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. TEXT & DOCUMENT PREVIEW (Markdown, CSV, Code, Text) */}
          {isTextLike && (
            <div className="w-full h-full bg-white flex flex-col overflow-hidden">
              {/* Revision Saved Success Alert */}
              {saveSuccess && (
                <div className="p-3 bg-emerald-500 text-white text-xs font-semibold flex items-center justify-between shrink-0 shadow-sm animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Revision saved successfully! New file version created in history.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSaveSuccess(false)}
                    className="p-1 hover:bg-emerald-600 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Editing Mode */}
              {isEditing ? (
                <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
                  <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Editing: {file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditedText(textContent);
                          setIsEditing(false);
                        }}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveText}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving Revision...' : 'Save New Revision'}</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="flex-1 w-full p-5 bg-transparent text-xs font-mono resize-none outline-none leading-relaxed text-slate-200 selection:bg-blue-600"
                    placeholder="Enter document text content here..."
                    spellCheck={false}
                  />
                </div>
              ) : (
                /* Viewing Mode */
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                  {/* Mode: Formatted Markdown */}
                  {isMarkdown && textViewTab === 'formatted' && (
                    <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white">
                      <div className="max-w-4xl mx-auto">
                        {renderMarkdown(textContent || 'No content found in this document.')}
                      </div>
                    </div>
                  )}

                  {/* Mode: CSV Table Grid */}
                  {isCsv && textViewTab === 'table' && (
                    <div className="flex-1 overflow-auto bg-white p-4">
                      {parsedCsv.headers.length > 0 ? (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold select-none sticky top-0 z-10 shadow-2xs">
                                <th className="p-3 w-12 text-center text-slate-400 font-mono text-[10px]">#</th>
                                {parsedCsv.headers.map((h, i) => (
                                  <th
                                    key={i}
                                    onClick={() => {
                                      if (csvSortCol === i) {
                                        setCsvSortAsc(!csvSortAsc);
                                      } else {
                                        setCsvSortCol(i);
                                        setCsvSortAsc(true);
                                      }
                                    }}
                                    className="p-3 hover:bg-slate-200/70 transition-colors cursor-pointer border-l border-slate-200"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate">{h}</span>
                                      {csvSortCol === i && (
                                        <span className="text-blue-600 font-bold">
                                          {csvSortAsc ? '↑' : '↓'}
                                        </span>
                                      )}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-sans">
                              {parsedCsv.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-blue-50/40 transition-colors">
                                  <td className="p-2.5 text-center text-slate-400 font-mono text-[10px] bg-slate-50/50">
                                    {rIdx + 1}
                                  </td>
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-2.5 text-slate-700 border-l border-slate-100">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400">
                          <Table className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Empty CSV document or no rows available.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode: Raw Code / Text View with Line Numbers */}
                  {((!isMarkdown && !isCsv) || textViewTab === 'raw') && (
                    <div className="flex-1 overflow-auto bg-slate-900 text-slate-200 flex font-mono text-xs">
                      {/* Gutter */}
                      {showLineNumbers && (
                        <div className="py-4 px-3 bg-slate-950 text-slate-600 select-none text-right border-r border-slate-800 shrink-0 font-mono text-[11px] leading-relaxed">
                          {highlightedTextLines.map((_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                      )}
                      {/* Code Content */}
                      <div className="p-4 flex-1 overflow-auto">
                        <pre className={`font-mono text-slate-200 leading-relaxed select-text ${wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
                          {textContent || 'No preview available for this document.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. AUDIO PREVIEW */}
          {isAudio && (
            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
              <div className="bg-slate-900/90 border border-white/10 p-8 sm:p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-md w-full text-center">
                <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                  <Music className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white truncate max-w-xs">{file.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{formatBytes(file.sizeBytes)} • {file.mimeType}</p>
                </div>

                {blobUrl && (
                  <audio controls className="w-full mt-2" src={blobUrl}>
                    Your browser does not support audio playback.
                  </audio>
                )}
              </div>
            </div>
          )}

          {/* 5. VIDEO PREVIEW */}
          {isVideo && (
            <div className="w-full h-full bg-black flex items-center justify-center p-4">
              {blobUrl ? (
                <video 
                  controls 
                  autoPlay={false}
                  className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl bg-black" 
                  src={blobUrl}
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                <div className="text-center text-slate-500">
                  <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Loading video player...</p>
                </div>
              )}
            </div>
          )}

          {/* 6. ARCHIVE / OTHER UNRECOGNIZED FORMATS */}
          {!isImage && !isPdf && !isTextLike && !isAudio && !isVideo && (
            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
              <div className="bg-slate-900/90 border border-white/10 p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md w-full">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5">
                  {isArchive ? <Archive className="w-10 h-10 text-orange-400" /> : <FileText className="w-10 h-10 text-blue-400" />}
                </div>

                <h3 className="font-semibold text-white text-base mb-1 truncate max-w-xs">{file.name}</h3>
                <p className="text-xs text-slate-400 mb-6 font-mono">
                  {file.mimeType} • {formatBytes(file.sizeBytes)}
                </p>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-300 text-left w-full space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Extension:</span>
                    <span className="font-mono uppercase font-semibold text-slate-200">.{file.extension}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Security Check:</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Clean (SHA-256 Verified)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadFile(file.id)}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/25"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File to View</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Meta Bar */}
        <footer className="h-10 px-4 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium text-slate-500 hidden sm:inline">SHA-256:</span>
            <code className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10 truncate max-w-[140px] sm:max-w-xs">
              {file.checksum}
            </code>
            <button
              type="button"
              onClick={handleCopyChecksum}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy Checksum"
            >
              {copiedChecksum ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[10px] sm:text-[11px]">
            <span className="hidden md:inline text-slate-500">
              Shortcuts: <kbd className="px-1 py-0.5 bg-white/10 rounded">Esc</kbd> Close • <kbd className="px-1 py-0.5 bg-white/10 rounded">←</kbd> <kbd className="px-1 py-0.5 bg-white/10 rounded">→</kbd> Navigate • <kbd className="px-1 py-0.5 bg-white/10 rounded">F</kbd> Fullscreen
            </span>
            <span className="uppercase font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded">
              {file.extension}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
