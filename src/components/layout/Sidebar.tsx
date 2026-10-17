import React from 'react';
import { 
  Folder, 
  Users, 
  Clock, 
  Star, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  Cloud, 
  Upload, 
  FolderPlus, 
  ChevronRight, 
  Sparkles,
  HardDrive
} from 'lucide-react';
import { useDrive, NavTab } from '../../context/DriveContext';
import { useAuth } from '../../context/AuthContext';
import { formatBytes } from '../../services/db';

interface SidebarProps {
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenUpload,
  onOpenNewFolder,
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    trashFiles, 
    trashFolders, 
    storageUsedBytes, 
    storageQuotaBytes, 
    storagePercentage,
    isStorageNearlyFull,
    isStorageFull,
    folders,
    currentFolderId,
    setCurrentFolderId
  } = useDrive();
  const { currentUser } = useAuth();

  const totalTrashCount = trashFiles.length + trashFolders.length;

  const rootFolders = folders.filter(f => !f.isDeleted && f.parentId === null && f.ownerId === currentUser?.id);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'my-drive', label: 'My Drive', icon: <Folder className="w-4 h-4 text-blue-500" /> },
    { id: 'shared', label: 'Shared with me', icon: <Users className="w-4 h-4 text-emerald-500" /> },
    { id: 'recent', label: 'Recent', icon: <Clock className="w-4 h-4 text-amber-500" /> },
    { id: 'starred', label: 'Starred', icon: <Star className="w-4 h-4 text-yellow-500" /> },
    { id: 'trash', label: 'Recycle Bin', icon: <Trash2 className="w-4 h-4 text-rose-500" />, badge: totalTrashCount },
    { id: 'audit', label: 'Security Audit Logs', icon: <ShieldAlert className="w-4 h-4 text-indigo-500" /> },
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({
      id: 'admin',
      label: 'System Administration',
      icon: <ShieldCheck className="w-4 h-4 text-purple-600" />
    });
  }

  return (
    <aside className="w-64 bg-slate-50/70 border-r border-slate-200 flex flex-col justify-between p-4 select-none shrink-0 overflow-y-auto">
      <div>
        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={onOpenUpload}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-100/90 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer hover:border-slate-300"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Upload</span>
          </button>
          <button
            onClick={onOpenNewFolder}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-100/90 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer hover:border-slate-300"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Folder</span>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1 mb-6">
          <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Storage Views
          </p>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Folder Directory Tree */}
        {activeTab === 'my-drive' && rootFolders.length > 0 && (
          <div className="mb-6 pt-3 border-t border-slate-200">
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Quick Folders</span>
              <span className="text-[10px] text-slate-400 font-normal">Root</span>
            </p>
            <div className="space-y-0.5">
              {rootFolders.map((folder) => {
                const isSelected = currentFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-100/70 text-blue-900 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder 
                        className="w-3.5 h-3.5 shrink-0" 
                        style={{ color: folder.color || '#3b82f6' }} 
                      />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Storage Usage Card (US-16 & US-17) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cloud className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Storage Usage</span>
          </div>
          <span className="text-[11px] font-bold text-slate-600">
            {storagePercentage.toFixed(1)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-300 ${
              isStorageFull 
                ? 'bg-red-500' 
                : isStorageNearlyFull 
                ? 'bg-amber-500' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}
            style={{ width: `${Math.min(100, storagePercentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
          <span>{formatBytes(storageUsedBytes)} used</span>
          <span>{formatBytes(storageQuotaBytes)} limit</span>
        </div>

        {isStorageNearlyFull && (
          <div className="mb-2.5 p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>Storage is nearly full! Please clean up unnecessary files or ask admin for quota increase.</span>
          </div>
        )}

        {isStorageFull && (
          <div className="mb-2.5 p-2 bg-red-50 rounded-lg border border-red-200 text-[11px] text-red-800 flex items-start gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
            <span>Capacity exceeded. Further uploads will be rejected.</span>
          </div>
        )}

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition-colors text-center cursor-pointer"
          >
            Manage User Quotas
          </button>
        )}
      </div>
    </aside>
  );
};
