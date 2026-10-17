import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  Folder, 
  HardDrive, 
  Home, 
  Users, 
  Clock, 
  Star, 
  Trash2, 
  Shield, 
  CornerLeftUp, 
  Copy, 
  Check, 
  MoreHorizontal, 
  FolderPlus, 
  Upload, 
  Info,
  ChevronDown,
  FolderInput
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { useToast } from '../../context/ToastContext';
import { formatBytes } from '../../services/db';

export interface BreadcrumbNavigationProps {
  breadcrumbs: { id: string | null; name: string }[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
  onOpenNewFolder?: () => void;
  onOpenUpload?: () => void;
  onOpenDetails?: () => void;
  totalItemsCount?: number;
  className?: string;
}

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  breadcrumbs,
  currentFolderId,
  onNavigate,
  onOpenNewFolder,
  onOpenUpload,
  onOpenDetails,
  totalItemsCount,
  className = ''
}) => {
  const { folders, files, uploadFiles, activeTab } = useDrive();
  const { showToast, updateToast } = useToast();

  const [dragOverCrumbId, setDragOverCrumbId] = useState<string | null | 'NONE'>('NONE');
  const [isCopied, setIsCopied] = useState(false);
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showFolderActionsMenu, setShowFolderActionsMenu] = useState(false);

  const ellipsisRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowFolderActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute parent crumb for quick "Up to parent" jump
  const parentCrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  // Helper to get folder color
  const getFolderColor = (folderId: string | null) => {
    if (!folderId) return '#3b82f6';
    const f = folders.find(item => item.id === folderId);
    return f?.color || '#3b82f6';
  };

  // Helper to get item count of a specific folder
  const getFolderItemCount = (folderId: string | null) => {
    if (!folderId) return undefined;
    const subFolders = folders.filter(f => !f.isDeleted && f.parentId === folderId).length;
    const subFiles = files.filter(f => !f.isDeleted && f.folderId === folderId).length;
    return subFolders + subFiles;
  };

  // Icon for root or specific tabs
  const getCrumbIcon = (crumb: { id: string | null; name: string }, isRoot: boolean) => {
    if (!isRoot) {
      const color = getFolderColor(crumb.id);
      return <Folder className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
    }

    switch (activeTab) {
      case 'shared':
        return <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
      case 'recent':
        return <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'starred':
        return <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'trash':
        return <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case 'admin':
      case 'audit':
        return <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return <HardDrive className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    }
  };

  // Copy full folder path to clipboard
  const handleCopyPath = async () => {
    const fullPath = breadcrumbs.map(b => b.name).join(' / ');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullPath);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullPath;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      showToast({
        id: 'copy_path_' + Date.now(),
        type: 'success',
        title: 'Path Copied',
        message: `"${fullPath}" copied to clipboard`,
        duration: 3000,
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast({
        id: 'copy_err_' + Date.now(),
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not access clipboard.',
        duration: 3000,
      });
    }
  };

  // Handle drag-and-drop uploads directly into any ancestor breadcrumb folder
  const handleCrumbDrop = async (e: React.DragEvent, targetFolderId: string | null, targetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCrumbId('NONE');

    const filesArray: File[] = e.dataTransfer.files
      ? Array.from(e.dataTransfer.files).filter((file): file is File => file instanceof File)
      : [];

    if (filesArray.length > 0) {
      const toastId = 'upload_crumb_' + Date.now();
      const count = filesArray.length;
      const countLabel = count === 1 ? '1 file' : `${count} files`;

      showToast({
        id: toastId,
        type: 'loading',
        title: `Uploading ${countLabel}...`,
        message: `Transferring directly into "${targetName}"`,
      });

      try {
        const success = await uploadFiles(filesArray, targetFolderId);
        if (success) {
          const totalBytes = filesArray.reduce((acc, f) => acc + f.size, 0);
          updateToast(toastId, {
            type: 'success',
            title: 'Upload complete',
            message: `Successfully uploaded ${countLabel} (${formatBytes(totalBytes)}) to "${targetName}".`,
            duration: 4000,
          });
        } else {
          updateToast(toastId, {
            type: 'error',
            title: 'Upload failed',
            message: 'Storage quota limit exceeded. Please free up space.',
            duration: 4000,
          });
        }
      } catch {
        updateToast(toastId, {
          type: 'error',
          title: 'Upload failed',
          message: 'An error occurred while uploading files.',
          duration: 4000,
        });
      }
    }
  };

  // Determine if breadcrumbs should be collapsed (e.g. if length > 4)
  const isDeepHierarchy = breadcrumbs.length > 4;
  
  // Collapsed crumbs structure:
  // First item: root (index 0)
  // Middle items (index 1 to length - 3): collapsed inside ellipsis
  // Last 2 items: immediate parent (length - 2) and current folder (length - 1)
  const rootCrumb = breadcrumbs[0];
  const collapsedCrumbs = isDeepHierarchy ? breadcrumbs.slice(1, breadcrumbs.length - 2) : [];
  const visibleTailCrumbs = isDeepHierarchy 
    ? breadcrumbs.slice(breadcrumbs.length - 2) 
    : breadcrumbs.slice(1);

  return (
    <div className={`flex items-center gap-2 min-w-0 flex-1 ${className}`}>
      {/* Quick "Up to parent" button */}
      {parentCrumb && (
        <button
          type="button"
          onClick={() => onNavigate(parentCrumb.id)}
          title={`Navigate back up one level to "${parentCrumb.name}" (Alt+Up)`}
          className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold border border-slate-200 hover:border-blue-200 transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95"
        >
          <CornerLeftUp className="w-3.5 h-3.5 text-blue-600 transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Up to {parentCrumb.name}</span>
          <span className="sm:hidden">Up</span>
        </button>
      )}

      {/* Semantic Breadcrumb Navigation Trail */}
      <nav aria-label="Folder hierarchy" className="flex items-center gap-1.5 text-xs text-slate-600 overflow-x-auto py-1 scrollbar-none min-w-0">
        <ol className="flex items-center gap-1.5 list-none m-0 p-0 shrink-0">
          {/* Root Crumb */}
          {rootCrumb && (
            <li className="flex items-center gap-1.5 shrink-0">
              {breadcrumbs.length === 1 ? (
                <div
                  aria-current="page"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-900 font-bold border border-slate-200 shadow-2xs select-none"
                >
                  {getCrumbIcon(rootCrumb, true)}
                  <span className="truncate max-w-[140px] sm:max-w-xs">{rootCrumb.name}</span>
                  {typeof totalItemsCount === 'number' && (
                    <span className="text-[10px] font-semibold bg-white text-slate-500 px-1.5 py-0.2 rounded-full border border-slate-200 shadow-2xs">
                      {totalItemsCount}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(rootCrumb.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragOverCrumbId !== rootCrumb.id) setDragOverCrumbId(rootCrumb.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverCrumbId === rootCrumb.id) setDragOverCrumbId('NONE');
                  }}
                  onDrop={(e) => handleCrumbDrop(e, rootCrumb.id, rootCrumb.name)}
                  title={`Navigate back to ${rootCrumb.name}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                    dragOverCrumbId === rootCrumb.id
                      ? 'bg-blue-100 text-blue-900 ring-2 ring-blue-500 font-bold scale-105'
                      : 'hover:text-blue-600 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {getCrumbIcon(rootCrumb, true)}
                  <span className="truncate max-w-[120px] sm:max-w-xs">{rootCrumb.name}</span>
                </button>
              )}
            </li>
          )}

          {/* Collapsed Intermediate Ellipsis Dropdown for deep paths */}
          {isDeepHierarchy && collapsedCrumbs.length > 0 && (
            <li className="flex items-center gap-1.5 shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <div className="relative" ref={ellipsisRef}>
                <button
                  type="button"
                  onClick={() => setShowEllipsisMenu(!showEllipsisMenu)}
                  title={`${collapsedCrumbs.length} hidden parent folders. Click to view.`}
                  className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showEllipsisMenu && (
                  <div className="absolute left-0 top-8 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 mb-1">
                      Parent Hierarchy
                    </div>
                    {collapsedCrumbs.map((crumb, i) => {
                      const count = getFolderItemCount(crumb.id);
                      return (
                        <button
                          key={crumb.id || i}
                          type="button"
                          onClick={() => {
                            setShowEllipsisMenu(false);
                            onNavigate(crumb.id);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: getFolderColor(crumb.id) }} />
                            <span className="truncate font-medium">{crumb.name}</span>
                          </div>
                          {typeof count === 'number' && (
                            <span className="text-[10px] text-slate-400 group-hover:text-blue-500 shrink-0">
                              {count} items
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          )}

          {/* Visible Tail Crumb(s) */}
          {visibleTailCrumbs.map((crumb, idx) => {
            const isLast = idx === visibleTailCrumbs.length - 1;
            const isTargeted = dragOverCrumbId === crumb.id;
            const folderColor = getFolderColor(crumb.id);

            return (
              <li key={crumb.id || idx} className="flex items-center gap-1.5 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                {isLast ? (
                  <div className="flex items-center gap-1.5" ref={actionsRef}>
                    <div
                      aria-current="page"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-900 font-bold border border-slate-200 shadow-2xs select-none"
                    >
                      <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: folderColor }} />
                      <span className="truncate max-w-[150px] sm:max-w-xs">{crumb.name}</span>
                      {typeof totalItemsCount === 'number' && (
                        <span className="text-[10px] font-semibold bg-white text-slate-600 px-1.5 py-0.2 rounded-full border border-slate-200 shadow-2xs">
                          {totalItemsCount}
                        </span>
                      )}
                    </div>

                    {/* Actions dropdown for current folder */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowFolderActionsMenu(!showFolderActionsMenu)}
                        title="Folder options"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {showFolderActionsMenu && (
                        <div className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                          {onOpenNewFolder && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowFolderActionsMenu(false);
                                onOpenNewFolder();
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
                              <span>New subfolder here</span>
                            </button>
                          )}
                          {onOpenUpload && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowFolderActionsMenu(false);
                                onOpenUpload();
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Upload files here</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setShowFolderActionsMenu(false);
                              handleCopyPath();
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy folder path</span>
                          </button>
                          {onOpenDetails && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowFolderActionsMenu(false);
                                onOpenDetails();
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Info className="w-3.5 h-3.5 text-slate-500" />
                              <span>Folder details</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(crumb.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverCrumbId !== crumb.id) {
                        setDragOverCrumbId(crumb.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverCrumbId === crumb.id) {
                        setDragOverCrumbId('NONE');
                      }
                    }}
                    onDrop={(e) => handleCrumbDrop(e, crumb.id, crumb.name)}
                    title={`Navigate back to ${crumb.name} (drop files to upload directly here)`}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                      isTargeted
                        ? 'bg-blue-100 text-blue-900 ring-2 ring-blue-500 font-bold scale-105'
                        : 'hover:text-blue-600 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: folderColor }} />
                    <span className="truncate max-w-[120px] sm:max-w-xs">{crumb.name}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Copy Path Quick Button */}
      {breadcrumbs.length > 1 && (
        <button
          type="button"
          onClick={handleCopyPath}
          title={isCopied ? 'Path copied!' : 'Copy full directory path to clipboard'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 hidden md:flex items-center justify-center"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
};
