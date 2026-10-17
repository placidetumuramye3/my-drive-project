import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileItem, 
  FolderItem, 
  FileCategory, 
  UploadQueueItem, 
  SharePermission, 
  PublicShareLink,
  FileVersion,
  PendingOfflineUpload
} from '../types/drive';
import { 
  getFiles, 
  saveFiles, 
  getFolders, 
  saveFolders, 
  storeBlob, 
  getBlob, 
  deleteBlob, 
  computeSHA256, 
  detectCategory, 
  addAuditLog,
  getPendingOfflineUploads,
  updatePendingOfflineUpload,
  removePendingOfflineUpload,
  getCachedOfflineFileIds,
  addCachedOfflineFileId,
  removeCachedOfflineFileId,
  recordFileViewed,
  getOfflineMetadataSnapshot
} from '../services/db';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { 
  isAppOnline, 
  isSimulatedOffline, 
  setSimulatedOffline, 
  initServiceWorker, 
  cacheFileForOffline, 
  removeFileFromOffline, 
  queueOfflineUpload, 
  cancelOfflineUpload, 
  snapshotMetadataOffline 
} from '../services/offlineSync';

export type NavTab = 'my-drive' | 'shared' | 'recent' | 'starred' | 'trash' | 'admin' | 'audit';

export type SortField = 'name' | 'size' | 'updatedAt' | 'type';
export type SortDirection = 'asc' | 'desc';

interface DriveContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  currentFolderId: string | null;
  setCurrentFolderId: (folderId: string | null) => void;
  breadcrumbs: { id: string | null; name: string }[];
  
  // Data
  files: FileItem[];
  folders: FolderItem[];
  currentFiles: FileItem[];
  currentFolders: FolderItem[];
  trashFiles: FileItem[];
  trashFolders: FolderItem[];
  
  // Selection
  selectedItemIds: string[];
  setSelectedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectItem: (id: string) => void;
  clearSelection: () => void;
  
  // View & Filters
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortDirection: SortDirection;
  setSortDirection: (dir: SortDirection) => void;
  categoryFilter: FileCategory | 'all';
  setCategoryFilter: (cat: FileCategory | 'all') => void;

  // Storage Stats
  storageUsedBytes: number;
  storageQuotaBytes: number;
  storagePercentage: number;
  isStorageNearlyFull: boolean;
  isStorageFull: boolean;
  storageByCategory: Record<FileCategory, number>;

  // Upload
  uploadQueue: UploadQueueItem[];
  uploadFiles: (filesToUpload: File[], targetFolderId?: string | null) => Promise<boolean>;
  clearCompletedUploads: () => void;

  // Offline & Service Worker Sync
  isOnline: boolean;
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  isSyncingOfflineQueue: boolean;
  pendingOfflineUploads: PendingOfflineUpload[];
  syncPendingUploads: () => Promise<number>;
  cancelPendingOfflineUpload: (id: string) => Promise<void>;
  retryPendingOfflineUpload: (id: string) => Promise<void>;
  cachedOfflineFileIds: string[];
  cacheFileForOfflineMode: (fileId: string) => Promise<boolean>;
  removeFileFromOfflineMode: (fileId: string) => Promise<void>;
  isFileCachedOffline: (fileId: string) => boolean;
  clearOfflineCache: () => Promise<void>;
  markFileAsViewedAndCache: (file: FileItem) => Promise<void>;

  // File Operations
  downloadFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (fileId: string) => void;
  restoreFile: (fileId: string) => { success: boolean; message: string };
  permanentlyDeleteFile: (fileId: string) => Promise<void>;
  moveItem: (itemId: string, itemType: 'file' | 'folder', destinationFolderId: string | null) => Promise<{ success: boolean; error?: string }>;
  toggleStarFile: (fileId: string) => void;
  updateFileShare: (fileId: string, sharedWith: SharePermission[], publicLink: PublicShareLink | null) => void;
  updateFolderShare: (folderId: string, sharedWith: SharePermission[], publicLink: PublicShareLink | null) => void;
  saveFileNewVersion: (fileId: string, newContentOrBlob: Blob | string, comment?: string) => Promise<{ success: boolean; error?: string }>;
  revertToVersion: (fileId: string, versionId: string) => Promise<{ success: boolean; error?: string }>;

  // Folder Operations
  createFolder: (name: string, parentId?: string | null, color?: string) => { success: boolean; error?: string };
  renameFolder: (folderId: string, newName: string) => { success: boolean; error?: string };
  deleteFolder: (folderId: string) => void;
  restoreFolder: (folderId: string) => { success: boolean; message: string };
  permanentlyDeleteFolder: (folderId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  
  // Helpers
  getFileContentUrl: (blobId: string) => Promise<string | null>;
  getFileBlob: (blobId: string) => Promise<Blob | null>;
  refreshData: () => void;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export const DriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<NavTab>('my-drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>('all');
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  // Offline & Service Worker state
  const [isOnlineState, setIsOnlineState] = useState<boolean>(() => isAppOnline());
  const [isSimulatedOfflineMode, setIsSimulatedOfflineMode] = useState<boolean>(() => isSimulatedOffline());
  const [pendingOfflineUploads, setPendingOfflineUploads] = useState<PendingOfflineUpload[]>(() => getPendingOfflineUploads());
  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState<boolean>(false);
  const [cachedOfflineFileIds, setCachedOfflineFileIds] = useState<string[]>(() => getCachedOfflineFileIds());

  const refreshData = useCallback(() => {
    let files = getFiles();
    let folders = getFolders();

    // If empty and offline, attempt to restore from offline snapshot
    if (files.length === 0 && folders.length === 0 && !isAppOnline()) {
      const snapshot = getOfflineMetadataSnapshot();
      if (snapshot) {
        files = snapshot.files;
        folders = snapshot.folders;
      }
    }

    setAllFiles(files);
    setAllFolders(folders);
    setCachedOfflineFileIds(getCachedOfflineFileIds());
    setPendingOfflineUploads(getPendingOfflineUploads());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, currentUser]);

  // Snapshot metadata for offline access whenever files or folders update
  useEffect(() => {
    if (allFiles.length > 0 || allFolders.length > 0) {
      snapshotMetadataOffline(allFiles, allFolders);
    }
  }, [allFiles, allFolders]);

  // Reset folder and selection on tab change
  useEffect(() => {
    setCurrentFolderId(null);
    setSelectedItemIds([]);
    setSearchQuery('');
  }, [activeTab]);

  // Filter accessible items based on current authenticated user
  const userFiles = useMemo(() => {
    if (!currentUser) return [];
    return allFiles.filter(f => {
      // Owner
      if (f.ownerId === currentUser.id) return true;
      // Admin can view all files in admin mode
      if (currentUser.role === 'admin' && activeTab === 'admin') return true;
      // Shared with user
      if (f.sharedWith.some(s => s.userId === currentUser.id || s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) return true;
      return false;
    });
  }, [allFiles, currentUser, activeTab]);

  const userFolders = useMemo(() => {
    if (!currentUser) return [];
    return allFolders.filter(f => {
      if (f.ownerId === currentUser.id) return true;
      if (currentUser.role === 'admin' && activeTab === 'admin') return true;
      if (f.sharedWith.some(s => s.userId === currentUser.id || s.userEmail.toLowerCase() === currentUser.email.toLowerCase())) return true;
      return false;
    });
  }, [allFolders, currentUser, activeTab]);

  // Storage calculation (active non-deleted files owned by current user)
  const storageUsedBytes = useMemo(() => {
    if (!currentUser) return 0;
    return allFiles
      .filter(f => f.ownerId === currentUser.id && !f.isDeleted)
      .reduce((acc, f) => acc + f.sizeBytes, 0);
  }, [allFiles, currentUser]);

  const storageQuotaBytes = currentUser?.storageQuotaBytes || (2 * 1024 * 1024 * 1024);
  const storagePercentage = Math.min(100, (storageUsedBytes / storageQuotaBytes) * 100);
  const isStorageNearlyFull = storagePercentage >= 80 && storagePercentage < 100;
  const isStorageFull = storagePercentage >= 100;

  const storageByCategory = useMemo(() => {
    const stats: Record<FileCategory, number> = {
      document: 0,
      image: 0,
      video: 0,
      audio: 0,
      archive: 0,
      code: 0,
      other: 0,
    };
    if (!currentUser) return stats;
    allFiles
      .filter(f => f.ownerId === currentUser.id && !f.isDeleted)
      .forEach(f => {
        stats[f.category] = (stats[f.category] || 0) + f.sizeBytes;
      });
    return stats;
  }, [allFiles, currentUser]);

  // Trash items
  const trashFiles = useMemo(() => {
    if (!currentUser) return [];
    return allFiles.filter(f => f.ownerId === currentUser.id && f.isDeleted);
  }, [allFiles, currentUser]);

  const trashFolders = useMemo(() => {
    if (!currentUser) return [];
    return allFolders.filter(f => f.ownerId === currentUser.id && f.isDeleted);
  }, [allFolders, currentUser]);

  // Compute Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (activeTab === 'trash') return [{ id: null, name: 'Recycle Bin' }];
    if (activeTab === 'shared') return [{ id: null, name: 'Shared with me' }];
    if (activeTab === 'recent') return [{ id: null, name: 'Recent' }];
    if (activeTab === 'starred') return [{ id: null, name: 'Starred' }];
    if (activeTab === 'admin') return [{ id: null, name: 'System Management' }];
    if (activeTab === 'audit') return [{ id: null, name: 'Security Audit Logs' }];

    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'My Drive' }];
    if (!currentFolderId) return crumbs;

    const path: { id: string | null; name: string }[] = [];
    let curr: string | null = currentFolderId;
    while (curr) {
      const f = allFolders.find(item => item.id === curr);
      if (f) {
        path.unshift({ id: f.id, name: f.name });
        curr = f.parentId;
      } else {
        break;
      }
    }
    return [...crumbs, ...path];
  }, [activeTab, currentFolderId, allFolders]);

  // Current view files & folders with search, filter, and sorting
  const { currentFiles, currentFolders } = useMemo(() => {
    let rawFiles: FileItem[] = [];
    let rawFolders: FolderItem[] = [];

    if (activeTab === 'trash') {
      rawFiles = trashFiles;
      rawFolders = trashFolders;
    } else if (activeTab === 'shared') {
      rawFiles = allFiles.filter(f => 
        !f.isDeleted && 
        f.ownerId !== currentUser?.id && 
        f.sharedWith.some(s => s.userId === currentUser?.id || s.userEmail.toLowerCase() === currentUser?.email.toLowerCase())
      );
      rawFolders = allFolders.filter(f => 
        !f.isDeleted && 
        f.ownerId !== currentUser?.id && 
        f.sharedWith.some(s => s.userId === currentUser?.id || s.userEmail.toLowerCase() === currentUser?.email.toLowerCase())
      );
    } else if (activeTab === 'recent') {
      rawFiles = userFiles
        .filter(f => !f.isDeleted)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 30);
      rawFolders = [];
    } else if (activeTab === 'starred') {
      rawFiles = userFiles.filter(f => !f.isDeleted && f.isStarred);
      rawFolders = [];
    } else {
      // My Drive: show files/folders inside current folder
      rawFiles = userFiles.filter(f => !f.isDeleted && f.folderId === currentFolderId && f.ownerId === currentUser?.id);
      rawFolders = userFolders.filter(f => !f.isDeleted && f.parentId === currentFolderId && f.ownerId === currentUser?.id);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      // When searching, search across all user's files and folders
      rawFiles = userFiles.filter(f => !f.isDeleted && (f.name.toLowerCase().includes(q) || f.extension.toLowerCase().includes(q)));
      rawFolders = userFolders.filter(f => !f.isDeleted && f.name.toLowerCase().includes(q));
    }

    // Category filter
    if (categoryFilter !== 'all') {
      rawFiles = rawFiles.filter(f => f.category === categoryFilter);
    }

    // Sorting
    const sortedFolders = [...rawFolders].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    const sortedFiles = [...rawFiles].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        comparison = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'type') {
        comparison = a.extension.localeCompare(b.extension);
      } else {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return { currentFiles: sortedFiles, currentFolders: sortedFolders };
  }, [
    activeTab, 
    currentFolderId, 
    userFiles, 
    userFolders, 
    trashFiles, 
    trashFolders, 
    allFiles, 
    allFolders, 
    currentUser, 
    searchQuery, 
    categoryFilter, 
    sortField, 
    sortDirection
  ]);

  // Selection toggle
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedItemIds([]);
  };

  // ---------------------------------------------------------------------------
  // Offline Synchronization & Service Worker Integration
  // ---------------------------------------------------------------------------

  const syncPendingUploads = useCallback(async (): Promise<number> => {
    if (isSyncingOfflineQueue) return 0;
    const pending = getPendingOfflineUploads();
    if (pending.length === 0) return 0;

    setIsSyncingOfflineQueue(true);
    let syncedCount = 0;

    for (const item of pending) {
      try {
        updatePendingOfflineUpload(item.id, { status: 'syncing', progress: 40 });
        setPendingOfflineUploads(getPendingOfflineUploads());

        const blob = await getBlob(item.blobId);
        if (!blob) {
          updatePendingOfflineUpload(item.id, { status: 'failed', error: 'File data could not be recovered from local store.' });
          continue;
        }

        const currentFileList = getFiles();
        let desiredName = item.name;
        let count = 1;
        const existingNames = new Set(
          currentFileList
            .filter(f => !f.isDeleted && f.folderId === item.targetFolderId)
            .map(f => f.name.toLowerCase())
        );
        while (existingNames.has(desiredName.toLowerCase())) {
          const parts = item.name.split('.');
          if (parts.length > 1) {
            const extPart = parts.pop();
            desiredName = `${parts.join('.')}_(${count}).${extPart}`;
          } else {
            desiredName = `${item.name}_(${count})`;
          }
          count++;
        }

        const checksum = await computeSHA256(blob);
        const ext = item.name.split('.').pop()?.toLowerCase() || '';

        let textContent: string | undefined;
        if (item.category === 'document' || item.category === 'code' || item.mimeType.startsWith('text/')) {
          try {
            textContent = await blob.text();
          } catch {
            // ignore non-text parse
          }
        }

        const newFileItem: FileItem = {
          id: 'file_' + Math.random().toString(36).substring(2, 10),
          name: desiredName,
          extension: ext,
          mimeType: item.mimeType,
          category: item.category,
          sizeBytes: item.sizeBytes,
          folderId: item.targetFolderId,
          ownerId: currentUser?.id || 'admin',
          blobId: item.blobId,
          createdAt: item.createdAt,
          updatedAt: new Date().toISOString(),
          isDeleted: false,
          isStarred: false,
          checksum,
          sharedWith: [],
          publicLink: null,
          isCachedOffline: true,
          versions: [
            {
              versionId: 'v1_' + Math.random().toString(36).substring(2, 9),
              versionNumber: 1,
              uploadedAt: new Date().toISOString(),
              uploadedBy: currentUser?.name || 'Local User',
              sizeBytes: item.sizeBytes,
              blobId: item.blobId,
              comment: 'Uploaded from offline queue',
              checksum,
            }
          ],
          textContent,
        };

        const updated = [...getFiles(), newFileItem];
        saveFiles(updated);
        setAllFiles(updated);

        addAuditLog({
          userId: currentUser?.id || 'offline_sync',
          userEmail: currentUser?.email || 'system@storage.drive',
          eventType: 'FILE_UPLOAD',
          description: `Synced offline upload "${newFileItem.name}" (${(newFileItem.sizeBytes / 1024).toFixed(1)} KB)`,
          ipAddress: '127.0.0.1',
          severity: 'info',
        });

        // Mark as cached and remove from queue
        addCachedOfflineFileId(newFileItem.id);
        removePendingOfflineUpload(item.id);
        syncedCount++;
      } catch (err) {
        console.error('Failed to sync offline item:', err);
        updatePendingOfflineUpload(item.id, { status: 'failed', error: String(err) });
      }
    }

    setPendingOfflineUploads(getPendingOfflineUploads());
    setCachedOfflineFileIds(getCachedOfflineFileIds());
    setIsSyncingOfflineQueue(false);

    if (syncedCount > 0) {
      showToast({
        type: 'success',
        title: 'Offline Uploads Synced',
        message: `Successfully synchronized ${syncedCount} file(s) to Drive.`
      });
    }

    return syncedCount;
  }, [currentUser, isSyncingOfflineQueue, showToast]);

  const cancelPendingOfflineUpload = useCallback(async (id: string) => {
    await cancelOfflineUpload(id);
    setPendingOfflineUploads(getPendingOfflineUploads());
    showToast({
      type: 'info',
      title: 'Upload Cancelled',
      message: 'Pending offline upload removed from queue.'
    });
  }, [showToast]);

  const retryPendingOfflineUpload = useCallback(async (id: string) => {
    updatePendingOfflineUpload(id, { status: 'queued', error: undefined, progress: 0 });
    setPendingOfflineUploads(getPendingOfflineUploads());
    if (isOnlineState) {
      syncPendingUploads();
    } else {
      showToast({
        type: 'info',
        title: 'Queued for Sync',
        message: 'Will sync when connection returns.'
      });
    }
  }, [isOnlineState, syncPendingUploads, showToast]);

  const cacheFileForOfflineMode = useCallback(async (fileId: string): Promise<boolean> => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return false;
    const ok = await cacheFileForOffline(file);
    if (ok) {
      setCachedOfflineFileIds(getCachedOfflineFileIds());
      showToast({
        type: 'success',
        title: 'Available Offline',
        message: `"${file.name}" is now cached for offline access.`
      });
    } else {
      showToast({
        type: 'error',
        title: 'Offline Caching Failed',
        message: 'Could not store file content in local offline cache.'
      });
    }
    return ok;
  }, [allFiles, showToast]);

  const removeFileFromOfflineMode = useCallback(async (fileId: string) => {
    await removeFileFromOffline(fileId);
    setCachedOfflineFileIds(getCachedOfflineFileIds());
    showToast({
      type: 'info',
      title: 'Removed from Offline Cache',
      message: 'File removed from offline storage.'
    });
  }, [showToast]);

  const isFileCachedOffline = useCallback((fileId: string): boolean => {
    return cachedOfflineFileIds.includes(fileId);
  }, [cachedOfflineFileIds]);

  const markFileAsViewedAndCache = useCallback(async (file: FileItem) => {
    try {
      recordFileViewed(file.id);
      await cacheFileForOffline(file);
      setCachedOfflineFileIds(getCachedOfflineFileIds());
    } catch (e) {
      console.warn('Failed to cache file on view:', e);
    }
  }, []);

  const clearOfflineCache = useCallback(async () => {
    const ids = getCachedOfflineFileIds();
    for (const id of ids) {
      await removeFileFromOffline(id);
    }
    setCachedOfflineFileIds([]);
    showToast({
      type: 'info',
      title: 'Offline Cache Cleared',
      message: 'All cached offline files have been cleared.'
    });
  }, [showToast]);

  const toggleSimulatedOffline = useCallback(() => {
    const next = !isSimulatedOfflineMode;
    setIsSimulatedOfflineMode(next);
    setSimulatedOffline(next);
    setIsOnlineState(!next && (typeof navigator !== 'undefined' ? navigator.onLine : true));
    if (next) {
      showToast({
        type: 'warning',
        title: 'Simulated Offline Mode Enabled',
        message: 'Testing offline capabilities and pending upload queue.'
      });
    } else {
      showToast({
        type: 'success',
        title: 'Simulated Offline Mode Disabled',
        message: 'Back online. Syncing pending offline uploads...'
      });
      syncPendingUploads();
    }
  }, [isSimulatedOfflineMode, showToast, syncPendingUploads]);

  // Service Worker and background sync listener
  useEffect(() => {
    initServiceWorker(() => {
      syncPendingUploads();
    });
  }, [syncPendingUploads]);

  // Network connection events
  useEffect(() => {
    const handleOnline = () => {
      const online = isAppOnline();
      setIsOnlineState(online);
      if (online) {
        showToast({
          type: 'info',
          title: 'Connection Restored',
          message: 'Back online. Synchronizing any queued uploads...'
        });
        syncPendingUploads();
      }
    };

    const handleOffline = () => {
      setIsOnlineState(false);
      showToast({
        type: 'warning',
        title: 'Offline Mode Active',
        message: 'You can still access metadata and recently viewed files offline.'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingUploads, showToast]);

  // Upload handler with offline queueing & quota enforcement
  const uploadFiles = async (filesToUpload: File[], targetFolderId?: string | null): Promise<boolean> => {
    if (!currentUser) return false;

    const folderDest = targetFolderId !== undefined ? targetFolderId : currentFolderId;

    // If offline, save into persistent offline upload queue
    if (!isOnlineState) {
      for (const file of filesToUpload) {
        await queueOfflineUpload(file, folderDest);
      }
      setPendingOfflineUploads(getPendingOfflineUploads());
      showToast({
        type: 'info',
        title: 'Queued for Offline Sync',
        message: `${filesToUpload.length} file(s) saved to offline queue. Will automatically upload once connection returns.`
      });
      return true;
    }

    // Check quota for all files combined
    const totalNewBytes = filesToUpload.reduce((acc, f) => acc + f.size, 0);
    if (storageUsedBytes + totalNewBytes > storageQuotaBytes) {
      const neededMB = (totalNewBytes / (1024 * 1024)).toFixed(1);
      const remainingMB = Math.max(0, (storageQuotaBytes - storageUsedBytes) / (1024 * 1024)).toFixed(1);
      showToast({
        type: 'error',
        title: 'Storage Limit Exceeded',
        message: `Upload of ${filesToUpload.length} file(s) requires ${neededMB} MB, but only ${remainingMB} MB remaining.`
      });
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'SYSTEM_ALERT',
        description: `Storage limit rejection: upload of ${filesToUpload.length} files (${neededMB} MB) exceeded remaining capacity (${remainingMB} MB)`,
        ipAddress: '127.0.0.1',
        severity: 'warning'
      });
      return false;
    }

    // Initialize items in queue
    const queueItems: UploadQueueItem[] = filesToUpload.map(f => ({
      id: 'up_' + Math.random().toString(36).substring(2, 9),
      file: f,
      targetFolderId: folderDest,
      progress: 0,
      status: 'pending',
    }));

    setUploadQueue(prev => [...prev, ...queueItems]);

    // Pre-calculate non-colliding names for the batch to prevent naming collisions
    const existingFileNames = new Set(
      getFiles()
        .filter(f => !f.isDeleted && f.folderId === folderDest)
        .map(f => f.name.toLowerCase())
    );

    const plannedFiles: { queueItem: UploadQueueItem; finalName: string }[] = [];
    for (const q of queueItems) {
      let desiredName = q.file.name;
      let count = 1;
      while (existingFileNames.has(desiredName.toLowerCase())) {
        const parts = q.file.name.split('.');
        if (parts.length > 1) {
          const extPart = parts.pop();
          desiredName = `${parts.join('.')}_(${count}).${extPart}`;
        } else {
          desiredName = `${q.file.name}_(${count})`;
        }
        count++;
      }
      existingFileNames.add(desiredName.toLowerCase());
      plannedFiles.push({ queueItem: q, finalName: desiredName });
    }

    // Process all files simultaneously in parallel
    const uploadTasks = plannedFiles.map(async ({ queueItem, finalName }) => {
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'uploading', progress: 20 } : q));

      try {
        const file = queueItem.file;

        // Simultaneous progress simulation
        await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, progress: 60 } : q));

        const blobId = 'blob_' + Math.random().toString(36).substring(2, 11);
        await storeBlob(blobId, file);

        const checksum = await computeSHA256(file);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const cat = detectCategory(file.name, file.type);

        // Read text content if applicable for quick viewing
        let textContent: string | undefined;
        if (cat === 'document' || cat === 'code' || file.type.startsWith('text/') || ext === 'md' || ext === 'csv' || ext === 'json') {
          try {
            textContent = await file.text();
          } catch {
            // ignore binary text read failure
          }
        }

        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, progress: 95 } : q));

        const newFileItem: FileItem = {
          id: 'file_' + Math.random().toString(36).substring(2, 10),
          name: finalName,
          extension: ext,
          mimeType: file.type || 'application/octet-stream',
          category: cat,
          sizeBytes: file.size,
          folderId: folderDest,
          ownerId: currentUser.id,
          blobId: blobId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
          isStarred: false,
          checksum: checksum,
          sharedWith: [],
          publicLink: null,
          versions: [
            {
              versionId: 'v1_' + Math.random().toString(36).substring(2, 9),
              versionNumber: 1,
              uploadedAt: new Date().toISOString(),
              uploadedBy: currentUser.name,
              sizeBytes: file.size,
              blobId: blobId,
              comment: 'Initial upload',
              checksum: checksum,
            }
          ],
          textContent: textContent,
        };

        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, progress: 100, status: 'completed' } : q));

        addAuditLog({
          userId: currentUser.id,
          userEmail: currentUser.email,
          eventType: 'FILE_UPLOAD',
          description: `Uploaded file "${newFileItem.name}" (${(newFileItem.sizeBytes / 1024).toFixed(1)} KB)`,
          ipAddress: '127.0.0.1',
          severity: 'info',
        });

        return newFileItem;
      } catch (err) {
        console.error('File upload error:', err);
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { 
          ...q, 
          status: 'error', 
          errorMessage: 'Upload failed due to storage write error.' 
        } : q));
        return null;
      }
    });

    const results = await Promise.all(uploadTasks);
    const successfullyCreated = results.filter((item): item is FileItem => item !== null);

    if (successfullyCreated.length > 0) {
      const currentFiles = getFiles();
      const updated = [...currentFiles, ...successfullyCreated];
      saveFiles(updated);
      setAllFiles(updated);
    }

    return true;
  };

  const clearCompletedUploads = () => {
    setUploadQueue(prev => prev.filter(q => q.status !== 'completed'));
  };

  // Download file retaining original content and filename (US-05)
  const downloadFile = async (fileId: string) => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;

    try {
      const blob = await getBlob(file.blobId);
      if (!blob) {
        showToast({
          type: 'error',
          title: 'File Content Unavailable',
          message: isOnlineState 
            ? 'File content could not be retrieved from local storage.' 
            : 'This file has not been cached for offline viewing.'
        });
        return;
      }

      // Automatically cache for offline access when downloaded
      markFileAsViewedAndCache(file);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (currentUser) {
        addAuditLog({
          userId: currentUser.id,
          userEmail: currentUser.email,
          eventType: 'FILE_DOWNLOAD',
          description: `Downloaded file "${file.name}"`,
          ipAddress: '127.0.0.1',
          severity: 'info'
        });
      }
    } catch (err) {
      console.error('Download failed', err);
      showToast({
        type: 'error',
        title: 'Download Failed',
        message: 'Could not complete file download.'
      });
    }
  };

  // Rename file with validation & conflict prevention (US-07)
  const renameFile = async (fileId: string, newName: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, error: 'Filename cannot be empty.' };
    }
    // Disallow invalid characters
    if (/[\/\\:*?"<>|]/.test(trimmed)) {
      return { success: false, error: 'Filename contains invalid characters (\\ / : * ? " < > |).' };
    }

    const file = allFiles.find(f => f.id === fileId);
    if (!file) return { success: false, error: 'File not found.' };

    // Check for naming conflict in same folder
    const conflict = allFiles.some(f => 
      !f.isDeleted && 
      f.id !== fileId && 
      f.folderId === file.folderId && 
      f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (conflict) {
      return { success: false, error: 'A file with this name already exists in this folder.' };
    }

    const ext = trimmed.split('.').pop()?.toLowerCase() || file.extension;
    const cat = detectCategory(trimmed, file.mimeType);

    const updated = allFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          name: trimmed,
          extension: ext,
          category: cat,
          updatedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    saveFiles(updated);
    setAllFiles(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_RENAME',
        description: `Renamed file "${file.name}" to "${trimmed}"`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true };
  };

  // Move file to recycle bin (US-08)
  const deleteFile = (fileId: string) => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;

    const updated = allFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
          originalFolderId: f.folderId,
          folderId: null, // detached while in trash
        };
      }
      return f;
    });

    saveFiles(updated);
    setAllFiles(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_DELETE',
        description: `Moved file "${file.name}" to Recycle Bin`,
        ipAddress: '127.0.0.1',
        severity: 'warning'
      });
    }
  };

  // Restore file from recycle bin (US-21)
  const restoreFile = (fileId: string): { success: boolean; message: string } => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return { success: false, message: 'File not found' };

    let targetFolderId = file.originalFolderId || null;
    let message = `File "${file.name}" restored to its original location.`;

    // Check if original parent folder exists and is not deleted
    if (targetFolderId) {
      const parentFolder = allFolders.find(f => f.id === targetFolderId && !f.isDeleted);
      if (!parentFolder) {
        targetFolderId = null;
        message = `Original folder was removed. Restored "${file.name}" to the root of My Drive.`;
      }
    }

    const updated = allFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          isDeleted: false,
          deletedAt: undefined,
          folderId: targetFolderId,
          updatedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    saveFiles(updated);
    setAllFiles(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_RESTORE',
        description: `Restored file "${file.name}" from Recycle Bin`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true, message };
  };

  // Permanently delete file
  const permanentlyDeleteFile = async (fileId: string) => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;

    await deleteBlob(file.blobId);
    // Also delete version blobs
    for (const v of file.versions) {
      if (v.blobId !== file.blobId) {
        await deleteBlob(v.blobId);
      }
    }

    const updated = allFiles.filter(f => f.id !== fileId);
    saveFiles(updated);
    setAllFiles(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_PERMANENT_DELETE',
        description: `Permanently purged file "${file.name}" (${(file.sizeBytes / 1024).toFixed(1)} KB freed)`,
        ipAddress: '127.0.0.1',
        severity: 'security'
      });
    }
  };

  // Move files & folders with cycle prevention (US-11)
  const moveItem = async (itemId: string, itemType: 'file' | 'folder', destinationFolderId: string | null): Promise<{ success: boolean; error?: string }> => {
    if (itemType === 'file') {
      const file = allFiles.find(f => f.id === itemId);
      if (!file) return { success: false, error: 'File not found.' };

      // Prevent name conflict in destination
      const conflict = allFiles.some(f => 
        !f.isDeleted && 
        f.id !== itemId && 
        f.folderId === destinationFolderId && 
        f.name.toLowerCase() === file.name.toLowerCase()
      );
      if (conflict) {
        return { success: false, error: 'A file with this name already exists in the destination folder.' };
      }

      const updated = allFiles.map(f => f.id === itemId ? { ...f, folderId: destinationFolderId, updatedAt: new Date().toISOString() } : f);
      saveFiles(updated);
      setAllFiles(updated);

      if (currentUser) {
        addAuditLog({
          userId: currentUser.id,
          userEmail: currentUser.email,
          eventType: 'FILE_MOVE',
          description: `Moved file "${file.name}" to folder ${destinationFolderId || 'root'}`,
          ipAddress: '127.0.0.1',
          severity: 'info'
        });
      }

      return { success: true };
    } else {
      const folder = allFolders.find(f => f.id === itemId);
      if (!folder) return { success: false, error: 'Folder not found.' };

      // Invalid operation: Cannot move folder into itself
      if (destinationFolderId === itemId) {
        return { success: false, error: 'Cannot move a folder into itself.' };
      }

      // Invalid operation: Cannot move folder into any of its subfolders
      if (destinationFolderId) {
        let curr: string | null = destinationFolderId;
        while (curr) {
          if (curr === itemId) {
            return { success: false, error: 'Cannot move a folder into one of its subfolders.' };
          }
          const parent = allFolders.find(f => f.id === curr);
          curr = parent ? parent.parentId : null;
        }
      }

      // Conflict prevention
      const conflict = allFolders.some(f => 
        !f.isDeleted && 
        f.id !== itemId && 
        f.parentId === destinationFolderId && 
        f.name.toLowerCase() === folder.name.toLowerCase()
      );
      if (conflict) {
        return { success: false, error: 'A folder with this name already exists in the destination.' };
      }

      const updated = allFolders.map(f => f.id === itemId ? { ...f, parentId: destinationFolderId, updatedAt: new Date().toISOString() } : f);
      saveFolders(updated);
      setAllFolders(updated);

      if (currentUser) {
        addAuditLog({
          userId: currentUser.id,
          userEmail: currentUser.email,
          eventType: 'FOLDER_MOVE',
          description: `Moved folder "${folder.name}" to ${destinationFolderId || 'root'}`,
          ipAddress: '127.0.0.1',
          severity: 'info'
        });
      }

      return { success: true };
    }
  };

  // Toggle favorite / starred
  const toggleStarFile = (fileId: string) => {
    const updated = allFiles.map(f => f.id === fileId ? { ...f, isStarred: !f.isStarred } : f);
    saveFiles(updated);
    setAllFiles(updated);
  };

  // File Sharing (US-18)
  const updateFileShare = (fileId: string, sharedWith: SharePermission[], publicLink: PublicShareLink | null) => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file || !currentUser) return;

    const updated = allFiles.map(f => f.id === fileId ? { ...f, sharedWith, publicLink } : f);
    saveFiles(updated);
    setAllFiles(updated);

    addAuditLog({
      userId: currentUser.id,
      userEmail: currentUser.email,
      eventType: 'FILE_SHARE',
      description: `Updated access permissions for file "${file.name}" (${sharedWith.length} users, link: ${publicLink ? 'active' : 'disabled'})`,
      ipAddress: '127.0.0.1',
      severity: 'info'
    });
  };

  // Folder Sharing (US-19)
  const updateFolderShare = (folderId: string, sharedWith: SharePermission[], publicLink: PublicShareLink | null) => {
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder || !currentUser) return;

    const updated = allFolders.map(f => f.id === folderId ? { ...f, sharedWith, publicLink } : f);
    saveFolders(updated);
    setAllFolders(updated);

    addAuditLog({
      userId: currentUser.id,
      userEmail: currentUser.email,
      eventType: 'FILE_SHARE',
      description: `Updated access permissions for folder "${folder.name}" (${sharedWith.length} users)`,
      ipAddress: '127.0.0.1',
      severity: 'info'
    });
  };

  // Save new version of a file (US-22)
  const saveFileNewVersion = async (fileId: string, newContentOrBlob: Blob | string, comment?: string): Promise<{ success: boolean; error?: string }> => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file || !currentUser) return { success: false, error: 'File not found.' };

    try {
      const blob = typeof newContentOrBlob === 'string' 
        ? new Blob([newContentOrBlob], { type: file.mimeType }) 
        : newContentOrBlob;

      const sizeDiff = blob.size - file.sizeBytes;
      if (storageUsedBytes + sizeDiff > storageQuotaBytes) {
        return { success: false, error: 'Updating file version would exceed remaining storage quota.' };
      }

      const versionBlobId = 'blob_' + Math.random().toString(36).substring(2, 10);
      await storeBlob(versionBlobId, blob);
      const checksum = await computeSHA256(blob);

      let textContent = file.textContent;
      if (typeof newContentOrBlob === 'string') {
        textContent = newContentOrBlob;
      } else if (file.category === 'document' || file.category === 'code') {
        try { textContent = await blob.text(); } catch {}
      }

      const newVersionNumber = (file.versions?.length || 0) + 1;
      const newVersion: FileVersion = {
        versionId: 'v' + newVersionNumber + '_' + Math.random().toString(36).substring(2, 7),
        versionNumber: newVersionNumber,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.name,
        sizeBytes: blob.size,
        blobId: versionBlobId,
        comment: comment || `Revision ${newVersionNumber}`,
        checksum: checksum,
      };

      const updated = allFiles.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            sizeBytes: blob.size,
            blobId: versionBlobId,
            checksum: checksum,
            updatedAt: new Date().toISOString(),
            textContent: textContent,
            versions: [...(f.versions || []), newVersion]
          };
        }
        return f;
      });

      saveFiles(updated);
      setAllFiles(updated);

      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_UPLOAD',
        description: `Created revision v${newVersionNumber} for "${file.name}"`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to save version', err);
      return { success: false, error: 'Failed to save new file version.' };
    }
  };

  // Revert file to previous version (US-22)
  const revertToVersion = async (fileId: string, versionId: string): Promise<{ success: boolean; error?: string }> => {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return { success: false, error: 'File not found.' };

    const version = file.versions.find(v => v.versionId === versionId);
    if (!version) return { success: false, error: 'Version not found.' };

    // Get blob content for text cache if needed
    const blob = await getBlob(version.blobId);
    let textContent = file.textContent;
    if (blob && (file.category === 'document' || file.category === 'code')) {
      try { textContent = await blob.text(); } catch {}
    }

    const updated = allFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          blobId: version.blobId,
          sizeBytes: version.sizeBytes,
          checksum: version.checksum || f.checksum,
          textContent: textContent,
          updatedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    saveFiles(updated);
    setAllFiles(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_RESTORE',
        description: `Restored "${file.name}" to version v${version.versionNumber}`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true };
  };

  // Create Folder (US-09)
  const createFolder = (name: string, parentId?: string | null, color = '#3b82f6'): { success: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Folder name cannot be empty.' };
    }
    if (/[\/\\:*?"<>|]/.test(trimmed)) {
      return { success: false, error: 'Folder name contains invalid characters.' };
    }

    const dest = parentId !== undefined ? parentId : currentFolderId;

    // Duplicate check
    const conflict = allFolders.some(f => 
      !f.isDeleted && 
      f.parentId === dest && 
      f.ownerId === currentUser?.id && 
      f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (conflict) {
      return { success: false, error: 'A folder with this name already exists in this location.' };
    }

    const newFolder: FolderItem = {
      id: 'fld_' + Math.random().toString(36).substring(2, 9),
      name: trimmed,
      parentId: dest,
      ownerId: currentUser?.id || 'usr_admin_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      color: color,
      sharedWith: [],
      publicLink: null,
    };

    const updated = [...allFolders, newFolder];
    saveFolders(updated);
    setAllFolders(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FOLDER_CREATE',
        description: `Created folder "${trimmed}"`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true };
  };

  // Rename Folder (US-12)
  const renameFolder = (folderId: string, newName: string): { success: boolean; error?: string } => {
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, error: 'Folder name cannot be empty.' };
    if (/[\/\\:*?"<>|]/.test(trimmed)) return { success: false, error: 'Folder name contains invalid characters.' };

    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return { success: false, error: 'Folder not found.' };

    const conflict = allFolders.some(f => 
      !f.isDeleted && 
      f.id !== folderId && 
      f.parentId === folder.parentId && 
      f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (conflict) {
      return { success: false, error: 'A folder with this name already exists.' };
    }

    const updated = allFolders.map(f => f.id === folderId ? { ...f, name: trimmed, updatedAt: new Date().toISOString() } : f);
    saveFolders(updated);
    setAllFolders(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FOLDER_RENAME',
        description: `Renamed folder "${folder.name}" to "${trimmed}"`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true };
  };

  // Delete Folder (soft-delete to trash with contents) (US-12)
  const deleteFolder = (folderId: string) => {
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return;

    // Collect all descendant folder IDs
    const toDeleteFolderIds = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      allFolders.forEach(f => {
        if (f.parentId && toDeleteFolderIds.has(f.parentId) && !toDeleteFolderIds.has(f.id)) {
          toDeleteFolderIds.add(f.id);
          added = true;
        }
      });
    }

    const now = new Date().toISOString();

    const updatedFolders = allFolders.map(f => {
      if (toDeleteFolderIds.has(f.id)) {
        return { ...f, isDeleted: true, deletedAt: now };
      }
      return f;
    });

    const updatedFiles = allFiles.map(f => {
      if (f.folderId && toDeleteFolderIds.has(f.folderId)) {
        return {
          ...f,
          isDeleted: true,
          deletedAt: now,
          originalFolderId: f.folderId,
          folderId: null,
        };
      }
      return f;
    });

    saveFolders(updatedFolders);
    setAllFolders(updatedFolders);
    saveFiles(updatedFiles);
    setAllFiles(updatedFiles);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FOLDER_DELETE',
        description: `Moved folder "${folder.name}" and sub-items to Recycle Bin`,
        ipAddress: '127.0.0.1',
        severity: 'warning'
      });
    }
  };

  // Restore Folder
  const restoreFolder = (folderId: string): { success: boolean; message: string } => {
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return { success: false, message: 'Folder not found.' };

    const updated = allFolders.map(f => f.id === folderId ? { ...f, isDeleted: false, deletedAt: undefined } : f);
    saveFolders(updated);
    setAllFolders(updated);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FOLDER_CREATE',
        description: `Restored folder "${folder.name}" from Recycle Bin`,
        ipAddress: '127.0.0.1',
        severity: 'info'
      });
    }

    return { success: true, message: `Folder "${folder.name}" restored.` };
  };

  // Permanently delete folder
  const permanentlyDeleteFolder = async (folderId: string) => {
    const folder = allFolders.find(f => f.id === folderId);
    if (!folder) return;

    const updated = allFolders.filter(f => f.id !== folderId);
    saveFolders(updated);
    setAllFolders(updated);
  };

  // Empty Trash (US-21)
  const emptyTrash = async () => {
    const filesToDelete = trashFiles;
    for (const f of filesToDelete) {
      await deleteBlob(f.blobId);
    }
    const updatedFiles = allFiles.filter(f => !(f.ownerId === currentUser?.id && f.isDeleted));
    const updatedFolders = allFolders.filter(f => !(f.ownerId === currentUser?.id && f.isDeleted));

    saveFiles(updatedFiles);
    setAllFiles(updatedFiles);
    saveFolders(updatedFolders);
    setAllFolders(updatedFolders);

    if (currentUser) {
      addAuditLog({
        userId: currentUser.id,
        userEmail: currentUser.email,
        eventType: 'FILE_PERMANENT_DELETE',
        description: `Emptied Recycle Bin (${filesToDelete.length} files permanently erased)`,
        ipAddress: '127.0.0.1',
        severity: 'security'
      });
    }
  };

  // Get temporary blob URL for previewing
  const getFileContentUrl = async (blobId: string): Promise<string | null> => {
    const blob = await getBlob(blobId);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  };

  const getFileBlob = async (blobId: string): Promise<Blob | null> => {
    return await getBlob(blobId);
  };

  return (
    <DriveContext.Provider
      value={{
        activeTab,
        setActiveTab,
        currentFolderId,
        setCurrentFolderId,
        breadcrumbs,
        files: allFiles,
        folders: allFolders,
        currentFiles,
        currentFolders,
        trashFiles,
        trashFolders,
        selectedItemIds,
        setSelectedItemIds,
        toggleSelectItem,
        clearSelection,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery,
        sortField,
        setSortField,
        sortDirection,
        setSortDirection,
        categoryFilter,
        setCategoryFilter,
        storageUsedBytes,
        storageQuotaBytes,
        storagePercentage,
        isStorageNearlyFull,
        isStorageFull,
        storageByCategory,
        uploadQueue,
        uploadFiles,
        clearCompletedUploads,
        downloadFile,
        renameFile,
        deleteFile,
        restoreFile,
        permanentlyDeleteFile,
        moveItem,
        toggleStarFile,
        updateFileShare,
        updateFolderShare,
        saveFileNewVersion,
        revertToVersion,
        createFolder,
        renameFolder,
        deleteFolder,
        restoreFolder,
        permanentlyDeleteFolder,
        emptyTrash,
        getFileContentUrl,
        getFileBlob,
        refreshData,
        isOnline: isOnlineState,
        isSimulatedOffline: isSimulatedOfflineMode,
        toggleSimulatedOffline,
        isSyncingOfflineQueue,
        pendingOfflineUploads,
        syncPendingUploads,
        cancelPendingOfflineUpload,
        retryPendingOfflineUpload,
        cachedOfflineFileIds,
        cacheFileForOfflineMode,
        removeFileFromOfflineMode,
        isFileCachedOffline,
        clearOfflineCache,
        markFileAsViewedAndCache,
      }}
    >
      {children}
    </DriveContext.Provider>
  );
};

export const useDrive = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
};
