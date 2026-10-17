import React, { useState, useEffect } from 'react';
import { Folder, X } from 'lucide-react';
import { useDrive } from '../../context/DriveContext';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderIdToRename?: string | null;
  initialName?: string;
}

const FOLDER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  folderIdToRename,
  initialName = '',
}) => {
  const { createFolder, renameFolder } = useDrive();
  const [folderName, setFolderName] = useState(initialName);
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFolderName(initialName);
    setError(null);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (folderIdToRename) {
      const res = renameFolder(folderIdToRename, folderName);
      if (!res.success) {
        setError(res.error || 'Failed to rename folder');
        return;
      }
    } else {
      const res = createFolder(folderName, undefined, selectedColor);
      if (!res.success) {
        setError(res.error || 'Failed to create folder');
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Folder className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">
              {folderIdToRename ? 'Rename Folder' : 'Create New Folder'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Folder Name
          </label>
          <input
            type="text"
            autoFocus
            placeholder="e.g. Q4 Strategy, Design Systems"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              if (error) setError(null);
            }}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 text-slate-800 transition-all mb-4"
          />

          {!folderIdToRename && (
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Color Tag
              </label>
              <div className="flex items-center gap-2.5">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                      selectedColor === c ? 'ring-3 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105 opacity-80'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mb-4">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              {folderIdToRename ? 'Save Changes' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
