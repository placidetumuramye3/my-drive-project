import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  FileText, 
  Folder, 
  Info, 
  CheckCircle2 
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { formatBytes } from '../../services/db';

export const TrashView: React.FC = () => {
  const { 
    trashFiles, 
    trashFolders, 
    restoreFile, 
    restoreFolder, 
    permanentlyDeleteFile, 
    permanentlyDeleteFolder, 
    emptyTrash 
  } = useDrive();

  const [notification, setNotification] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const totalTrashItems = trashFiles.length + trashFolders.length;

  const handleRestoreFile = (fileId: string) => {
    const res = restoreFile(fileId);
    setNotification(res.message);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRestoreFolder = (folderId: string) => {
    const res = restoreFolder(folderId);
    setNotification(res.message);
    setTimeout(() => setNotification(null), 4000);
  };

  const handlePermanentDeleteFile = async (fileId: string) => {
    if (confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
      await permanentlyDeleteFile(fileId);
      setNotification('File permanently deleted from storage.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handlePermanentDeleteFolder = async (folderId: string) => {
    if (confirm('Permanently delete this folder and its historical contents? This cannot be undone.')) {
      await permanentlyDeleteFolder(folderId);
      setNotification('Folder permanently deleted.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    await emptyTrash();
    setShowEmptyConfirm(false);
    setNotification('Recycle Bin has been completely emptied.');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Retention Policy Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <p className="font-semibold text-amber-900">
            Recycle Bin Retention Policy (30 Days)
          </p>
          <p className="text-amber-700 mt-0.5 leading-relaxed">
            Items in the trash are retained for 30 days before being automatically purged. You can restore any item to its original location, or permanently erase it to instantly free up disk quota.
          </p>
        </div>
        {totalTrashItems > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
          >
            Empty Recycle Bin
          </button>
        )}
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Items Section */}
      {totalTrashItems === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Trash2 className="w-8 h-8" />
          </div>
          <h4 className="font-semibold text-slate-800 text-sm">Recycle Bin is empty</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            When you delete files or folders, they will be kept here safely for 30 days.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="flex-1">Item Name</div>
            <div className="w-32 hidden sm:block">Deleted On</div>
            <div className="w-24 hidden sm:block">Size</div>
            <div className="w-36 text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Trash Folders */}
            {trashFolders.map((folder) => (
              <div
                key={folder.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                  <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{folder.name}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                    Folder
                  </span>
                </div>

                <div className="w-32 text-slate-500 hidden sm:block">
                  {folder.deletedAt ? new Date(folder.deletedAt).toLocaleDateString() : 'Recently'}
                </div>

                <div className="w-24 text-slate-400 hidden sm:block">—</div>

                <div className="w-36 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleRestoreFolder(folder.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Restore Folder"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteFolder(folder.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Trash Files */}
            {trashFiles.map((file) => (
              <div
                key={file.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono uppercase">
                    {file.extension}
                  </span>
                </div>

                <div className="w-32 text-slate-500 hidden sm:block">
                  {file.deletedAt ? new Date(file.deletedAt).toLocaleDateString() : 'Recently'}
                </div>

                <div className="w-24 text-slate-600 font-medium hidden sm:block">
                  {formatBytes(file.sizeBytes)}
                </div>

                <div className="w-36 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleRestoreFile(file.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Restore to original location"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteFile(file.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="Delete Forever"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Dialog */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-900 text-sm mb-1">
              Empty Recycle Bin?
            </h4>
            <p className="text-xs text-slate-500 mb-6">
              All {totalTrashItems} items in the Recycle Bin will be permanently purged from disk. This cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEmptyTrash}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Yes, Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
