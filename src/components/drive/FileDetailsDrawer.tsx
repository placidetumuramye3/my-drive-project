import React from 'react';
import { 
  X, 
  FileText, 
  Folder, 
  HardDrive, 
  Calendar, 
  Users, 
  ShieldCheck, 
  Download, 
  Copy, 
  Check, 
  History 
} from 'lucide-react';
import { FileItem, FolderItem } from '../../types/drive';
import { formatBytes } from '../../services/db';

interface FileDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  file?: FileItem | null;
  folder?: FolderItem | null;
  onOpenVersions?: (fileId: string) => void;
  onDownload?: (fileId: string) => void;
}

export const FileDetailsDrawer: React.FC<FileDetailsDrawerProps> = ({
  isOpen,
  onClose,
  file,
  folder,
  onOpenVersions,
  onDownload,
}) => {
  const [copiedHash, setCopiedHash] = React.useState(false);

  if (!isOpen || (!file && !folder)) return null;

  const isFolder = !!folder;
  const item = file || folder;
  if (!item) return null;

  const handleCopyHash = () => {
    if (file?.checksum) {
      navigator.clipboard.writeText(file.checksum);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          {isFolder ? <Folder className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-indigo-600" />}
          <span>{isFolder ? 'Folder Details' : 'File Properties'}</span>
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs">
        {/* Thumbnail Preview Area */}
        <div className="w-full h-32 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center p-3 text-center">
          {isFolder ? (
            <Folder className="w-12 h-12" style={{ color: folder?.color || '#3b82f6' }} />
          ) : (
            <FileText className="w-12 h-12 text-slate-400" />
          )}
          <p className="font-semibold text-slate-800 text-xs mt-2 truncate max-w-[90%]">
            {item.name}
          </p>
          {!isFolder && file && (
            <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
              {file.extension} • {formatBytes(file.sizeBytes)}
            </span>
          )}
        </div>

        {/* Action Shortcuts */}
        {!isFolder && file && (
          <div className="grid grid-cols-2 gap-2">
            {onDownload && (
              <button
                onClick={() => onDownload(file.id)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
            {onOpenVersions && (
              <button
                onClick={() => onOpenVersions(file.id)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200/70 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Revisions ({file.versions?.length || 1})</span>
              </button>
            )}
          </div>
        )}

        {/* Metadata Grid */}
        <div className="space-y-3.5 pt-2 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            General Information
          </p>

          <div>
            <span className="text-slate-400 block mb-0.5">Name</span>
            <span className="font-semibold text-slate-800 break-words">{item.name}</span>
          </div>

          {!isFolder && file && (
            <>
              <div>
                <span className="text-slate-400 block mb-0.5">Type</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {file.category} ({file.mimeType})
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Size</span>
                <span className="font-semibold text-slate-800">
                  {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString()} bytes)
                </span>
              </div>
            </>
          )}

          <div>
            <span className="text-slate-400 block mb-0.5">Date Created</span>
            <span className="font-medium text-slate-700">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Last Modified</span>
            <span className="font-medium text-slate-700">
              {new Date(item.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Security & Access */}
        <div className="space-y-3.5 pt-4 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Security & Access
          </p>

          <div>
            <span className="text-slate-400 block mb-0.5">Sharing State</span>
            <span className="font-medium text-slate-700">
              {item.sharedWith?.length || 0} user(s) with direct access
              {item.publicLink ? ' • Public link active' : ' • Private link'}
            </span>
          </div>

          {!isFolder && file && (
            <div>
              <span className="text-slate-400 block mb-0.5">SHA-256 Integrity Hash</span>
              <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1">
                <code className="font-mono text-[10px] text-slate-700 truncate flex-1">
                  {file.checksum}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                  title="Copy Checksum"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
