import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Archive, 
  Code, 
  MoreVertical, 
  Download, 
  Share2, 
  Star, 
  Edit2, 
  FolderInput, 
  History, 
  Trash2, 
  Info, 
  Eye, 
  Check 
} from 'lucide-react';
import { FileItem } from '../../types/drive';
import { formatBytes } from '../../services/db';

interface FileListRowProps {
  file: FileItem;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleSelect?: (e: React.MouseEvent) => void;
  onPreview: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onVersions: () => void;
  onDetails: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
}

export const FileListRow: React.FC<FileListRowProps> = ({
  file,
  isSelected,
  onSelect,
  onToggleSelect,
  onPreview,
  onDownload,
  onShare,
  onRename,
  onMove,
  onVersions,
  onDetails,
  onDelete,
  onToggleStar,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getCategoryIcon = () => {
    switch (file.category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-pink-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-500" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-orange-500" />;
      case 'code':
        return <Code className="w-4 h-4 text-emerald-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          onSelect(e);
        } else {
          onSelect(e);
          onPreview();
        }
      }}
      onDoubleClick={onPreview}
      className={`group flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs transition-colors cursor-pointer select-none ${
        isSelected
          ? 'bg-blue-50/50 border-blue-300'
          : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50/70'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        {/* Selection checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSelect) {
              onToggleSelect(e);
            } else {
              onSelect(e);
            }
          }}
          className={`w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 hover:border-slate-400 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        {/* Star */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
          className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
            file.isStarred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'fill-amber-500' : ''}`} />
        </button>

        {/* Icon & Name */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
            onPreview();
          }}
          onDoubleClick={onPreview}
          className="flex items-center gap-2.5 truncate cursor-pointer flex-1 group/name"
        >
          {getCategoryIcon()}
          <span className="font-semibold text-slate-800 truncate group-hover/name:text-blue-600 transition-colors">{file.name}</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 shrink-0">
            {file.extension}
          </span>
        </div>
      </div>

      {/* Modified date */}
      <div className="w-32 text-slate-400 text-[11px] hidden md:block">
        {new Date(file.updatedAt).toLocaleDateString()}
      </div>

      {/* File Size */}
      <div className="w-24 text-slate-600 font-medium text-right pr-6 hidden sm:block">
        {formatBytes(file.sizeBytes)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Preview & Edit"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div
                className="absolute right-0 top-6 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onShare();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onVersions();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Version History</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onRename();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onMove();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  <span>Move</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDetails();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>File Details</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Move to Trash</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
