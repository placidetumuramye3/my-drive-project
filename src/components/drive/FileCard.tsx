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

interface FileCardProps {
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

export const FileCard: React.FC<FileCardProps> = ({
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
        return <ImageIcon className="w-8 h-8 text-pink-500" />;
      case 'document':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-500" />;
      case 'audio':
        return <Music className="w-8 h-8 text-amber-500" />;
      case 'archive':
        return <Archive className="w-8 h-8 text-orange-500" />;
      case 'code':
        return <Code className="w-8 h-8 text-emerald-500" />;
      default:
        return <FileText className="w-8 h-8 text-slate-400" />;
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
      className={`group relative bg-white rounded-2xl border transition-all duration-150 select-none p-3.5 flex flex-col justify-between hover:shadow-md cursor-pointer ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top row: Checkbox, Star, Menu */}
      <div className="flex items-center justify-between mb-2">
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
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 hover:border-slate-400 opacity-0 group-hover:opacity-100'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              file.isStarred
                ? 'text-amber-500'
                : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
            }`}
            title={file.isStarred ? 'Unstar' : 'Star file'}
          >
            <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'fill-amber-500' : ''}`} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
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
                      onPreview();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview & Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDownload();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
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
                    <span>Version History ({file.versions?.length || 1})</span>
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

      {/* Center preview/icon area */}
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
          onPreview();
        }}
        onDoubleClick={onPreview}
        className="h-28 rounded-xl bg-slate-50 relative flex items-center justify-center p-3 mb-3 group-hover:bg-slate-100/70 transition-colors cursor-pointer overflow-hidden"
      >
        {getCategoryIcon()}
        
        {/* Quick Preview Hover Indicator */}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-800 rounded-lg text-xs font-semibold shadow-md transform translate-y-1 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>Preview</span>
          </span>
        </div>
      </div>

      {/* Bottom details */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e);
          onPreview();
        }}
        className="cursor-pointer"
      >
        <h4 
          title={file.name}
          className="text-xs font-semibold text-slate-800 truncate mb-1 hover:text-blue-600 transition-colors"
        >
          {file.name}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{formatBytes(file.sizeBytes)}</span>
          <span className="uppercase font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
            {file.extension}
          </span>
        </div>
      </div>
    </div>
  );
};
