import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  UploadCloud,
  LayoutGrid, 
  List, 
  ArrowUpDown, 
  ChevronRight, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Share2, 
  FolderInput, 
  HardDrive, 
  Download, 
  Check, 
  Filter, 
  Inbox, 
  FileCode, 
  Image, 
  FileText, 
  Video, 
  Music, 
  Archive,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowLeft,
  CornerLeftUp,
  Home,
  Keyboard
} from 'lucide-react';
import { useDrive, SortField, SortDirection } from '../../context/DriveContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatBytes } from '../../services/db';
import { FileItem, FolderItem, FileCategory } from '../../types/drive';
import { FileCard } from './FileCard';
import { FileListRow } from './FileListRow';
import { FilePreviewModal } from './FilePreviewModal';
import { FileUploadModal } from './FileUploadModal';
import { FolderModal } from './FolderModal';
import { MoveModal } from './MoveModal';
import { ShareModal } from './ShareModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { FileDetailsDrawer } from './FileDetailsDrawer';
import { ShortcutsModal } from './ShortcutsModal';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { PublicShareView } from './PublicShareView';

export const FileExplorer: React.FC = () => {
  const {
    breadcrumbs,
    currentFolderId,
    setCurrentFolderId,
    currentFiles,
    currentFolders,
    files,
    folders,
    viewMode,
    setViewMode,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    selectedItemIds,
    setSelectedItemIds,
    toggleSelectItem,
    clearSelection,
    downloadFile,
    renameFile,
    deleteFile,
    deleteFolder,
    toggleStarFile,
    uploadFiles,
    uploadQueue,
    clearCompletedUploads,
  } = useDrive();

  const { currentUser } = useAuth();
  const { showToast, updateToast } = useToast();

  // Modals state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null);

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);
  const [previewVisitorToken, setPreviewVisitorToken] = useState<string | null>(null);

  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [versionFileId, setVersionFileId] = useState<string | null>(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<{ file?: FileItem; folder?: FolderItem } | null>(null);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isUploadDockMinimized, setIsUploadDockMinimized] = useState(false);

  // Counter to avoid dragenter/dragleave child flickering in HTML5
  const dragCounter = useRef(0);

  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'My Drive';
  const parentCrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  // Track anchor ID for Shift+Click contiguous range selection
  const [lastAnchorId, setLastAnchorId] = useState<string | null>(null);
  const [bulkMoveItems, setBulkMoveItems] = useState<{ id: string; type: 'file' | 'folder'; name: string }[]>([]);

  // Sequential ordered list of visible items in current folder
  const visibleItems = useMemo(() => [
    ...currentFolders.map(f => ({ id: f.id, type: 'folder' as const, name: f.name })),
    ...currentFiles.map(f => ({ id: f.id, type: 'file' as const, name: f.name }))
  ], [currentFolders, currentFiles]);

  // Shift+Click and Ctrl/Cmd+Click multi-selection handler
  const handleItemClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+Click: contiguous range selection between anchor and clicked item
      e.preventDefault();
      const visibleIds = visibleItems.map(item => item.id);
      const targetIndex = visibleIds.indexOf(id);
      if (targetIndex === -1) return;

      let anchorIndex = -1;
      if (lastAnchorId) {
        anchorIndex = visibleIds.indexOf(lastAnchorId);
      }

      if (anchorIndex === -1) {
        setSelectedItemIds([id]);
        setLastAnchorId(id);
      } else {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeIds = visibleIds.slice(start, end + 1);

        if (e.ctrlKey || e.metaKey) {
          setSelectedItemIds(prev => Array.from(new Set([...prev, ...rangeIds])));
        } else {
          setSelectedItemIds(rangeIds);
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: toggle individual item selection
      e.preventDefault();
      toggleSelectItem(id);
      setLastAnchorId(id);
    } else {
      // Regular click: select this single item
      setSelectedItemIds([id]);
      setLastAnchorId(id);
    }
  };

  // Dedicated checkbox toggle handler (always toggles, supports Shift for range)
  const handleCheckboxClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      handleItemClick(id, e);
    } else {
      toggleSelectItem(id);
      setLastAnchorId(id);
    }
  };

  // Bulk Operations Handlers
  const handleBulkDelete = () => {
    const count = selectedItemIds.length;
    if (count === 0) return;
    selectedItemIds.forEach(id => {
      const isF = folders.some(f => f.id === id);
      if (isF) {
        deleteFolder(id);
      } else {
        deleteFile(id);
      }
    });
    clearSelection();
    showToast({
      id: 'trash_' + Date.now(),
      type: 'info',
      title: 'Moved to Recycle Bin',
      message: `${count} item${count === 1 ? '' : 's'} moved to Recycle Bin. You can restore from the trash anytime.`,
      duration: 4000,
    });
  };

  const handleBulkMove = () => {
    if (selectedItemIds.length === 0) return;
    const itemsToMove: { id: string; type: 'file' | 'folder'; name: string }[] = [];
    selectedItemIds.forEach(id => {
      const f = folders.find(item => item.id === id);
      if (f) {
        itemsToMove.push({ id: f.id, type: 'folder', name: f.name });
      } else {
        const fl = files.find(item => item.id === id);
        if (fl) {
          itemsToMove.push({ id: fl.id, type: 'file', name: fl.name });
        }
      }
    });
    if (itemsToMove.length > 0) {
      setBulkMoveItems(itemsToMove);
      setMoveTarget(null);
      setIsMoveOpen(true);
    }
  };

  const handleBulkDownload = async () => {
    const selectedFiles = files.filter(f => selectedItemIds.includes(f.id) && !f.isDeleted);
    if (selectedFiles.length === 0) return;
    showToast({
      id: 'dl_' + Date.now(),
      type: 'info',
      title: 'Downloading files',
      message: `Downloading ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}...`,
      duration: 3000,
    });
    for (const f of selectedFiles) {
      await downloadFile(f.id);
    }
  };

  // Keyboard Shortcut System (US acceptance: 'Delete' key to remove selected items, 'Enter' to open folders)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Check if user is typing in an input, textarea or editable element
      const active = document.activeElement;
      const isEditing = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        (active as HTMLElement).isContentEditable
      );

      // If typing in an input, allow Escape to blur or close
      if (isEditing) {
        if (e.key === 'Escape') {
          (active as HTMLElement).blur();
        }
        return;
      }

      // 2. Modals management: If a modal is open, Escape closes it
      const hasOpenModal = isPreviewOpen || isUploadOpen || isFolderModalOpen || isMoveOpen || isShareOpen || isVersionsOpen || isDetailsOpen || isShortcutsOpen;
      if (hasOpenModal) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPreviewOpen(false);
          setIsUploadOpen(false);
          setIsFolderModalOpen(false);
          setIsMoveOpen(false);
          setIsShareOpen(false);
          setIsVersionsOpen(false);
          setIsDetailsOpen(false);
          setIsShortcutsOpen(false);
        }
        return;
      }

      // 3. Shortcuts modal toggle (? or Shift + /)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }

      // 4. Escape: clear selection
      if (e.key === 'Escape') {
        if (selectedItemIds.length > 0) {
          e.preventDefault();
          clearSelection();
        }
        return;
      }

      // 5. Select All (Ctrl+A or Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allVisibleIds = [
          ...currentFolders.map(f => f.id),
          ...currentFiles.map(f => f.id)
        ];
        setSelectedItemIds(allVisibleIds);
        return;
      }

      // 6. Delete / Backspace: delete selected items (US acceptance: Delete to remove selected items)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
          return;
        } else if (e.key === 'Backspace') {
          // Go up to parent folder when nothing selected
          if (parentCrumb) {
            e.preventDefault();
            setCurrentFolderId(parentCrumb.id);
            return;
          }
        }
      }

      // Alt + ArrowUp: Go up to parent directory
      if (e.altKey && e.key === 'ArrowUp') {
        if (parentCrumb) {
          e.preventDefault();
          setCurrentFolderId(parentCrumb.id);
          return;
        }
      }

      // 7. Enter: Open folder or preview file (US acceptance: Enter to open folders)
      if (e.key === 'Enter') {
        if (selectedItemIds.length > 0) {
          e.preventDefault();
          // Priority 1: Check if a folder is selected -> Open it!
          const selFolder = currentFolders.find(f => selectedItemIds.includes(f.id));
          if (selFolder) {
            setCurrentFolderId(selFolder.id);
            clearSelection();
            showToast({
              id: 'open_folder_' + Date.now(),
              type: 'info',
              title: 'Folder opened',
              message: `Navigated into "${selFolder.name}"`,
              duration: 2500,
            });
            return;
          }
          // Priority 2: Check if a file is selected -> Preview it!
          const selFile = currentFiles.find(f => selectedItemIds.includes(f.id));
          if (selFile) {
            setPreviewFile(selFile);
            setIsPreviewOpen(true);
            return;
          }
        }
      }

      // 8. Space: Quick look / preview toggle
      if (e.key === ' ') {
        if (selectedItemIds.length > 0) {
          const selFile = currentFiles.find(f => selectedItemIds.includes(f.id));
          if (selFile) {
            e.preventDefault();
            setPreviewFile(selFile);
            setIsPreviewOpen(true);
            return;
          }
        }
      }

      // 9. F2: Rename selected item
      if (e.key === 'F2') {
        if (selectedItemIds.length === 1) {
          e.preventDefault();
          const selFolder = currentFolders.find(f => f.id === selectedItemIds[0]);
          if (selFolder) {
            setFolderToRename({ id: selFolder.id, name: selFolder.name });
            setIsFolderModalOpen(true);
            return;
          }
          const selFile = currentFiles.find(f => f.id === selectedItemIds[0]);
          if (selFile) {
            const newName = prompt('Enter new filename:', selFile.name);
            if (newName && newName.trim() && newName !== selFile.name) {
              renameFile(selFile.id, newName.trim());
            }
            return;
          }
        }
      }

      // 10. M: Move selected items
      if (e.key === 'm' || e.key === 'M') {
        if (selectedItemIds.length > 0) {
          e.preventDefault();
          handleBulkMove();
          return;
        }
      }

      // 11. Arrow keys navigation (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const allVisible = [
          ...currentFolders.map(f => ({ id: f.id, type: 'folder' as const, name: f.name })),
          ...currentFiles.map(f => ({ id: f.id, type: 'file' as const, name: f.name }))
        ];
        if (allVisible.length === 0) return;

        e.preventDefault();

        if (selectedItemIds.length === 0) {
          // Select first item
          setSelectedItemIds([allVisible[0].id]);
          return;
        }

        // Find index of current selected item
        const currentSelectedId = selectedItemIds[selectedItemIds.length - 1];
        const currentIndex = allVisible.findIndex(item => item.id === currentSelectedId);
        let nextIndex = currentIndex >= 0 ? currentIndex : 0;

        if (viewMode === 'list') {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            nextIndex = currentIndex < allVisible.length - 1 ? currentIndex + 1 : 0;
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : allVisible.length - 1;
          }
        } else {
          // Grid mode step
          const cols = window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : 2;
          if (e.key === 'ArrowRight') {
            nextIndex = currentIndex < allVisible.length - 1 ? currentIndex + 1 : 0;
          } else if (e.key === 'ArrowLeft') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : allVisible.length - 1;
          } else if (e.key === 'ArrowDown') {
            nextIndex = currentIndex + cols < allVisible.length ? currentIndex + cols : (currentIndex + 1) % allVisible.length;
          } else if (e.key === 'ArrowUp') {
            nextIndex = currentIndex - cols >= 0 ? currentIndex - cols : (currentIndex - 1 + allVisible.length) % allVisible.length;
          }
        }

        const nextItem = allVisible[nextIndex];
        if (nextItem) {
          if (e.shiftKey) {
            setSelectedItemIds(prev => prev.includes(nextItem.id) ? prev : [...prev, nextItem.id]);
          } else {
            setSelectedItemIds([nextItem.id]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    currentFolders,
    currentFiles,
    selectedItemIds,
    setSelectedItemIds,
    clearSelection,
    deleteFile,
    deleteFolder,
    renameFile,
    folders,
    parentCrumb,
    setCurrentFolderId,
    showToast,
    viewMode,
    isPreviewOpen,
    isUploadOpen,
    isFolderModalOpen,
    isMoveOpen,
    isShareOpen,
    isVersionsOpen,
    isDetailsOpen,
    isShortcutsOpen
  ]);

  // HTML5 Drag and drop onto main FileExplorer pane
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounter.current += 1;
      if (dragCounter.current === 1) {
        setIsDraggingGlobal(true);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingGlobal) {
        setIsDraggingGlobal(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingGlobal(false);
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingGlobal(false);
    setDragOverFolderId(null);

    // Process e.dataTransfer.files as an array for multiple simultaneous file uploads
    const filesArray: File[] = e.dataTransfer.files 
      ? Array.from(e.dataTransfer.files).filter((file): file is File => file instanceof File)
      : [];

    // Fallback support for DataTransferItemList if files list was empty
    if (filesArray.length === 0 && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) filesArray.push(file);
        }
      }
    }

    if (filesArray.length > 0) {
      const toastId = 'upload_' + Date.now();
      const count = filesArray.length;
      const countLabel = count === 1 ? '1 file' : `${count} files`;
      const targetName = currentFolderName;

      showToast({
        id: toastId,
        type: 'loading',
        title: `Uploading ${countLabel}...`,
        message: `Transferring ${countLabel} directly into "${targetName}"`,
      });

      try {
        const success = await uploadFiles(filesArray, currentFolderId);
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
            message: 'Storage quota limit exceeded. Please free up space or adjust quota.',
            duration: 5000,
          });
        }
      } catch {
        updateToast(toastId, {
          type: 'error',
          title: 'Upload failed',
          message: 'An unexpected error occurred while saving files.',
          duration: 5000,
        });
      }
    }
  };

  // Folder sub-item count helper
  const getFolderChildCount = (folderId: string) => {
    const childFolders = folders.filter(f => !f.isDeleted && f.parentId === folderId).length;
    const childFiles = files.filter(f => !f.isDeleted && f.folderId === folderId).length;
    return childFolders + childFiles;
  };

  const getFolderColor = (folderId: string | null) => {
    if (!folderId) return '#3b82f6';
    const f = folders.find(item => item.id === folderId);
    return f?.color || '#3b82f6';
  };

  // Category filter items
  const categories: { id: FileCategory | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Files', icon: <Inbox className="w-3.5 h-3.5" /> },
    { id: 'document', label: 'Documents', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'image', label: 'Images', icon: <Image className="w-3.5 h-3.5" /> },
    { id: 'video', label: 'Videos', icon: <Video className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <Music className="w-3.5 h-3.5" /> },
    { id: 'code', label: 'Code & Data', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'archive', label: 'Archives', icon: <Archive className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col overflow-y-auto bg-slate-50/40 relative"
    >
      {/* Global Drag & Drop Backdrop Overlay */}
      {isDraggingGlobal && (
        <div 
          className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] z-30 flex items-center justify-center p-6"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border-2 border-dashed border-blue-500 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-150 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 animate-bounce">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Drop multiple files from desktop
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-3">
              Release files to upload them simultaneously into:
            </p>
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-semibold text-xs shadow-2xs">
              <Folder className="w-4 h-4 text-blue-600" />
              <span className="truncate max-w-xs">{currentFolderName}</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Breadcrumb Navigation & Toolbar Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-2xs">
        {/* Breadcrumb Navigation Component */}
        <BreadcrumbNavigation
          breadcrumbs={breadcrumbs}
          currentFolderId={currentFolderId}
          onNavigate={(folderId) => setCurrentFolderId(folderId)}
          onOpenNewFolder={() => setIsFolderModalOpen(true)}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenDetails={() => {
            if (currentFolderId) {
              const curFolder = folders.find(f => f.id === currentFolderId);
              if (curFolder) {
                setDetailsTarget({ folder: curFolder });
                setIsDetailsOpen(true);
              }
            }
          }}
          totalItemsCount={currentFiles.length + currentFolders.length}
        />

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Multi-Selection actions */}
          {selectedItemIds.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-blue-50 border border-blue-200 px-2.5 sm:px-3 py-1 rounded-xl text-xs text-blue-800 shadow-2xs animate-in fade-in zoom-in-95">
              <span className="font-bold whitespace-nowrap">{selectedItemIds.length} selected</span>

              <div className="h-3.5 w-px bg-blue-200 mx-0.5" />

              {/* Bulk Move Button */}
              <button
                type="button"
                onClick={handleBulkMove}
                className="flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-100/70 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                title="Move selected items to another folder (M)"
              >
                <FolderInput className="w-3.5 h-3.5 text-blue-600" />
                <span>Move</span>
              </button>

              {/* Bulk Delete Button */}
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 font-semibold text-red-600 hover:text-red-800 hover:bg-red-100/70 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                title="Delete selected items (Delete / Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Delete</span>
              </button>

              {/* Bulk Download Button if files are selected */}
              {selectedItemIds.some(id => files.some(f => f.id === id)) && (
                <button
                  type="button"
                  onClick={handleBulkDownload}
                  className="hidden md:flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 hover:bg-blue-100/70 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                  title="Download selected files"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download</span>
                </button>
              )}

              {/* Clear selection */}
              <button
                type="button"
                onClick={clearSelection}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-blue-100/50 transition-colors cursor-pointer ml-0.5"
                title="Clear selection (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Shortcuts Info Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-500 shadow-2xs">?</kbd>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent border-none text-slate-700 font-semibold text-xs outline-none cursor-pointer px-2 py-0.5"
            >
              <option value="name">Sort by Name</option>
              <option value="updatedAt">Sort by Date</option>
              <option value="size">Sort by Size</option>
              <option value="type">Sort by Type</option>
            </select>
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer ml-1"
              title={`Sorting ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Pills (US-14) */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
          Filter:
        </span>
        {categories.map((cat) => {
          const isSelected = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 space-y-6">
        {/* Folders Section */}
        {currentFolders.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Folders ({currentFolders.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {currentFolders.map((folder) => {
                const childCount = getFolderChildCount(folder.id);
                const isFolderTargeted = dragOverFolderId === folder.id;
                const isFolderSelected = selectedItemIds.includes(folder.id);

                return (
                  <div
                    key={folder.id}
                    onClick={(e) => handleItemClick(folder.id, e)}
                    onDoubleClick={() => setCurrentFolderId(folder.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dragOverFolderId !== folder.id) {
                        setDragOverFolderId(folder.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverFolderId === folder.id) {
                        setDragOverFolderId(null);
                      }
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(null);
                      dragCounter.current = 0;
                      setIsDraggingGlobal(false);

                      const filesArray: File[] = e.dataTransfer.files 
                        ? Array.from(e.dataTransfer.files).filter((file): file is File => file instanceof File)
                        : [];

                      if (filesArray.length === 0 && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                        for (let i = 0; i < e.dataTransfer.items.length; i++) {
                          const item = e.dataTransfer.items[i];
                          if (item.kind === 'file') {
                            const file = item.getAsFile();
                            if (file) filesArray.push(file);
                          }
                        }
                      }

                      if (filesArray.length > 0) {
                        const toastId = 'upload_folder_' + Date.now();
                        const count = filesArray.length;
                        const countLabel = count === 1 ? '1 file' : `${count} files`;
                        const targetName = folder.name;

                        showToast({
                          id: toastId,
                          type: 'loading',
                          title: `Uploading ${countLabel}...`,
                          message: `Transferring ${countLabel} directly into "${targetName}"`,
                        });

                        try {
                          const success = await uploadFiles(filesArray, folder.id);
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
                              message: 'Storage quota limit exceeded. Please free up space or adjust quota.',
                              duration: 5000,
                            });
                          }
                        } catch {
                          updateToast(toastId, {
                            type: 'error',
                            title: 'Upload failed',
                            message: 'An unexpected error occurred while saving files.',
                            duration: 5000,
                          });
                        }
                      }
                    }}
                    className={`group bg-white rounded-2xl border p-3 flex items-center justify-between transition-all cursor-pointer select-none ${
                      isFolderTargeted
                        ? 'border-blue-500 ring-4 ring-blue-500/20 bg-blue-50/80 scale-[1.02] shadow-lg'
                        : isFolderSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Folder selection checkbox */}
                      <button
                        type="button"
                        onClick={(e) => handleCheckboxClick(folder.id, e)}
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isFolderSelected
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-300 hover:border-slate-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={isFolderSelected ? 'Deselect folder' : 'Select folder'}
                      >
                        {isFolderSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                        style={{ backgroundColor: `${folder.color || '#3b82f6'}15` }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setCurrentFolderId(folder.id);
                        }}
                      >
                        <Folder className="w-5 h-5" style={{ color: folder.color || '#3b82f6' }} />
                      </div>
                      <div 
                        className="min-w-0 cursor-pointer flex-1"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setCurrentFolderId(folder.id);
                        }}
                      >
                        <h4 className="font-semibold text-xs text-slate-800 truncate">
                          {folder.name}
                        </h4>
                        {isFolderTargeted ? (
                          <span className="text-[10px] text-blue-600 font-bold block mt-0.5 animate-pulse">
                            Drop to upload inside
                          </span>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {childCount} item{childCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Folder Context Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFolderMenuId(activeFolderMenuId === folder.id ? null : folder.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeFolderMenuId === folder.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFolderMenuId(null);
                            }}
                          />
                          <div
                            className="absolute right-0 top-6 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                setCurrentFolderId(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Folder className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                setShareTarget({ id: folder.id, type: 'folder', name: folder.name });
                                setIsShareOpen(true);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share Folder</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                setFolderToRename({ id: folder.id, name: folder.name });
                                setIsFolderModalOpen(true);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                setMoveTarget({ id: folder.id, type: 'folder', name: folder.name });
                                setIsMoveOpen(true);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 cursor-pointer"
                            >
                              <FolderInput className="w-3.5 h-3.5" />
                              <span>Move</span>
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                deleteFolder(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Folder</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Files ({currentFiles.length})
            </h3>
            {currentFiles.length > 0 && viewMode === 'list' && (
              <div className="text-[11px] text-slate-400 flex items-center gap-4 pr-6 hidden sm:flex">
                <span className="w-32">Date Modified</span>
                <span className="w-24 text-right">Size</span>
                <span className="w-16"></span>
              </div>
            )}
          </div>

          {currentFiles.length === 0 && currentFolders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Inbox className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm mb-1">
                {searchQuery ? 'No matching files found' : 'This folder is empty'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-6">
                {searchQuery 
                  ? `No files or folders matched "${searchQuery}". Try a different keyword.` 
                  : 'Get started by uploading documents, images, code files, or creating organized folders.'}
              </p>
              {!searchQuery && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Files</span>
                  </button>
                  <button
                    onClick={() => {
                      setFolderToRename(null);
                      setIsFolderModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Create Folder</span>
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {currentFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={selectedItemIds.includes(file.id)}
                  onSelect={(e) => handleItemClick(file.id, e)}
                  onToggleSelect={(e) => handleCheckboxClick(file.id, e)}
                  onPreview={() => {
                    setPreviewFile(file);
                    setIsPreviewOpen(true);
                  }}
                  onDownload={() => downloadFile(file.id)}
                  onShare={() => {
                    setShareTarget({ id: file.id, type: 'file', name: file.name });
                    setIsShareOpen(true);
                  }}
                  onRename={async () => {
                    const newName = prompt('Enter new filename:', file.name);
                    if (newName && newName.trim() && newName !== file.name) {
                      const res = await renameFile(file.id, newName.trim());
                      if (!res.success) {
                        alert(res.error || 'Failed to rename file');
                      }
                    }
                  }}
                  onMove={() => {
                    setMoveTarget({ id: file.id, type: 'file', name: file.name });
                    setIsMoveOpen(true);
                  }}
                  onVersions={() => {
                    setVersionFileId(file.id);
                    setIsVersionsOpen(true);
                  }}
                  onDetails={() => {
                    setDetailsTarget({ file });
                    setIsDetailsOpen(true);
                  }}
                  onDelete={() => deleteFile(file.id)}
                  onToggleStar={() => toggleStarFile(file.id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 p-1">
              {currentFiles.map((file) => (
                <FileListRow
                  key={file.id}
                  file={file}
                  isSelected={selectedItemIds.includes(file.id)}
                  onSelect={(e) => handleItemClick(file.id, e)}
                  onToggleSelect={(e) => handleCheckboxClick(file.id, e)}
                  onPreview={() => {
                    setPreviewFile(file);
                    setIsPreviewOpen(true);
                  }}
                  onDownload={() => downloadFile(file.id)}
                  onShare={() => {
                    setShareTarget({ id: file.id, type: 'file', name: file.name });
                    setIsShareOpen(true);
                  }}
                  onRename={async () => {
                    const newName = prompt('Enter new filename:', file.name);
                    if (newName && newName.trim() && newName !== file.name) {
                      const res = await renameFile(file.id, newName.trim());
                      if (!res.success) {
                        alert(res.error || 'Failed to rename file');
                      }
                    }
                  }}
                  onMove={() => {
                    setMoveTarget({ id: file.id, type: 'file', name: file.name });
                    setIsMoveOpen(true);
                  }}
                  onVersions={() => {
                    setVersionFileId(file.id);
                    setIsVersionsOpen(true);
                  }}
                  onDetails={() => {
                    setDetailsTarget({ file });
                    setIsDetailsOpen(true);
                  }}
                  onDelete={() => deleteFile(file.id)}
                  onToggleStar={() => toggleStarFile(file.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        file={previewFile}
        files={currentFiles}
        onNavigateFile={(file) => setPreviewFile(file)}
        onOpenShare={(id) => {
          setShareTarget({ id, type: 'file', name: previewFile?.name || '' });
          setIsShareOpen(true);
        }}
        onOpenVersions={(id) => {
          setVersionFileId(id);
          setIsVersionsOpen(true);
        }}
      />

      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      <FolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderToRename(null);
        }}
        folderIdToRename={folderToRename?.id || null}
        initialName={folderToRename?.name || ''}
      />

      <MoveModal
        isOpen={isMoveOpen}
        onClose={() => {
          setIsMoveOpen(false);
          setMoveTarget(null);
          setBulkMoveItems([]);
        }}
        itemId={moveTarget?.id || null}
        itemType={moveTarget?.type || 'file'}
        itemName={moveTarget?.name || ''}
        items={bulkMoveItems.length > 0 ? bulkMoveItems : undefined}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => {
          setIsShareOpen(false);
          setShareTarget(null);
        }}
        itemId={shareTarget?.id || null}
        itemType={shareTarget?.type || 'file'}
        itemName={shareTarget?.name || ''}
        onOpenVisitorPreview={(token) => {
          setIsShareOpen(false);
          setPreviewVisitorToken(token);
        }}
      />

      <VersionHistoryModal
        isOpen={isVersionsOpen}
        onClose={() => {
          setIsVersionsOpen(false);
          setVersionFileId(null);
        }}
        fileId={versionFileId}
      />

      <FileDetailsDrawer
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setDetailsTarget(null);
        }}
        file={detailsTarget?.file}
        folder={detailsTarget?.folder}
        onOpenVersions={(id) => {
          setVersionFileId(id);
          setIsVersionsOpen(true);
        }}
        onDownload={(id) => downloadFile(id)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Floating Upload Activity Dock (Real-time feedback for desktop drag-and-drop) */}
      {uploadQueue.length > 0 && (
        <div className="fixed bottom-5 right-5 z-40 w-84 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-blue-400" />
              <span>
                {uploadQueue.filter(q => q.status === 'uploading').length > 0
                  ? `Uploading ${uploadQueue.filter(q => q.status === 'uploading').length} item(s)...`
                  : `${uploadQueue.filter(q => q.status === 'completed').length} upload(s) complete`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsUploadDockMinimized(!isUploadDockMinimized)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isUploadDockMinimized ? 'Expand' : 'Minimize'}
              >
                {isUploadDockMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={clearCompletedUploads}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isUploadDockMinimized && (
            <div className="p-3 max-h-56 overflow-y-auto space-y-2 bg-slate-50/50">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 truncate pr-2">
                      {item.file.name}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                      {formatBytes(item.file.size)}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
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

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {item.status === 'uploading' && 'Transferring into drive...'}
                      {item.status === 'completed' && 'Saved in current folder'}
                      {item.status === 'error' && (item.errorMessage || 'Upload failed')}
                      {item.status === 'pending' && 'Queued...'}
                    </span>
                    {item.status === 'uploading' && (
                      <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                    )}
                    {item.status === 'completed' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Visitor Experience Preview Overlay */}
      {previewVisitorToken && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
          <PublicShareView
            token={previewVisitorToken}
            onClose={() => setPreviewVisitorToken(null)}
          />
        </div>
      )}
    </div>
  );
};
