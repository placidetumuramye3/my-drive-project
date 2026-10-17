import { 
  FileItem, 
  FolderItem, 
  PendingOfflineUpload 
} from '../types/drive';
import { 
  storeBlob, 
  getBlob, 
  deleteBlob,
  getPendingOfflineUploads, 
  savePendingOfflineUploads, 
  addPendingOfflineUpload, 
  updatePendingOfflineUpload, 
  removePendingOfflineUpload,
  getCachedOfflineFileIds,
  addCachedOfflineFileId,
  removeCachedOfflineFileId,
  recordFileViewed,
  saveOfflineMetadataSnapshot,
  getOfflineMetadataSnapshot,
  detectCategory
} from './db';

const SIMULATED_OFFLINE_KEY = 'storage_drive_simulated_offline';

// Check if developer or user enabled simulated offline mode for testing
export function isSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSimulatedOffline(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(SIMULATED_OFFLINE_KEY, 'true');
    } else {
      localStorage.removeItem(SIMULATED_OFFLINE_KEY);
    }
    // Broadcast synthetic event
    window.dispatchEvent(new Event(val ? 'offline' : 'online'));
  } catch (e) {
    console.error('Failed to set simulated offline state', e);
  }
}

export function isAppOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (isSimulatedOffline()) return false;
  return navigator.onLine;
}

// ---------------------------------------------------------------------------
// Service Worker Registration & Communication
// ---------------------------------------------------------------------------

let swRegistration: ServiceWorkerRegistration | null = null;

export async function initServiceWorker(onBackgroundSync?: () => void): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('[SW] Service Worker registered with scope:', reg.scope);

    // Listen for background sync messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED' || event.data?.type === 'SYNC_PENDING_UPLOADS') {
        console.log('[SW] Background sync triggered by Service Worker');
        onBackgroundSync?.();
      }
    });

    // Request background sync tag if available
    if ('sync' in reg) {
      try {
        await (reg as any).sync.register('sync-storage-drive-uploads');
      } catch {
        // sync registration error (e.g. permission or unsecure context), ignore
      }
    }

    return reg;
  } catch (err) {
    console.warn('[SW] Service Worker registration failed (normal during some preview environments):', err);
    return null;
  }
}

export async function sendSWMessage<T = any>(type: string, payload?: any): Promise<T | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  const activeWorker = navigator.serviceWorker.controller || (swRegistration && swRegistration.active);
  if (!activeWorker) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      resolve(event.data as T);
    };
    activeWorker.postMessage({ type, payload }, [channel.port2]);

    // Timeout fallback after 3 seconds
    setTimeout(() => resolve(null), 3000);
  });
}

// ---------------------------------------------------------------------------
// File & Metadata Caching Helpers
// ---------------------------------------------------------------------------

/**
 * Ensures a file's binary content is cached in both IndexedDB blob store
 * and the Service Worker Cache for instant offline access.
 */
export async function cacheFileForOffline(fileItem: FileItem, existingBlob?: Blob): Promise<boolean> {
  try {
    let blob = existingBlob;
    if (!blob) {
      blob = await getBlob(fileItem.blobId);
    }

    if (!blob) {
      // If text content is present, construct a fallback blob
      if (fileItem.textContent) {
        blob = new Blob([fileItem.textContent], { type: fileItem.mimeType || 'text/plain' });
        await storeBlob(fileItem.blobId, blob);
      } else {
        console.warn('Cannot cache file offline: blob data not available', fileItem.id);
        return false;
      }
    } else {
      // Ensure it's stored in IndexedDB
      await storeBlob(fileItem.blobId, blob);
    }

    // Cache in Service Worker CacheStorage
    try {
      const arrayBuffer = await blob.arrayBuffer();
      await sendSWMessage('CACHE_FILE_DATA', {
        fileId: fileItem.id,
        mimeType: fileItem.mimeType,
        buffer: arrayBuffer,
        name: fileItem.name
      });
    } catch (swErr) {
      console.warn('[SW] Cache file in SW cache failed, using IndexedDB store only:', swErr);
    }

    // Record as cached and viewed
    addCachedOfflineFileId(fileItem.id);
    recordFileViewed(fileItem.id);
    return true;
  } catch (e) {
    console.error('Failed to cache file for offline:', e);
    return false;
  }
}

/**
 * Removes a file from offline caches
 */
export async function removeFileFromOffline(fileId: string): Promise<void> {
  try {
    removeCachedOfflineFileId(fileId);
    await sendSWMessage('REMOVE_CACHED_FILE', { fileId });
  } catch (e) {
    console.error('Failed to remove file from offline cache', e);
  }
}

/**
 * Snapshots the current files & folders metadata so that the drive structure
 * can be loaded seamlessly if the app is reloaded while offline.
 */
export function snapshotMetadataOffline(files: FileItem[], folders: FolderItem[]): void {
  try {
    const snapshot = {
      files,
      folders,
      timestamp: new Date().toISOString()
    };
    saveOfflineMetadataSnapshot(snapshot);

    // Also notify Service Worker
    sendSWMessage('CACHE_METADATA_SNAPSHOT', { snapshot }).catch(() => {});
  } catch (e) {
    console.error('Failed to snapshot offline metadata', e);
  }
}

// ---------------------------------------------------------------------------
// Offline Upload Queue Management
// ---------------------------------------------------------------------------

/**
 * Queues a file for upload while offline.
 * Stores binary data in IndexedDB immediately, and records metadata in pending queue.
 */
export async function queueOfflineUpload(
  file: File, 
  targetFolderId: string | null
): Promise<PendingOfflineUpload> {
  const blobId = 'offline_blob_' + Math.random().toString(36).substring(2, 10);
  
  // Store binary blob securely in IndexedDB so it survives page reloads
  await storeBlob(blobId, file);

  const pendingItem: PendingOfflineUpload = {
    id: 'pending_up_' + Math.random().toString(36).substring(2, 11),
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    category: detectCategory(file.name, file.type),
    targetFolderId,
    createdAt: new Date().toISOString(),
    status: 'queued',
    blobId,
    progress: 0
  };

  addPendingOfflineUpload(pendingItem);
  return pendingItem;
}

/**
 * Clears an offline upload item (and cleans up its blob if desired)
 */
export async function cancelOfflineUpload(id: string): Promise<void> {
  const items = getPendingOfflineUploads();
  const target = items.find(i => i.id === id);
  if (target) {
    await deleteBlob(target.blobId).catch(() => {});
  }
  removePendingOfflineUpload(id);
}

/**
 * Calculates current offline cache stats for the Offline Hub UI
 */
export async function getOfflineCacheStats(): Promise<{
  cachedFilesCount: number;
  cachedFilesSizeBytes: number;
  pendingUploadsCount: number;
  serviceWorkerActive: boolean;
}> {
  const cachedIds = getCachedOfflineFileIds();
  const pendingUploads = getPendingOfflineUploads();
  
  const swActive = !!(
    typeof navigator !== 'undefined' && 
    'serviceWorker' in navigator && 
    (navigator.serviceWorker.controller || swRegistration?.active)
  );

  return {
    cachedFilesCount: cachedIds.length,
    cachedFilesSizeBytes: 0, // Computed dynamically from files
    pendingUploadsCount: pendingUploads.length,
    serviceWorkerActive: swActive
  };
}
