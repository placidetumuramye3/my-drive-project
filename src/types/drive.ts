export type UserRole = 'admin' | 'member';
export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // stored hashed or simulated secure hash
  role: UserRole;
  status: UserStatus;
  storageQuotaBytes: number; // e.g. 2 GB = 2 * 1024 * 1024 * 1024
  createdAt: string;
  avatarColor?: string;
  lastLoginAt?: string;
}

export type FileCategory = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'other';

export interface FileVersion {
  versionId: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedBy: string; // User email or name
  sizeBytes: number;
  blobId: string; // Key in IndexedDB blob store
  comment?: string;
  checksum?: string;
}

export interface SharePermission {
  userId: string;
  userEmail: string;
  userName: string;
  role: 'viewer' | 'editor';
  grantedAt: string;
}

export interface PublicShareLink {
  token: string;
  role: 'viewer' | 'editor';
  createdAt: string;
  expiresAt?: string | null;
  passwordProtected?: boolean;
  password?: string;
  passwordHash?: string;
  downloadCount: number;
  maxDownloads?: number | null;
  allowDownload?: boolean;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null; // null represents root
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  color?: string;
  sharedWith: SharePermission[];
  publicLink?: PublicShareLink | null;
}

export interface FileItem {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  category: FileCategory;
  sizeBytes: number;
  folderId: string | null; // null represents root
  ownerId: string;
  blobId: string; // Pointer to IndexedDB blob storage
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
  originalFolderId?: string | null;
  isStarred?: boolean;
  checksum: string;
  sharedWith: SharePermission[];
  publicLink?: PublicShareLink | null;
  versions: FileVersion[];
  textContent?: string; // Cache for quick inline editing / text viewing
  isCachedOffline?: boolean;
  lastViewedAt?: string;
}

export interface PendingOfflineUpload {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  category: FileCategory;
  targetFolderId: string | null;
  createdAt: string;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  blobId: string;
  progress: number;
  error?: string;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  targetFolderId: string | null;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export type AuditEventType = 
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_REGISTER'
  | 'AUTH_PASSWORD_RESET'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_RENAME'
  | 'FILE_DELETE'
  | 'FILE_RESTORE'
  | 'FILE_PERMANENT_DELETE'
  | 'FILE_MOVE'
  | 'FILE_SHARE'
  | 'FOLDER_CREATE'
  | 'FOLDER_RENAME'
  | 'FOLDER_DELETE'
  | 'FOLDER_MOVE'
  | 'USER_STATUS_CHANGE'
  | 'USER_QUOTA_CHANGE'
  | 'SYSTEM_ALERT';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  eventType: AuditEventType;
  description: string;
  ipAddress: string;
  details?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'security';
}

export interface SystemHealth {
  status: 'operational' | 'degraded' | 'maintenance';
  uptimePercentage: number;
  totalStorageBytes: number;
  usedStorageBytes: number;
  totalUsers: number;
  totalFiles: number;
  totalFolders: number;
  activeSessions: number;
}
