import React, { useState, useRef } from 'react';
import { 
  History, 
  X, 
  RotateCcw, 
  UploadCloud, 
  FileCheck, 
  CheckCircle2, 
  Calendar, 
  User, 
  HardDrive 
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { formatBytes } from '../../services/db';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  fileId,
}) => {
  const { files, revertToVersion, saveFileNewVersion } = useDrive();
  const [commentInput, setCommentInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !fileId) return null;

  const file = files.find(f => f.id === fileId);
  if (!file) return null;

  const versions = file.versions || [];

  const handleRevert = async (versionId: string) => {
    const res = await revertToVersion(fileId, versionId);
    if (res.success) {
      setFeedback('Reverted successfully to selected version.');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback(res.error || 'Failed to revert version');
    }
  };

  const handleUploadNewVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFile = e.target.files[0];
      setIsUploading(true);
      const res = await saveFileNewVersion(fileId, newFile, commentInput.trim() || undefined);
      setIsUploading(false);
      setCommentInput('');
      if (res.success) {
        setFeedback('New revision uploaded successfully!');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(res.error || 'Failed to upload new revision');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Version History</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload New Version Section */}
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Revision comment (e.g. Added section 3 benchmarks)"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadNewVersion}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Upload Revision'}</span>
            </button>
          </div>
          {feedback && (
            <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {feedback}
            </p>
          )}
        </div>

        {/* Version Timeline */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {versions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No previous versions available.</p>
          ) : (
            [...versions].reverse().map((v, index) => {
              const isCurrent = v.blobId === file.blobId;
              return (
                <div
                  key={v.versionId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          v{v.versionNumber}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            Current
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          • {formatBytes(v.sizeBytes)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium italic">
                        "{v.comment || 'Revision update'}"
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(v.uploadedAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {v.uploadedBy}
                        </span>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleRevert(v.versionId)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        title="Restore this version as active"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
