import React from 'react';
import { Keyboard, X, CornerDownLeft, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, Edit2, CheckSquare, Folder } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: 'Navigation',
      items: [
        {
          keys: ['Enter'],
          description: 'Open selected folder or preview selected file',
          icon: <CornerDownLeft className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['↑', '↓', '←', '→'],
          description: 'Navigate selection between files and folders',
          icon: <ArrowUp className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Shift', '+', 'Arrows'],
          description: 'Multi-select adjacent items',
          icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Alt', '+', '↑'],
          description: 'Navigate up to parent folder (or Backspace when empty)',
          icon: <ArrowUp className="w-3.5 h-3.5 text-blue-500" />,
        },
      ],
    },
    {
      category: 'Selection & Multi-Item',
      items: [
        {
          keys: ['Shift', '+', 'Click'],
          description: 'Select a contiguous range of files and folders',
          icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Ctrl / ⌘', '+', 'Click'],
          description: 'Toggle individual item into/out of selection',
          icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Ctrl / ⌘', '+', 'A'],
          description: 'Select all files and folders in current directory',
          icon: <CheckSquare className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Shift', '+', 'Arrows'],
          description: 'Multi-select adjacent items using arrow keys',
          icon: <ArrowUp className="w-3.5 h-3.5 text-blue-500" />,
        },
      ],
    },
    {
      category: 'File & Folder Actions',
      items: [
        {
          keys: ['Delete', 'or', 'Backspace'],
          description: 'Bulk delete / Move selected items to Recycle Bin',
          icon: <Trash2 className="w-3.5 h-3.5 text-red-500" />,
        },
        {
          keys: ['M'],
          description: 'Bulk move selected items to another folder',
          icon: <Folder className="w-3.5 h-3.5 text-blue-500" />,
        },
        {
          keys: ['Space'],
          description: 'Quick Look / Toggle preview for selected file',
          icon: <Eye className="w-3.5 h-3.5 text-emerald-500" />,
        },
        {
          keys: ['F2'],
          description: 'Rename selected file or folder',
          icon: <Edit2 className="w-3.5 h-3.5 text-indigo-500" />,
        },
      ],
    },
    {
      category: 'General & Windows',
      items: [
        {
          keys: ['Esc'],
          description: 'Clear current item selection or close active modal',
          icon: null,
        },
        {
          keys: ['?'],
          description: 'Show or hide this keyboard shortcuts guide',
          icon: <Keyboard className="w-3.5 h-3.5 text-blue-500" />,
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />

      <div 
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-500">Speed up your workflow in Storage Drive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                {group.items.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-slate-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-4">
                      {item.icon && <span className="shrink-0">{item.icon}</span>}
                      <span className="text-slate-700 font-medium truncate">
                        {item.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => {
                        const isSeparator = k === '+' || k === 'or';
                        if (isSeparator) {
                          return (
                            <span key={kIdx} className="text-[11px] text-slate-400 font-medium px-0.5">
                              {k}
                            </span>
                          );
                        }
                        return (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-mono font-semibold text-slate-800 shadow-2xs"
                          >
                            {k}
                          </kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-600">?</kbd> anywhere to open this dialog.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
