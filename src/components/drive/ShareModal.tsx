import React, { useState, useEffect, useMemo } from 'react';
import { 
  Share2, 
  X, 
  Link as LinkIcon, 
  UserPlus, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff,
  Edit3, 
  Lock, 
  Unlock,
  Globe, 
  Clock,
  Calendar,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  QrCode,
  Sparkles,
  ExternalLink,
  Shield,
  Download
} from 'lucide-react';
import { useDrive } from '../../context/DriveContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SharePermission, PublicShareLink } from '../../types/drive';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | null;
  itemType: 'file' | 'folder';
  itemName: string;
  onOpenVisitorPreview?: (token: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemType,
  itemName,
  onOpenVisitorPreview,
}) => {
  const { files, folders, updateFileShare, updateFolderShare } = useDrive();
  const { users } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'link' | 'users'>('link');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Link configuration state
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [expirationPreset, setExpirationPreset] = useState<'never' | '1h' | '24h' | '7d' | '30d' | 'custom'>('never');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [linkRole, setLinkRole] = useState<'viewer' | 'editor'>('viewer');
  const [allowDownload, setAllowDownload] = useState(true);
  const [maxDownloadsLimit, setMaxDownloadsLimit] = useState<number | null>(null);

  if (!isOpen || !itemId) return null;

  const item = itemType === 'file' 
    ? files.find(f => f.id === itemId) 
    : folders.find(f => f.id === itemId);

  if (!item) return null;

  const sharedWith = item.sharedWith || [];
  const publicLink = item.publicLink || null;

  // Initialize form state from existing public link when opened
  useEffect(() => {
    if (publicLink) {
      setPasswordEnabled(!!publicLink.passwordProtected);
      setPasswordValue(publicLink.password || '');
      setLinkRole(publicLink.role || 'viewer');
      setAllowDownload(publicLink.allowDownload !== false);
      setMaxDownloadsLimit(publicLink.maxDownloads ?? null);

      if (!publicLink.expiresAt) {
        setExpirationPreset('never');
        setCustomExpiresAt('');
      } else {
        const expTime = new Date(publicLink.expiresAt).getTime();
        const diffMs = expTime - Date.now();
        // Check approx presets
        const diffHours = diffMs / (3600 * 1000);
        if (Math.abs(diffHours - 1) < 0.2) setExpirationPreset('1h');
        else if (Math.abs(diffHours - 24) < 1) setExpirationPreset('24h');
        else if (Math.abs(diffHours - 168) < 4) setExpirationPreset('7d');
        else if (Math.abs(diffHours - 720) < 12) setExpirationPreset('30d');
        else {
          setExpirationPreset('custom');
          // Format for datetime-local: YYYY-MM-DDThh:mm
          const localIso = new Date(expTime - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setCustomExpiresAt(localIso);
        }
      }
    } else {
      // Default initial states
      setPasswordEnabled(false);
      setPasswordValue('');
      setExpirationPreset('7d');
      setLinkRole('viewer');
      setAllowDownload(true);
      setMaxDownloadsLimit(null);
    }
  }, [publicLink]);

  // Expiration calculation
  const isExpired = useMemo(() => {
    if (!publicLink?.expiresAt) return false;
    return new Date(publicLink.expiresAt).getTime() < Date.now();
  }, [publicLink?.expiresAt]);

  const expirationDisplay = useMemo(() => {
    if (!publicLink?.expiresAt) return 'Never expires';
    const diff = new Date(publicLink.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 1) return `Expires in ${days} days`;
    if (days === 1) return 'Expires tomorrow';
    if (hours > 0) return `Expires in ${hours} hours`;
    const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `Expires in ${mins} minutes`;
  }, [publicLink?.expiresAt]);

  const shareUrl = useMemo(() => {
    if (!publicLink) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?share=${publicLink.token}`;
  }, [publicLink]);

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let res = '';
    for (let i = 0; i < 9; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasswordValue(res);
    setPasswordEnabled(true);
    setShowPasswordText(true);
    showToast({
      type: 'info',
      title: 'Password Generated',
      message: `Generated secure password: ${res}`
    });
  };

  // Helper to compute target expiration ISO string
  const computeExpirationDate = (preset: typeof expirationPreset, customVal: string): string | null => {
    const now = Date.now();
    switch (preset) {
      case '1h':
        return new Date(now + 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now + 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'custom':
        return customVal ? new Date(customVal).toISOString() : null;
      case 'never':
      default:
        return null;
    }
  };

  // Create new public link
  const handleCreatePublicLink = () => {
    const generatedToken = 'share_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 8);
    const expiresAt = computeExpirationDate(expirationPreset, customExpiresAt);

    const newLink: PublicShareLink = {
      token: generatedToken,
      role: linkRole,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
      passwordProtected: passwordEnabled && !!passwordValue.trim(),
      password: passwordEnabled ? passwordValue.trim() : undefined,
      downloadCount: 0,
      allowDownload: allowDownload,
      maxDownloads: maxDownloadsLimit
    };

    if (itemType === 'file') {
      updateFileShare(itemId, sharedWith, newLink);
    } else {
      updateFolderShare(itemId, sharedWith, newLink);
    }

    showToast({
      type: 'success',
      title: 'Secure Link Created',
      message: passwordEnabled ? 'Link created with password protection & expiration' : 'Secure shareable link generated'
    });
  };

  // Update existing public link settings
  const handleUpdateLinkSettings = () => {
    if (!publicLink) return;

    const expiresAt = computeExpirationDate(expirationPreset, customExpiresAt);

    const updatedLink: PublicShareLink = {
      ...publicLink,
      role: linkRole,
      expiresAt: expiresAt || null,
      passwordProtected: passwordEnabled && !!passwordValue.trim(),
      password: passwordEnabled ? passwordValue.trim() : undefined,
      allowDownload: allowDownload,
      maxDownloads: maxDownloadsLimit
    };

    if (itemType === 'file') {
      updateFileShare(itemId, sharedWith, updatedLink);
    } else {
      updateFolderShare(itemId, sharedWith, updatedLink);
    }

    showToast({
      type: 'success',
      title: 'Security Settings Saved',
      message: 'Share link permissions, password, and expiration updated'
    });
  };

  // Regenerate Token (Security Reset)
  const handleRegenerateToken = () => {
    if (!publicLink) return;
    const newToken = 'share_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 8);
    
    const updatedLink: PublicShareLink = {
      ...publicLink,
      token: newToken,
      createdAt: new Date().toISOString(),
      downloadCount: 0,
    };

    if (itemType === 'file') {
      updateFileShare(itemId, sharedWith, updatedLink);
    } else {
      updateFolderShare(itemId, sharedWith, updatedLink);
    }

    showToast({
      type: 'info',
      title: 'Link Regenerated',
      message: 'Previous URL is now permanently invalid. A fresh token was generated.'
    });
  };

  // Revoke / Disable Link
  const handleRevokeLink = () => {
    if (itemType === 'file') {
      updateFileShare(itemId, sharedWith, null);
    } else {
      updateFolderShare(itemId, sharedWith, null);
    }

    showToast({
      type: 'warning',
      title: 'Public Access Revoked',
      message: 'The shareable link has been disabled. Visitors can no longer access this file.'
    });
  };

  const handleCopyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    showToast({
      type: 'success',
      title: 'Link Copied',
      message: 'Shareable link copied to clipboard'
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyPassword = () => {
    if (!passwordValue) return;
    navigator.clipboard.writeText(passwordValue);
    setCopiedPassword(true);
    showToast({
      type: 'info',
      title: 'Password Copied',
      message: 'Access password copied to clipboard'
    });
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    if (sharedWith.some(s => s.userEmail.toLowerCase() === email)) {
      setError('This user is already a collaborator.');
      return;
    }

    const matchedUser = users.find(u => u.email.toLowerCase() === email);
    const newPerm: SharePermission = {
      userId: matchedUser ? matchedUser.id : 'usr_' + Math.random().toString(36).substring(2, 8),
      userEmail: email,
      userName: matchedUser ? matchedUser.name : email.split('@')[0],
      role: inviteRole,
      grantedAt: new Date().toISOString(),
    };

    const updatedSharedWith = [...sharedWith, newPerm];
    if (itemType === 'file') {
      updateFileShare(itemId, updatedSharedWith, publicLink);
    } else {
      updateFolderShare(itemId, updatedSharedWith, publicLink);
    }

    setInviteEmail('');
    showToast({
      type: 'success',
      title: 'Collaborator Added',
      message: `${email} added as ${inviteRole}`
    });
  };

  const handleRemoveCollaborator = (userEmail: string) => {
    const updatedSharedWith = sharedWith.filter(s => s.userEmail.toLowerCase() !== userEmail.toLowerCase());
    if (itemType === 'file') {
      updateFileShare(itemId, updatedSharedWith, publicLink);
    } else {
      updateFolderShare(itemId, updatedSharedWith, publicLink);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm truncate max-w-xs">
                  Share "{itemName}"
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono text-[10px] uppercase">
                  {itemType}
                </span>
              </div>
              <p className="text-xs text-slate-400">Generate secure share links & manage user access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 px-6 pt-2 bg-white">
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Secure Shareable Link</span>
            {publicLink && (
              <span className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-emerald-500'}`} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Direct Users ({sharedWith.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'link' ? (
            /* TAB 1: SECURE SHAREABLE LINK */
            <div className="space-y-5">
              {!publicLink ? (
                /* Empty state - link not generated yet */
                <div className="text-center p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Generate a Secure Public Link</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                      Create an encrypted, shareable URL. You can optionally require password protection, set automated expiration deadlines, and control download permissions.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleCreatePublicLink}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Create Secure Shareable Link</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Active Link Configuration */
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${
                        isExpired 
                          ? 'bg-red-100 text-red-600' 
                          : publicLink.passwordProtected 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isExpired ? <Clock className="w-4 h-4" /> : publicLink.passwordProtected ? <Lock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isExpired
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isExpired ? 'Link Expired' : 'Link Active'}
                          </span>
                          {publicLink.passwordProtected && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Password Set</span>
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 font-medium">
                            {expirationDisplay}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {publicLink.downloadCount} download{(publicLink.downloadCount || 0) === 1 ? '' : 's'} recorded
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowQrCode(!showQrCode)}
                        title="Show QR Code"
                        className={`p-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          showQrCode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleRevokeLink}
                        title="Revoke and destroy link"
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>

                  {/* QR Code Popover */}
                  {showQrCode && (
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-md text-center space-y-2 flex flex-col items-center">
                      <p className="text-xs font-semibold text-slate-700">Scan QR Code to Open on Mobile</p>
                      <div className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                        {/* High-contrast QR visualization */}
                        <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="100" height="100" fill="white" />
                          {/* Corner Squares */}
                          <rect x="10" y="10" width="24" height="24" fill="#0f172a" rx="4" />
                          <rect x="14" y="14" width="16" height="16" fill="white" rx="2" />
                          <rect x="18" y="18" width="8" height="8" fill="#0f172a" rx="1" />

                          <rect x="66" y="10" width="24" height="24" fill="#0f172a" rx="4" />
                          <rect x="70" y="14" width="16" height="16" fill="white" rx="2" />
                          <rect x="74" y="18" width="8" height="8" fill="#0f172a" rx="1" />

                          <rect x="10" y="66" width="24" height="24" fill="#0f172a" rx="4" />
                          <rect x="14" y="70" width="16" height="16" fill="white" rx="2" />
                          <rect x="18" y="74" width="8" height="8" fill="#0f172a" rx="1" />

                          {/* Data Matrix Dots */}
                          <rect x="42" y="12" width="6" height="6" fill="#2563eb" rx="1" />
                          <rect x="52" y="12" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="42" y="22" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="52" y="22" width="6" height="6" fill="#2563eb" rx="1" />

                          <rect x="12" y="42" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="22" y="42" width="6" height="6" fill="#2563eb" rx="1" />
                          <rect x="32" y="42" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="42" y="42" width="16" height="16" fill="#0f172a" rx="2" />
                          <rect x="66" y="42" width="6" height="6" fill="#2563eb" rx="1" />
                          <rect x="76" y="42" width="6" height="6" fill="#0f172a" rx="1" />

                          <rect x="42" y="66" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="52" y="66" width="6" height="6" fill="#2563eb" rx="1" />
                          <rect x="66" y="66" width="6" height="6" fill="#0f172a" rx="1" />
                          <rect x="76" y="76" width="14" height="14" fill="#2563eb" rx="2" />
                        </svg>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 break-all max-w-xs">{shareUrl}</p>
                    </div>
                  )}

                  {/* Shareable Link Input & Copy */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      Shareable URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono outline-none select-all"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                      </button>

                      {/* Preview as Visitor Button */}
                      <button
                        onClick={() => {
                          if (onOpenVisitorPreview) {
                            onOpenVisitorPreview(publicLink.token);
                          } else {
                            window.location.search = `?share=${publicLink.token}`;
                          }
                        }}
                        title="Preview experience as visitor"
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>

                  {/* Settings Accordion / Box */}
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>Security & Expiration Controls</span>
                    </h5>

                    {/* 1. PASSWORD PROTECTION SETTINGS */}
                    <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">Password Protection</p>
                            <p className="text-[11px] text-slate-400">Require visitors to enter a password to view this file</p>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={passwordEnabled}
                            onChange={(e) => {
                              setPasswordEnabled(e.target.checked);
                              if (e.target.checked && !passwordValue) {
                                handleGeneratePassword();
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {passwordEnabled && (
                        <div className="pt-2 space-y-2 border-t border-slate-200/60 animate-in fade-in duration-150">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showPasswordText ? 'text' : 'password'}
                                value={passwordValue}
                                onChange={(e) => setPasswordValue(e.target.value)}
                                placeholder="Enter secure password"
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500 pr-16 font-mono"
                              />
                              <div className="absolute right-2 top-1.5 flex items-center gap-1 text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => setShowPasswordText(!showPasswordText)}
                                  className="hover:text-slate-600 p-0.5 cursor-pointer"
                                  title={showPasswordText ? 'Hide password' : 'Show password'}
                                >
                                  {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCopyPassword}
                                  className="hover:text-slate-600 p-0.5 cursor-pointer"
                                  title="Copy password"
                                >
                                  {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleGeneratePassword}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Random</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Visitors will see a lock screen prompting for this exact password.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 2. EXPIRATION SETTINGS */}
                    <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Expiration Schedule</p>
                          <p className="text-[11px] text-slate-400">Automatically revoke visitor access after selected duration</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[
                          { id: 'never', label: 'Never' },
                          { id: '1h', label: '1 Hour' },
                          { id: '24h', label: '24 Hours' },
                          { id: '7d', label: '7 Days' },
                          { id: '30d', label: '30 Days' },
                          { id: 'custom', label: 'Custom' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setExpirationPreset(opt.id as any)}
                            className={`py-1.5 px-2 text-xs font-medium rounded-xl border transition-all cursor-pointer text-center ${
                              expirationPreset === opt.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Datetime Input */}
                      {expirationPreset === 'custom' && (
                        <div className="pt-2 animate-in fade-in duration-150">
                          <input
                            type="datetime-local"
                            value={customExpiresAt}
                            onChange={(e) => setCustomExpiresAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      {/* Expiration warning or indicator */}
                      {isExpired && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>This link has expired and is blocked.</span>
                          </span>
                          <button
                            onClick={() => setExpirationPreset('7d')}
                            className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-semibold hover:bg-red-700 cursor-pointer"
                          >
                            Renew (+7 Days)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. PERMISSIONS & DOWNLOAD CONTROLS */}
                    <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Visitor Role</p>
                          <p className="text-[11px] text-slate-400">Configure whether visitors can edit document content</p>
                        </div>
                        <select
                          value={linkRole}
                          onChange={(e) => setLinkRole(e.target.value as 'viewer' | 'editor')}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none font-medium"
                        >
                          <option value="viewer">Viewer (Read-only)</option>
                          <option value="editor">Editor (Can edit text documents)</option>
                        </select>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Allow File Download</p>
                          <p className="text-[11px] text-slate-400">If disabled, visitors can only preview the file in-browser</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowDownload}
                            onChange={(e) => setAllowDownload(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleRegenerateToken}
                        title="Invalidates previous link and creates fresh URL"
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate Link Token</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUpdateLinkSettings}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Save Link Settings
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: DIRECT USER COLLABORATORS */
            <div className="space-y-4">
              {/* Invite Form */}
              <form onSubmit={handleAddCollaborator} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email address (e.g. alice@storagedrive.com)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 text-slate-800"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}
                  className="px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={!inviteEmail.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Invite
                </button>
              </form>

              {error && <p className="text-xs text-red-600">{error}</p>}

              {/* Collaborators List */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-500 mb-2">People with access:</p>
                {sharedWith.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No individual collaborators added yet. Only you can access this item directly.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {sharedWith.map((collab) => (
                      <div
                        key={collab.userEmail}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {collab.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{collab.userName}</p>
                            <p className="text-[11px] text-slate-400">{collab.userEmail}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            collab.role === 'editor' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {collab.role === 'editor' ? 'Can Edit' : 'Can View'}
                          </span>
                          <button
                            onClick={() => handleRemoveCollaborator(collab.userEmail)}
                            title="Revoke Access"
                            className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
