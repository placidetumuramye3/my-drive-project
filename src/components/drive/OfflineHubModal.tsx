import React, { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Trash2, 
  CloudOff, 
  Eye, 
  ArrowUpCircle, 
  Check, 
  ToggleLeft, 
  ToggleRight,
  Database,
  Layers,
  FileText,
  Clock
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { formatBytes } from '../../services/db';

interface OfflineHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFilePreview?: (fileId: string) => void;
}

export const OfflineHubModal: React.FC<OfflineHubModalProps> = ({
  isOpen,
  onClose,
  onOpenFilePreview
}) => {
  const { 
    isOnline, 
    isSimulatedOffline, 
    toggleSimulatedOffline,
    pendingOfflineUploads, 
    isSyncingOfflineQueue, 
    syncPendingUploads,
    cancelPendingOfflineUpload,
    retryPendingOfflineUpload,
    cachedOfflineFileIds,
    files,
    removeFileFromOfflineMode,
    clearOfflineCache
  } = useDrive();

  const [activeTab, setActiveTab] = useState<'queue' | 'cached' | 'settings'>('queue');

  if (!isOpen) return null;

  const cachedFiles = files.filter(f => cachedOfflineFileIds.includes(f.id));
  const cachedTotalBytes = cachedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200' 
                : 'bg-amber-500/10 text-amber-600 border border-amber-200'
            }`}>
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Offline Hub & Service Worker
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isOnline 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {isOnline ? 'Online' : 'Offline Mode'}
                </span>
                {isSimulatedOffline && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-700">
                    Simulated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Service worker caching, offline file storage & background upload synchronization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Tabs */}
        <div className="px-6 pt-3 border-b border-slate-100 flex items-center gap-4 bg-white">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Pending Uploads Queue</span>
            {pendingOfflineUploads.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                {pendingOfflineUploads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cached')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'cached'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Offline Cached Files</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {cachedFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Service Worker & Diagnostics</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">

          {/* TAB 1: PENDING UPLOADS QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Offline Upload Queue ({pendingOfflineUploads.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Files stored in local persistent queue. They sync automatically when network connectivity is restored.
                  </p>
                </div>

                {pendingOfflineUploads.length > 0 && (
                  <button
                    onClick={() => syncPendingUploads()}
                    disabled={isSyncingOfflineQueue}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOfflineQueue ? 'animate-spin' : ''}`} />
                    <span>{isSyncingOfflineQueue ? 'Syncing...' : 'Sync Now'}</span>
                  </button>
                )}
              </div>

              {pendingOfflineUploads.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">Queue is Clear</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    All file uploads are currently up to date. Any files uploaded while disconnected will be safely queued here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {pendingOfflineUploads.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatBytes(item.sizeBytes)}</span>
                            <span>•</span>
                            <span>Queued {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span className={`capitalize font-semibold ${
                              item.status === 'syncing' ? 'text-blue-600' :
                              item.status === 'failed' ? 'text-red-500' : 'text-amber-600'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryPendingOfflineUpload(item.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Retry Upload"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => cancelPendingOfflineUpload(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Cancel and remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CACHED OFFLINE FILES */}
          {activeTab === 'cached' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Cached for Offline Access ({cachedFiles.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Recently viewed files and pinned items are stored in Service Worker cache ({formatBytes(cachedTotalBytes)} total).
                  </p>
                </div>

                {cachedFiles.length > 0 && (
                  <button
                    onClick={() => clearOfflineCache()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cache</span>
                  </button>
                )}
              </div>

              {cachedFiles.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <CloudOff className="w-6 h-6" />
                  </div>
                  <h5 className="font-semibold text-slate-800 text-sm mb-1">No Files Cached Yet</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Files you view, preview, or mark as available offline will be cached here for fast offline reading.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-80 overflow-y-auto">
                  {cachedFiles.map((file) => (
                    <div key={file.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatBytes(file.sizeBytes)}</span>
                            <span>•</span>
                            <span className="capitalize">{file.category}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">Ready offline</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenFilePreview && (
                          <button
                            onClick={() => {
                              onOpenFilePreview(file.id);
                              onClose();
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Preview</span>
                          </button>
                        )}
                        <button
                          onClick={() => removeFileFromOfflineMode(file.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove from offline cache"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & SIMULATION */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">
                      Simulate Offline Mode (Testing)
                    </h5>
                    <p className="text-xs text-slate-500">
                      Toggle offline mode to test metadata browsing, offline upload queuing, and reconnection synchronization without disconnecting your network.
                    </p>
                  </div>
                  <button
                    onClick={toggleSimulatedOffline}
                    className="cursor-pointer text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    {isSimulatedOffline ? (
                      <ToggleRight className="w-8 h-8 text-purple-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Service Worker Architecture Info */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Service Worker Architecture
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Service Worker Script</span>
                    <span className="font-mono text-slate-700 font-semibold">/sw.js</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Registration Scope</span>
                    <span className="font-mono text-slate-700 font-semibold">/</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Static Cache</span>
                    <span className="font-mono text-slate-700 font-semibold">storage-drive-static-v1.1.0</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Files Cache</span>
                    <span className="font-mono text-slate-700 font-semibold">storage-drive-files-v1.1.0</span>
                  </div>
                </div>
              </div>

              {/* Offline Capabilities Overview */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Offline Features Enabled
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800/90 pl-1 text-[11px]">
                  <li>Metadata snapshot allows browsing folder hierarchy and file details offline.</li>
                  <li>Recently viewed files automatically cached in Service Worker and IndexedDB.</li>
                  <li>Offline upload queue safely retains binary blobs across page reloads.</li>
                  <li>Automatic background sync triggers when connection is restored.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>Network: {isOnline ? 'Online (Connected)' : 'Offline (Cached Mode)'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
