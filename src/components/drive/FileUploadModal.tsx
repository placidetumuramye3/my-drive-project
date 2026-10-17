import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  X, 
  File as FileIcon, 
  CheckCircle2, 
  AlertCircle, 
  Folder, 
  HardDrive
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { formatBytes } from '../../services/db';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { 
    uploadFiles, 
    uploadQueue, 
    clearCompletedUploads, 
    currentFolderId, 
    folders,
    storageUsedBytes,
    storageQuotaBytes,
    storagePercentage,
    isStorageFull
  } = useDrive();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const remainingBytes = Math.max(0, storageQuotaBytes - storageUsedBytes);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      await uploadFiles(filesArray, selectedFolderId);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      await uploadFiles(filesArray, selectedFolderId);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeFolders = folders.filter(f => !f.isDeleted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Upload Files</h3>
              <p className="text-xs text-slate-400">Add documents, media, or archives to your cloud drive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Folder Selector (US-10) */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Folder className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-slate-600 block">
                Destination Folder:
              </label>
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
                className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none cursor-pointer mt-0.5"
              >
                <option value="">My Drive (Root)</option>
                {activeFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quota indicator bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                Remaining Space: {formatBytes(remainingBytes)}
              </span>
              <span className="font-semibold text-slate-700">{storagePercentage.toFixed(0)}% used</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${isStorageFull ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.min(100, storagePercentage)}%` }}
              />
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Click to browse or drag and drop files here
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Supports documents (PDF, DOCX, TXT), images (PNG, JPG, SVG), audio, video, code, and archives.
            </p>
          </div>

          {/* Upload Queue Progress List */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Upload Activity ({uploadQueue.length})</span>
                <button
                  type="button"
                  onClick={clearCompletedUploads}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Clear Finished
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 text-xs"
                  >
                    <FileIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-800 truncate pr-2">
                          {item.file.name}
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {formatBytes(item.file.size)}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            item.status === 'completed'
                              ? 'bg-emerald-500'
                              : item.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>

                      {item.errorMessage && (
                        <p className="text-[11px] text-red-600 mt-1">{item.errorMessage}</p>
                      )}
                    </div>

                    {item.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
