import React from 'react';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  ArrowUpCircle, 
  Layers,
  Sparkles 
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';

interface OfflineBannerProps {
  onOpenOfflineHub: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenOfflineHub }) => {
  const { 
    isOnline, 
    isSimulatedOffline, 
    pendingOfflineUploads, 
    isSyncingOfflineQueue, 
    syncPendingUploads 
  } = useDrive();

  // If online and no pending uploads, don't show the banner
  if (isOnline && pendingOfflineUploads.length === 0) {
    return null;
  }

  return (
    <div className={`px-4 md:px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 border-b transition-colors ${
      !isOnline
        ? 'bg-amber-500/10 border-amber-200 text-amber-900'
        : 'bg-blue-50 border-blue-200 text-blue-900'
    }`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
          !isOnline ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          <span className="font-bold">
            {!isOnline ? 'Offline Mode Active:' : 'Pending Uploads:'}
          </span>
          <span className="text-slate-600">
            {!isOnline
              ? 'Serving metadata & recently viewed files from Service Worker cache.'
              : `${pendingOfflineUploads.length} offline upload(s) queued and ready to sync.`}
          </span>

          {pendingOfflineUploads.length > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full text-[11px]">
              <ArrowUpCircle className="w-3 h-3" />
              <span>{pendingOfflineUploads.length} pending sync</span>
            </span>
          )}

          {isSimulatedOffline && (
            <span className="inline-flex items-center gap-1 font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full text-[10px] uppercase">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Simulated Mode</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {pendingOfflineUploads.length > 0 && (
          <button
            onClick={() => syncPendingUploads()}
            disabled={isSyncingOfflineQueue}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingOfflineQueue ? 'animate-spin' : ''}`} />
            <span>{isSyncingOfflineQueue ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        <button
          onClick={onOpenOfflineHub}
          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
        >
          <Layers className="w-3 h-3 text-slate-500" />
          <span>Offline Hub</span>
        </button>
      </div>
    </div>
  );
};
