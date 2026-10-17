import React, { useState } from 'react';
import { 
  Search, 
  HardDrive, 
  Plus, 
  Upload, 
  FolderPlus, 
  AlertTriangle, 
  User as UserIcon, 
  LogOut, 
  Shield, 
  Users, 
  KeyRound, 
  CheckCircle2, 
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDrive } from '../../context/DriveContext';
import { formatBytes } from '../../services/db';

interface NavbarProps {
  onOpenUpload: () => void;
  onOpenNewFolder: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenUpload,
  onOpenNewFolder,
  onOpenAuth,
}) => {
  const { currentUser, users, logout, switchUser } = useAuth();
  const { 
    searchQuery, 
    setSearchQuery, 
    storageUsedBytes, 
    storageQuotaBytes, 
    storagePercentage, 
    isStorageNearlyFull, 
    isStorageFull,
    setActiveTab
  } = useDrive();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <HardDrive className="w-5 h-5" />
        </div>
        <div className="hidden sm:block">
          <h1 className="font-semibold text-slate-900 text-base leading-tight tracking-tight flex items-center gap-2">
            Storage Drive
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
              Enterprise
            </span>
          </h1>
          <p className="text-xs text-slate-500">Secure Cloud Data Platform</p>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xl mx-4 lg:mx-8">
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search files, folders, or document formats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl outline-none transition-all focus:ring-4 focus:ring-blue-100 text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold px-1 rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Add Menu */}
        <div className="relative">
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl shadow-sm shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Item</span>
          </button>

          {showQuickAdd && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowQuickAdd(false)} 
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowQuickAdd(false);
                    onOpenUpload();
                  }}
                  className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>Upload Files</span>
                </button>
                <button
                  onClick={() => {
                    setShowQuickAdd(false);
                    onOpenNewFolder();
                  }}
                  className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-emerald-600" />
                  <span>New Folder</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Storage Alert Indicator if near full */}
        {isStorageNearlyFull && (
          <div 
            title={`Storage is ${storagePercentage.toFixed(0)}% full`}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium cursor-pointer"
            onClick={() => setActiveTab('admin')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>{storagePercentage.toFixed(0)}% used</span>
          </div>
        )}

        {isStorageFull && (
          <div 
            title="Storage capacity reached! Uploads blocked."
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer"
            onClick={() => setActiveTab('admin')}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span>Quota Exceeded</span>
          </div>
        )}

        {/* Quick Demo Account Switcher Button */}
        <div className="relative">
          <button
            onClick={() => setShowSwitchMenu(!showSwitchMenu)}
            title="Switch User Account (Admin / Team / User)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Switch User</span>
          </button>

          {showSwitchMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSwitchMenu(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-20">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Select User Account (Demo)
                </div>
                <div className="space-y-1">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowSwitchMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        currentUser?.id === u.id ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: u.avatarColor || '#3b82f6' }}
                        >
                          {u.name[0]}
                        </div>
                        <div>
                          <p className="font-semibold">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Current User Profile Pill */}
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 pl-2 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <div className="text-right hidden xl:block pr-1">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400">{currentUser.role === 'admin' ? 'Administrator' : 'Standard Member'}</p>
              </div>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner"
                style={{ backgroundColor: currentUser.avatarColor || '#4f46e5' }}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-20">
                  <div className="border-b border-slate-100 pb-3 mb-2">
                    <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 break-all">{currentUser.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                        {currentUser.role}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {currentUser.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="px-2 py-1.5 text-slate-500 bg-slate-50 rounded-lg">
                      <div className="flex justify-between font-medium mb-1">
                        <span>Storage Allocation</span>
                        <span className="font-semibold text-slate-700">
                          {formatBytes(storageUsedBytes)} / {formatBytes(storageQuotaBytes)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            isStorageFull ? 'bg-red-500' : isStorageNearlyFull ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, storagePercentage)}%` }}
                        />
                      </div>
                    </div>

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setActiveTab('admin');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>System Administration</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setActiveTab('audit');
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Security Audit Logs</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAuth();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Account Management</span>
                    </button>

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <UserIcon className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
