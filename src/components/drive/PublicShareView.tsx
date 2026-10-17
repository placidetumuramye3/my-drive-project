import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Archive,
  Code,
  ArrowLeft,
  Clock,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Edit3,
  Save,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { FileItem, FolderItem } from '../../types/drive';
import { getFiles, getFolders, getBlob, formatBytes, computeSHA256, incrementShareDownload, saveFiles, addAuditLog } from '../../services/db';

interface PublicShareViewProps {
  token: string;
  onClose?: () => void;
}

export const PublicShareView: React.FC<PublicShareViewProps> = ({ token, onClose }) => {
  const [file, setFile] = useState<FileItem | null>(null);
  const [folder, setFolder] = useState<FolderItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Interaction state
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [previewTab, setPreviewTab] = useState<'preview' | 'source'>('preview');

  // Load item by token
  useEffect(() => {
    setIsLoading(true);
    try {
      const files = getFiles();
      const matchedFile = files.find(f => f.publicLink?.token === token && !f.isDeleted);
      if (matchedFile) {
        setFile(matchedFile);
        setTextContent(matchedFile.textContent || '');
        setEditedText(matchedFile.textContent || '');

        // Check session unlock
        const sessionKey = `share_unlocked_${token}`;
        if (!matchedFile.publicLink?.passwordProtected || sessionStorage.getItem(sessionKey) === 'true') {
          setIsUnlocked(true);
        }
      } else {
        const folders = getFolders();
        const matchedFolder = folders.find(f => f.publicLink?.token === token && !f.isDeleted);
        if (matchedFolder) {
          setFolder(matchedFolder);
          const sessionKey = `share_unlocked_${token}`;
          if (!matchedFolder.publicLink?.passwordProtected || sessionStorage.getItem(sessionKey) === 'true') {
            setIsUnlocked(true);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching shared item:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Load blob when file and unlocked
  useEffect(() => {
    if (!file || !isUnlocked) return;

    let active = true;
    let createdUrl: string | null = null;

    const fetchBlob = async () => {
      try {
        const blob = await getBlob(file.blobId);
        if (blob && active) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);

          if (!file.textContent && (file.category === 'code' || file.category === 'document' || file.mimeType.startsWith('text/'))) {
            try {
              const text = await blob.text();
              if (active) {
                setTextContent(text);
                setEditedText(text);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error('Failed to load blob', err);
      }
    };

    fetchBlob();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file, isUnlocked]);

  const publicLink = file?.publicLink || folder?.publicLink;

  // Expiration check
  const isExpired = useMemo(() => {
    if (!publicLink?.expiresAt) return false;
    return new Date(publicLink.expiresAt).getTime() < Date.now();
  }, [publicLink?.expiresAt]);

  // Max downloads check
  const isMaxDownloadsReached = useMemo(() => {
    if (!publicLink?.maxDownloads) return false;
    return (publicLink.downloadCount || 0) >= publicLink.maxDownloads;
  }, [publicLink?.maxDownloads, publicLink?.downloadCount]);

  // Expiration time remaining text
  const expirationText = useMemo(() => {
    if (!publicLink?.expiresAt) return null;
    const diff = new Date(publicLink.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return `Expires in ${days} days`;
    if (days === 1) return 'Expires tomorrow';
    if (hours > 0) return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
    const minutes = Math.floor(diff / (1000 * 60));
    return `Expires in ${Math.max(1, minutes)} minutes`;
  }, [publicLink?.expiresAt]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!publicLink?.password) {
      setIsUnlocked(true);
      return;
    }

    if (passwordInput === publicLink.password) {
      sessionStorage.setItem(`share_unlocked_${token}`, 'true');
      setIsUnlocked(true);
    } else {
      setPasswordError('Incorrect password. Please verify and try again.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownload = async () => {
    if (!file || isDownloading) return;
    setIsDownloading(true);

    try {
      let downloadBlob: Blob | null = null;
      if (blobUrl) {
        const res = await fetch(blobUrl);
        downloadBlob = await res.blob();
      } else {
        downloadBlob = await getBlob(file.blobId);
      }

      if (!downloadBlob) {
        // Fallback using text content if available
        if (file.textContent) {
          downloadBlob = new Blob([file.textContent], { type: file.mimeType || 'text/plain' });
        } else {
          throw new Error('File content could not be located.');
        }
      }

      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Increment download counter
      incrementShareDownload(token);
      if (file.publicLink) {
        setFile(prev => prev ? {
          ...prev,
          publicLink: {
            ...prev.publicLink!,
            downloadCount: (prev.publicLink!.downloadCount || 0) + 1
          }
        } : null);
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveEditedDocument = async () => {
    if (!file || !publicLink || publicLink.role !== 'editor') return;
    setIsSaving(true);
    try {
      const files = getFiles();
      const idx = files.findIndex(f => f.id === file.id);
      if (idx !== -1) {
        const updatedFile = {
          ...files[idx],
          textContent: editedText,
          sizeBytes: new Blob([editedText]).size,
          updatedAt: new Date().toISOString(),
        };
        files[idx] = updatedFile;
        saveFiles(files);
        setFile(updatedFile);
        setTextContent(editedText);

        addAuditLog({
          userId: 'public_collaborator',
          userEmail: 'public_editor@storagedrive.com',
          eventType: 'FILE_UPLOAD',
          description: `Updated document "${file.name}" via public editor link (${token})`,
          ipAddress: '127.0.0.1',
          severity: 'info'
        });

        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Render Category Icon
  const renderCategoryIcon = (category: string, className = "w-6 h-6") => {
    switch (category) {
      case 'image':
        return <ImageIcon className={`${className} text-indigo-500`} />;
      case 'document':
        return <FileText className={`${className} text-blue-500`} />;
      case 'video':
        return <Video className={`${className} text-amber-500`} />;
      case 'audio':
        return <Music className={`${className} text-rose-500`} />;
      case 'code':
        return <Code className={`${className} text-emerald-500`} />;
      case 'archive':
        return <Archive className={`${className} text-purple-500`} />;
      default:
        return <FileText className={`${className} text-slate-500`} />;
    }
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500 text-xs">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="font-medium text-slate-700">Verifying secure share link...</p>
        <p className="text-slate-400 text-[11px] mt-1">Checking link authorization & security status</p>
      </div>
    );
  }

  // Not Found / Revoked
  if (!file && !folder) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Share Link Unavailable</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This link is invalid, has been revoked by the owner, or the item has been permanently removed.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                if (onClose) onClose();
                else window.location.href = window.location.origin;
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go to Storage Drive</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expired Screen
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-amber-200/80 p-8 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 uppercase tracking-wider mb-2">
              Link Expired
            </span>
            <h2 className="text-lg font-bold text-slate-800">This Share Link Has Expired</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              The owner configured this secure link with an expiration deadline which passed on{' '}
              <strong className="text-slate-700">
                {publicLink?.expiresAt ? new Date(publicLink.expiresAt).toLocaleString() : 'recently'}
              </strong>.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left text-xs text-slate-600 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Please contact the file owner to request an extended or renewed share link.</span>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                if (onClose) onClose();
                else window.location.href = window.location.origin;
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go to Storage Drive</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Max Downloads Reached
  if (isMaxDownloadsReached) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Archive className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 uppercase tracking-wider mb-2">
              Download Quota Reached
            </span>
            <h2 className="text-lg font-bold text-slate-800">Download Limit Exceeded</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This secure link was configured for a maximum of {publicLink?.maxDownloads} download(s) and has now been exhausted.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                if (onClose) onClose();
                else window.location.href = window.location.origin;
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go to Storage Drive</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Password Lock Screen
  if (!isUnlocked && publicLink?.passwordProtected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6 text-white">
        <div className={`max-w-md w-full bg-slate-800/90 backdrop-blur-md rounded-3xl border border-slate-700/80 p-8 shadow-2xl space-y-6 ${isShaking ? 'animate-bounce' : ''}`}>
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
              Password Protected Link
            </span>
            <h2 className="text-lg font-bold text-white">Enter Password to Access</h2>
            <p className="text-xs text-slate-400">
              The owner protected this file with a security password.
            </p>
          </div>

          {/* File Teaser */}
          {file && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/60 text-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                {renderCategoryIcon(file.category, "w-5 h-5")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-200 truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span>•</span>
                  <span className="uppercase">{file.extension}</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">File Access Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter link password"
                  autoFocus
                  className="w-full px-4 py-2.5 text-xs bg-slate-900/80 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock & View File</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                if (onClose) onClose();
                else window.location.href = window.location.origin;
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Return to Storage Drive</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main File View (Unlocked & Valid)
  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans text-slate-800 antialiased">
      {/* Top Public Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-sm tracking-tight">Storage Drive</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Link</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Secure File Sharing Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
          </button>

          <button
            onClick={() => {
              if (onClose) onClose();
              else {
                window.history.replaceState({}, '', window.location.pathname);
                window.location.reload();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Drive</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 space-y-4">
        {/* Security & File Overview Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-inner">
              {file ? renderCategoryIcon(file.category, "w-7 h-7") : <HardDrive className="w-7 h-7 text-blue-500" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {file?.name || folder?.name}
                </h2>
                {file && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] uppercase font-semibold">
                    .{file.extension}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                {file && <span>{formatBytes(file.sizeBytes)}</span>}
                {publicLink?.passwordProtected && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Lock className="w-3 h-3" />
                    <span>Password protected</span>
                  </span>
                )}
                {expirationText && (
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>{expirationText}</span>
                  </span>
                )}
                <span className="text-slate-400">
                  {publicLink?.downloadCount || 0} download{(publicLink?.downloadCount || 0) === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {publicLink?.role === 'editor' && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  isEditing
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Exit Editor' : 'Edit Document'}</span>
              </button>
            )}

            {publicLink?.allowDownload !== false && file && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                    <span>{isDownloading ? 'Downloading...' : 'Download File'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* In-Browser Preview Container */}
        {file && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
            {/* Viewer Header / Toolbar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Preview & Content</span>
                {file.category === 'code' || file.category === 'document' ? (
                  <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[11px]">
                    <button
                      onClick={() => setPreviewTab('preview')}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                        previewTab === 'preview' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Formatted View
                    </button>
                    <button
                      onClick={() => setPreviewTab('source')}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                        previewTab === 'source' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Raw Code
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Image Controls */}
              {file.category === 'image' && (
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(0.25, prev - 0.25))}
                    title="Zoom Out"
                    className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono px-1 font-semibold text-slate-700">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                    title="Zoom In"
                    className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3.5 bg-slate-300 mx-1" />
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    title="Rotate 90deg"
                    className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Editing Controls */}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEditedDocument}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Viewer Body */}
            <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-50/20">
              {/* EDITING MODE */}
              {isEditing ? (
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-amber-700">
                      Collaborative Editing Mode Active
                    </span>
                    <span className="font-mono text-[11px]">
                      {editedText.length} characters
                    </span>
                  </div>
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    rows={18}
                    className="w-full flex-1 p-4 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-800 leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-inner"
                    placeholder="Enter document text content here..."
                  />
                  {saveSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Document updated successfully and saved to drive storage!</span>
                    </div>
                  )}
                </div>
              ) : (
                /* PREVIEW DISPLAY ACCORDING TO CATEGORY */
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                  {/* IMAGES */}
                  {file.category === 'image' && (
                    <div className="w-full h-full min-h-[420px] flex items-center justify-center overflow-auto p-4 bg-slate-900/5 rounded-xl border border-slate-100">
                      {blobUrl ? (
                        <img
                          src={blobUrl}
                          alt={file.name}
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: 'transform 0.15s ease-out',
                            maxWidth: zoomLevel === 1 ? '100%' : 'none',
                            maxHeight: zoomLevel === 1 ? '480px' : 'none'
                          }}
                          className="object-contain rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <ImageIcon className="w-12 h-12 stroke-1" />
                          <p className="text-xs">Loading image display...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDFS */}
                  {file.mimeType.includes('pdf') || file.extension === 'pdf' ? (
                    <div className="w-full flex-1 flex flex-col min-h-[460px]">
                      {blobUrl ? (
                        <iframe
                          src={blobUrl}
                          title={file.name}
                          className="w-full flex-1 min-h-[500px] rounded-xl border border-slate-200 bg-white shadow-inner"
                        />
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                          <FileText className="w-12 h-12 text-blue-500" />
                          <p className="text-sm font-semibold text-slate-800">PDF Document Ready</p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Use the download button above or view inside your PDF-compatible reader.
                          </p>
                          <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Open / Download PDF
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* CSV / SPREADSHEET */}
                  {file.extension === 'csv' && previewTab === 'preview' && (
                    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <tbody>
                          {textContent.split('\n').filter(Boolean).map((row, rIdx) => {
                            const cells = row.split(',');
                            return (
                              <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 font-bold border-b border-slate-200' : 'border-b border-slate-100 hover:bg-slate-50/50'}>
                                {cells.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-3.5 py-2 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                                    {cell.trim().replace(/^"|"$/g, '')}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* MARKDOWN / TEXT / CODE */}
                  {(file.category === 'code' || file.category === 'document' || file.category === 'other') && (file.extension !== 'pdf' && (file.extension !== 'csv' || previewTab === 'source')) && (
                    <div className="w-full flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                      <div className="p-4 overflow-x-auto font-mono text-xs text-slate-800 leading-relaxed max-h-[500px]">
                        {textContent ? (
                          <pre className="whitespace-pre-wrap">{textContent}</pre>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                            <FileText className="w-10 h-10 stroke-1" />
                            <p>Binary or non-text document.</p>
                            <button
                              onClick={handleDownload}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Download to inspect
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AUDIO & VIDEO */}
                  {file.category === 'audio' && (
                    <div className="w-full p-8 flex flex-col items-center justify-center bg-slate-100 rounded-2xl border border-slate-200 space-y-4">
                      <Music className="w-16 h-16 text-rose-500 animate-pulse" />
                      <audio controls src={blobUrl || undefined} className="w-full max-w-md" />
                    </div>
                  )}

                  {file.category === 'video' && (
                    <div className="w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden max-h-[480px]">
                      <video controls src={blobUrl || undefined} className="max-h-[480px] w-full" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Viewer Footer Status Bar */}
            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="font-mono">SHA-256: {file.checksum.substring(0, 16)}...</span>
                <span>•</span>
                <span>Type: {file.mimeType}</span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Protected by Storage Drive Access Control</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
