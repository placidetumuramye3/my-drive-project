import React, { useState } from 'react';
import { Folder, X, ArrowRight, HardDrive, Check, AlertCircle, Files } from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { useToast } from '../../context/ToastContext';

export interface MoveItemTarget {
  id: string;
  type: 'file' | 'folder';
  name: string;
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId?: string | null;
  itemType?: 'file' | 'folder';
  itemName?: string;
  items?: MoveItemTarget[];
  onSuccess?: (movedCount: number, destinationName: string) => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemType = 'file',
  itemName = '',
  items,
  onSuccess,
}) => {
  const { folders, moveItem, clearSelection } = useDrive();
  const { showToast } = useToast();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize items to move
  const itemsToMove: MoveItemTarget[] = React.useMemo(() => {
    if (items && items.length > 0) {
      return items;
    }
    if (itemId) {
      return [{ id: itemId, type: itemType, name: itemName }];
    }
    return [];
  }, [items, itemId, itemType, itemName]);

  if (!isOpen || itemsToMove.length === 0) return null;

  const isBulk = itemsToMove.length > 1;
  const activeFolders = folders.filter(f => !f.isDeleted);

  // Helper to determine if a destination folder is invalid for ANY of the items being moved
  const isInvalidDestination = (destId: string | null): boolean => {
    for (const item of itemsToMove) {
      if (item.type === 'folder') {
        // Cannot move a folder into itself
        if (destId === item.id) return true;

        // Cannot move a folder into any descendant of itself
        let curr = destId;
        while (curr) {
          if (curr === item.id) return true;
          const parent = folders.find(f => f.id === curr);
          curr = parent ? parent.parentId : null;
        }
      }
    }
    return false;
  };

  const handleMove = async () => {
    if (isInvalidDestination(selectedFolderId)) {
      setError('Cannot move a folder into itself or its own subfolder.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let movedCount = 0;
    const errors: string[] = [];

    for (const item of itemsToMove) {
      const res = await moveItem(item.id, item.type, selectedFolderId);
      if (res.success) {
        movedCount++;
      } else {
        errors.push(`${item.name}: ${res.error || 'Failed'}`);
      }
    }

    setIsSubmitting(false);

    const destFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;
    const destinationName = destFolder ? destFolder.name : 'My Drive (Root)';

    if (errors.length > 0 && movedCount === 0) {
      setError(errors.join('; '));
      return;
    }

    if (movedCount > 0) {
      showToast({
        id: 'move_' + Date.now(),
        type: 'success',
        title: isBulk ? 'Items moved successfully' : 'Item moved',
        message: `Moved ${movedCount} item${movedCount === 1 ? '' : 's'} to "${destinationName}".`,
        duration: 4000,
      });

      if (isBulk) {
        clearSelection();
      }

      if (onSuccess) {
        onSuccess(movedCount, destinationName);
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              {isBulk ? <Files className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">
                {isBulk ? `Move ${itemsToMove.length} Items` : `Move ${itemType === 'folder' ? 'Folder' : 'File'}`}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {isBulk
                  ? `${itemsToMove.map(i => i.name).slice(0, 3).join(', ')}${itemsToMove.length > 3 ? ` +${itemsToMove.length - 3} more` : ''}`
                  : itemName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Items summary in bulk mode */}
        {isBulk && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700 shrink-0">Selected:</span>
            <div className="flex items-center gap-1.5 truncate">
              {itemsToMove.map(item => (
                <span
                  key={item.id}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 truncate max-w-28 shrink-0 flex items-center gap-1"
                >
                  {item.type === 'folder' ? (
                    <Folder className="w-3 h-3 text-blue-500 shrink-0" />
                  ) : (
                    <Files className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Folder Picker List */}
        <div className="p-4 overflow-y-auto space-y-1 flex-1">
          <p className="text-xs font-semibold text-slate-500 mb-2 px-2">Select Destination:</p>

          {/* Root Option */}
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId(null);
              setError(null);
            }}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              selectedFolderId === null
                ? 'bg-blue-50 text-blue-800 border border-blue-200 font-semibold'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-slate-500" />
              <span>My Drive (Root)</span>
            </div>
            {selectedFolderId === null && <Check className="w-4 h-4 text-blue-600" />}
          </button>

          {/* Folders List */}
          {activeFolders.map((f) => {
            const disabled = isInvalidDestination(f.id);
            const isSelected = selectedFolderId === f.id;

            return (
              <button
                key={f.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSelectedFolderId(f.id);
                  setError(null);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                    : isSelected
                    ? 'bg-blue-50 text-blue-800 border border-blue-200 font-semibold'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-4 h-4 shrink-0" style={{ color: f.color || '#3b82f6' }} />
                  <span className="truncate">{f.name}</span>
                </div>
                {disabled && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Invalid</span>}
                {isSelected && !disabled && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Moving...</span>
            ) : (
              <span>Move {isBulk ? `${itemsToMove.length} Items Here` : 'Here'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
