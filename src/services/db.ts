import { 
  User, 
  FileItem, 
  FolderItem, 
  AuditLog, 
  FileCategory, 
  FileVersion,
  PendingOfflineUpload 
} from '../types/drive';

const DB_NAME = 'StorageDriveDB';
const DB_VERSION = 1;
const BLOB_STORE = 'file_blobs';

const STORAGE_KEYS = {
  USERS: 'storage_drive_users_v1',
  FILES: 'storage_drive_files_v1',
  FOLDERS: 'storage_drive_folders_v1',
  AUDIT_LOGS: 'storage_drive_audit_v1',
  SESSION: 'storage_drive_session_v1',
  PASSWORD_RESETS: 'storage_drive_resets_v1',
  PENDING_UPLOADS: 'storage_drive_pending_uploads_v1',
  CACHED_OFFLINE_FILES: 'storage_drive_offline_cached_files_v1',
  OFFLINE_METADATA: 'storage_drive_offline_metadata_v1',
  RECENTLY_VIEWED: 'storage_drive_recently_viewed_v1',
};

// Initialize IndexedDB for storing file binary blobs safely
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeBlob(blobId: string, data: Blob | ArrayBuffer | string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      const store = tx.objectStore(BLOB_STORE);
      const req = store.put(data, blobId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falling back from IndexedDB blob store:', err);
  }
}

export async function getBlob(blobId: string): Promise<Blob | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const store = tx.objectStore(BLOB_STORE);
      const req = store.get(blobId);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) return resolve(null);
        if (res instanceof Blob) return resolve(res);
        if (res instanceof ArrayBuffer) return resolve(new Blob([res]));
        if (typeof res === 'string') return resolve(new Blob([res], { type: 'text/plain' }));
        resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteBlob(blobId: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      const store = tx.objectStore(BLOB_STORE);
      const req = store.delete(blobId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to delete blob', e);
  }
}

export async function computeSHA256(data: ArrayBuffer | Blob): Promise<string> {
  try {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'sha256_' + Math.random().toString(36).substring(2, 10);
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function detectCategory(fileName: string, mimeType: string): FileCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext) || mimeType.startsWith('image/')) {
    return 'image';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) || mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) {
    return 'document';
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) || mimeType.startsWith('video/')) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
    return 'archive';
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sql', 'sh', 'md'].includes(ext) || mimeType.includes('json') || mimeType.includes('javascript')) {
    return 'code';
  }
  return 'other';
}

// Password hashing helper (simulated with standard Web Crypto API SHA-256 for browser security)
export async function hashPassword(plainText: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(plainText + '_storage_salt_2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Seed initial state
export async function initializeDatabase(): Promise<void> {
  if (typeof window === 'undefined') return;

  const existingUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!existingUsers) {
    const adminHash = await hashPassword('AdminPass123!');
    const aliceHash = await hashPassword('AlicePass123!');
    const alexanderHash = await hashPassword('UserPass123!');

    const seedUsers: User[] = [
      {
        id: 'usr_admin_1',
        name: 'Alex Rivera (Administrator)',
        email: 'admin@storagedrive.com',
        passwordHash: adminHash,
        role: 'admin',
        status: 'active',
        storageQuotaBytes: 15 * 1024 * 1024 * 1024, // 15 GB
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        avatarColor: '#4f46e5',
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: 'usr_alice_2',
        name: 'Alice Henderson',
        email: 'alice@storagedrive.com',
        passwordHash: aliceHash,
        role: 'member',
        status: 'active',
        storageQuotaBytes: 5 * 1024 * 1024 * 1024, // 5 GB
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        avatarColor: '#059669',
        lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'usr_alex_3',
        name: 'Alexander Sauli',
        email: 'lyceesaintalexandresauli@gmail.com',
        passwordHash: alexanderHash,
        role: 'member',
        status: 'active',
        storageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        avatarColor: '#d97706',
        lastLoginAt: new Date(Date.now() - 7200000).toISOString(),
      }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(seedUsers));

    // Seed Folders
    const seedFolders: FolderItem[] = [
      {
        id: 'fld_projects',
        name: 'Projects & Strategy 2026',
        parentId: null,
        ownerId: 'usr_admin_1',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        isDeleted: false,
        color: '#3b82f6',
        sharedWith: [
          {
            userId: 'usr_alice_2',
            userEmail: 'alice@storagedrive.com',
            userName: 'Alice Henderson',
            role: 'editor',
            grantedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          }
        ],
        publicLink: null,
      },
      {
        id: 'fld_design',
        name: 'Design Assets & Brand',
        parentId: null,
        ownerId: 'usr_admin_1',
        createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        isDeleted: false,
        color: '#ec4899',
        sharedWith: [],
        publicLink: null,
      },
      {
        id: 'fld_finance',
        name: 'Financial Reports',
        parentId: null,
        ownerId: 'usr_admin_1',
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        isDeleted: false,
        color: '#10b981',
        sharedWith: [],
        publicLink: null,
      },
      {
        id: 'fld_sub_q3',
        name: 'Q3 Presentations',
        parentId: 'fld_projects',
        ownerId: 'usr_admin_1',
        createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        isDeleted: false,
        color: '#8b5cf6',
        sharedWith: [],
        publicLink: null,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(seedFolders));

    // Seed Sample Files and Blobs
    const sampleDocs = [
      {
        id: 'file_spec_md',
        name: 'Storage_Drive_Architecture.md',
        ext: 'md',
        mime: 'text/markdown',
        cat: 'document' as FileCategory,
        folderId: 'fld_projects',
        content: `# Storage Drive System Specification\n\n## Overview\nEnterprise-grade cloud storage system supporting end-to-end file encryption, versioning, access control, and granular storage quota enforcement.\n\n### Key Components\n- **Client Storage Engine**: Hybrid IndexedDB Binary Blob Store with zero-latency caching\n- **Security Layer**: ABAC (Attribute-Based Access Control) with role verification\n- **Audit Telemetry**: Real-time logging of all file uploads, downloads, moves, and shares\n- **Version Control**: Multi-revision file tracking with 1-click restore\n\n### Status\nAll 25 Acceptance Criteria Verified.`,
      },
      {
        id: 'file_budget_csv',
        name: 'Q4_Financial_Forecast.csv',
        ext: 'csv',
        mime: 'text/csv',
        cat: 'document' as FileCategory,
        folderId: 'fld_finance',
        content: `Department,Allocated_Budget_USD,Actual_Spend_USD,Variance_Percentage,Quarter\nInfrastructure,150000,142000,-5.3%,Q4\nEngineering,420000,410000,-2.4%,Q4\nDesign & UX,85000,82000,-3.5%,Q4\nSecurity & Compliance,60000,59500,-0.8%,Q4\nOperations,95000,91000,-4.2%,Q4\nTotal,810000,784500,-3.1%,Q4`,
      },
      {
        id: 'file_cloud_config',
        name: 'cluster-config.json',
        ext: 'json',
        mime: 'application/json',
        cat: 'code' as FileCategory,
        folderId: null, // Root
        content: JSON.stringify({
          service: "storage-drive-core",
          environment: "production",
          redundancyLevel: "triple-region-mesh",
          maxUploadChunkSizeMB: 100,
          allowedMimeTypes: ["*/*"],
          quotaEnforcement: "strict-proactive",
          recycleBinRetentionDays: 30,
          encryption: {
            algorithm: "AES-256-GCM",
            enabledAtRest: true
          }
        }, null, 2),
      },
      {
        id: 'file_welcome_guide',
        name: 'Getting_Started_Guide.txt',
        ext: 'txt',
        mime: 'text/plain',
        cat: 'document' as FileCategory,
        folderId: null, // Root
        content: `Welcome to Storage Drive Software!\n\nHere is how you can get started:\n1. Upload Files: Click 'Upload Files' or drag & drop documents, images, or archives.\n2. Organize: Create nested folders and drag or move items freely.\n3. Share: Click 'Share' to invite team members or generate secure public share links.\n4. Version Control: View version history on any document and revert anytime.\n5. Trash & Recovery: Deleted items go to the Recycle Bin and can be restored anytime!\n6. Admin Control: Switch accounts to Admin to adjust user quotas and inspect security audit logs.`,
      },
      {
        id: 'file_security_audit_pdf',
        name: 'Annual_Security_Audit_2026.pdf',
        ext: 'pdf',
        mime: 'application/pdf',
        cat: 'document' as FileCategory,
        folderId: 'fld_projects',
        content: `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 195 >>\nstream\nBT\n/F1 22 Tf\n72 710 Td\n(CLOUD DRIVE ANNUAL AUDIT REPORT 2026) Tj\n0 -40 Td\n/F1 12 Tf\n(Certified Secure By Enterprise Infrastructure Standards) Tj\n0 -30 Td\n/F1 10 Tf\n(Status: 100% End-to-End Encrypted. 0 Critical Vulnerabilities.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000490 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n559\n%%EOF`,
      },
      {
        id: 'file_architecture_svg',
        name: 'Cloud_Drive_Architecture.svg',
        ext: 'svg',
        mime: 'image/svg+xml',
        cat: 'image' as FileCategory,
        folderId: 'fld_design',
        content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="800" height="500" rx="24" fill="url(#bgGrad)" />
  <circle cx="700" cy="80" r="140" fill="#3b82f6" opacity="0.08" />
  <circle cx="100" cy="420" r="160" fill="#ec4899" opacity="0.06" />
  <text x="50" y="70" fill="#fff" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700">Storage Drive Enterprise Mesh</text>
  <text x="50" y="98" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13">High-Availability Encrypted Cluster Topology (2026)</text>
  <g transform="translate(60, 150)" filter="url(#shadow)">
    <rect width="200" height="180" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2" />
    <rect width="180" height="4" rx="2" x="10" y="10" fill="url(#accentGrad)" />
    <circle cx="35" cy="45" r="16" fill="#3b82f6" fill-opacity="0.2" />
    <text x="35" y="50" fill="#60a5fa" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">⚡</text>
    <text x="65" y="45" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Client Engine</text>
    <text x="65" y="60" fill="#64748b" font-family="system-ui, sans-serif" font-size="10">Browser Hybrid DB</text>
    <text x="20" y="105" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• SHA-256 Checksums</text>
    <text x="20" y="130" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• IndexedDB Blobs</text>
    <text x="20" y="155" fill="#10b981" font-family="system-ui, sans-serif" font-size="11">✓ Zero-Latency Cache</text>
  </g>
  <g transform="translate(300, 150)" filter="url(#shadow)">
    <rect width="200" height="180" rx="16" fill="#1e293b" stroke="#3b82f6" stroke-width="2" />
    <rect width="180" height="4" rx="2" x="10" y="10" fill="url(#emeraldGrad)" />
    <circle cx="35" cy="45" r="16" fill="#10b981" fill-opacity="0.2" />
    <text x="35" y="50" fill="#34d399" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">🔒</text>
    <text x="65" y="45" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Security Vault</text>
    <text x="65" y="60" fill="#64748b" font-family="system-ui, sans-serif" font-size="10">ABAC Quotas</text>
    <text x="20" y="105" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• Role Permissioning</text>
    <text x="20" y="130" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• Multi-Revision Trees</text>
    <text x="20" y="155" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="11">✓ AES-256 Cryptography</text>
  </g>
  <g transform="translate(540, 150)" filter="url(#shadow)">
    <rect width="200" height="180" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2" />
    <rect width="180" height="4" rx="2" x="10" y="10" fill="#ec4899" />
    <circle cx="35" cy="45" r="16" fill="#ec4899" fill-opacity="0.2" />
    <text x="35" y="50" fill="#f472b6" font-family="system-ui, sans-serif" font-size="14" text-anchor="middle">☁️</text>
    <text x="65" y="45" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Storage Mesh</text>
    <text x="65" y="60" fill="#64748b" font-family="system-ui, sans-serif" font-size="10">Geo-Distributed</text>
    <text x="20" y="105" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• 99.999% Reliability</text>
    <text x="20" y="130" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">• Cross-Region Sync</text>
    <text x="20" y="155" fill="#a78bfa" font-family="system-ui, sans-serif" font-size="11">✓ Continuous Telemetry</text>
  </g>
  <path d="M 260 240 L 300 240" stroke="#3b82f6" stroke-width="3" stroke-dasharray="4 4" />
  <path d="M 500 240 L 540 240" stroke="#10b981" stroke-width="3" stroke-dasharray="4 4" />
  <g transform="translate(60, 390)">
    <rect width="680" height="50" rx="12" fill="#0b1120" stroke="#1e293b" />
    <text x="30" y="30" fill="#34d399" font-family="monospace" font-size="12">STATUS: OPERATIONAL</text>
    <text x="220" y="30" fill="#94a3b8" font-family="monospace" font-size="12">LATENCY: 4ms</text>
    <text x="380" y="30" fill="#94a3b8" font-family="monospace" font-size="12">ENCRYPTION: HARDWARE ACCELERATED</text>
    <circle cx="650" cy="25" r="5" fill="#10b981" />
  </g>
</svg>`,
      }
    ];

    const seedFiles: FileItem[] = [];

    for (const docItem of sampleDocs) {
      const blob = new Blob([docItem.content], { type: docItem.mime });
      const checksum = await computeSHA256(blob);
      const blobId = 'blob_' + docItem.id;
      await storeBlob(blobId, blob);

      const fileItem: FileItem = {
        id: docItem.id,
        name: docItem.name,
        extension: docItem.ext,
        mimeType: docItem.mime,
        category: docItem.cat,
        sizeBytes: blob.size,
        folderId: docItem.folderId,
        ownerId: 'usr_admin_1',
        blobId: blobId,
        createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        isDeleted: false,
        isStarred: docItem.id === 'file_spec_md',
        checksum: checksum,
        sharedWith: docItem.id === 'file_spec_md' ? [
          {
            userId: 'usr_alice_2',
            userEmail: 'alice@storagedrive.com',
            userName: 'Alice Henderson',
            role: 'viewer',
            grantedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
          }
        ] : [],
        publicLink: docItem.id === 'file_welcome_guide' ? {
          token: 'share_welcome_pub2026',
          role: 'viewer',
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
          passwordProtected: false,
          downloadCount: 14,
          allowDownload: true,
        } : docItem.id === 'file_security_audit_pdf' ? {
          token: 'share_audit_sec2026',
          role: 'viewer',
          createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          passwordProtected: true,
          password: 'Audit2026!',
          downloadCount: 3,
          allowDownload: true,
        } : null,
        versions: [
          {
            versionId: 'v1_' + docItem.id,
            versionNumber: 1,
            uploadedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
            uploadedBy: 'Alex Rivera',
            sizeBytes: blob.size - 40,
            blobId: blobId,
            comment: 'Initial draft upload',
            checksum: checksum,
          },
          {
            versionId: 'v2_' + docItem.id,
            versionNumber: 2,
            uploadedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
            uploadedBy: 'Alex Rivera',
            sizeBytes: blob.size,
            blobId: blobId,
            comment: 'Updated specification and benchmarks',
            checksum: checksum,
          }
        ],
        textContent: docItem.content,
      };

      seedFiles.push(fileItem);
    }

    // Also add one sample deleted file in Recycle Bin to fulfill US-21 out of the box!
    const trashDoc = {
      id: 'file_old_draft',
      name: 'Legacy_Project_Notes_2025.txt',
      ext: 'txt',
      mime: 'text/plain',
      cat: 'document' as FileCategory,
      folderId: 'fld_projects',
      content: `Old deprecated project notes from previous release cycle.\nEligible for restoration or permanent purge.`,
    };
    const trashBlob = new Blob([trashDoc.content], { type: trashDoc.mime });
    const trashChecksum = await computeSHA256(trashBlob);
    const trashBlobId = 'blob_' + trashDoc.id;
    await storeBlob(trashBlobId, trashBlob);

    seedFiles.push({
      id: trashDoc.id,
      name: trashDoc.name,
      extension: trashDoc.ext,
      mimeType: trashDoc.mime,
      category: trashDoc.cat,
      sizeBytes: trashBlob.size,
      folderId: trashDoc.folderId,
      ownerId: 'usr_admin_1',
      blobId: trashBlobId,
      createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      isDeleted: true,
      deletedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      originalFolderId: 'fld_projects',
      checksum: trashChecksum,
      sharedWith: [],
      versions: [],
      textContent: trashDoc.content,
    });

    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(seedFiles));

    // Seed Audit Logs
    const seedLogs: AuditLog[] = [
      {
        id: 'log_1',
        timestamp: new Date(Date.now() - 12 * 86400000).toISOString(),
        userId: 'usr_admin_1',
        userEmail: 'admin@storagedrive.com',
        eventType: 'AUTH_LOGIN',
        description: 'User logged in successfully with 2FA verified session',
        ipAddress: '192.168.1.42',
        severity: 'info',
      },
      {
        id: 'log_2',
        timestamp: new Date(Date.now() - 10 * 86400000).toISOString(),
        userId: 'usr_admin_1',
        userEmail: 'admin@storagedrive.com',
        eventType: 'FOLDER_CREATE',
        description: 'Created folder "Projects & Strategy 2026"',
        ipAddress: '192.168.1.42',
        severity: 'info',
      },
      {
        id: 'log_3',
        timestamp: new Date(Date.now() - 8 * 86400000).toISOString(),
        userId: 'usr_admin_1',
        userEmail: 'admin@storagedrive.com',
        eventType: 'FILE_UPLOAD',
        description: 'Uploaded file "Storage_Drive_Architecture.md" (3.2 KB)',
        ipAddress: '192.168.1.42',
        severity: 'info',
      },
      {
        id: 'log_4',
        timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
        userId: 'usr_admin_1',
        userEmail: 'admin@storagedrive.com',
        eventType: 'FILE_SHARE',
        description: 'Granted view access for "Storage_Drive_Architecture.md" to alice@storagedrive.com',
        ipAddress: '192.168.1.42',
        severity: 'info',
      },
      {
        id: 'log_5',
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        userId: 'usr_admin_1',
        userEmail: 'admin@storagedrive.com',
        eventType: 'FILE_DELETE',
        description: 'Moved "Legacy_Project_Notes_2025.txt" to Recycle Bin',
        ipAddress: '192.168.1.42',
        severity: 'warning',
      },
    ];
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(seedLogs));
  } else {
    // If users exist but the new sample PDF/SVG are not yet added to files
    try {
      const rawFiles = localStorage.getItem(STORAGE_KEYS.FILES);
      const existingFiles: FileItem[] = rawFiles ? JSON.parse(rawFiles) : [];
      let updated = false;

      if (!existingFiles.some(f => f.extension === 'pdf')) {
        const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 195 >>\nstream\nBT\n/F1 22 Tf\n72 710 Td\n(CLOUD DRIVE ANNUAL AUDIT REPORT 2026) Tj\n0 -40 Td\n/F1 12 Tf\n(Certified Secure By Enterprise Infrastructure Standards) Tj\n0 -30 Td\n/F1 10 Tf\n(Status: 100% End-to-End Encrypted. 0 Critical Vulnerabilities.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000490 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n559\n%%EOF`;
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const checksum = await computeSHA256(blob);
        const blobId = 'blob_file_security_audit_pdf';
        await storeBlob(blobId, blob);
        existingFiles.push({
          id: 'file_security_audit_pdf',
          name: 'Annual_Security_Audit_2026.pdf',
          extension: 'pdf',
          mimeType: 'application/pdf',
          category: 'document',
          sizeBytes: blob.size,
          folderId: null,
          ownerId: 'usr_admin_1',
          blobId: blobId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
          checksum: checksum,
          sharedWith: [],
          versions: [],
          textContent: 'CLOUD DRIVE ANNUAL AUDIT REPORT 2026\n\nCertified Secure By Enterprise Infrastructure Standards\nStatus: 100% End-to-End Encrypted. 0 Critical Vulnerabilities.\n\nKey Verification Items:\n- Zero Trust Multi-Tenant Access Control: PASS\n- Cryptographic SHA-256 Blob Integrity: PASS\n- Version Trees & 1-Click Rollback: PASS',
        });
        updated = true;
      }

      if (!existingFiles.some(f => f.category === 'image')) {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="800" height="500" rx="20" fill="url(#bg)"/><text x="40" y="80" fill="#fff" font-family="system-ui" font-size="24" font-weight="bold">Cloud Storage Infrastructure</text><rect x="40" y="140" width="220" height="180" rx="14" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/><text x="60" y="180" fill="#60a5fa" font-family="system-ui" font-size="16" font-weight="bold">1. Edge Gateway</text><text x="60" y="210" fill="#94a3b8" font-family="system-ui" font-size="12">• TLS 1.3 Termination</text><text x="60" y="235" fill="#94a3b8" font-family="system-ui" font-size="12">• Token Validation</text><rect x="290" y="140" width="220" height="180" rx="14" fill="#1e293b" stroke="#10b981" stroke-width="2"/><text x="310" y="180" fill="#34d399" font-family="system-ui" font-size="16" font-weight="bold">2. Storage Core</text><text x="310" y="210" fill="#94a3b8" font-family="system-ui" font-size="12">• IndexedDB Engine</text><text x="310" y="235" fill="#94a3b8" font-family="system-ui" font-size="12">• SHA-256 Hashing</text><rect x="540" y="140" width="220" height="180" rx="14" fill="#1e293b" stroke="#8b5cf6" stroke-width="2"/><text x="560" y="180" fill="#c084fc" font-family="system-ui" font-size="16" font-weight="bold">3. Revisions</text><text x="560" y="210" fill="#94a3b8" font-family="system-ui" font-size="12">• Immutable Snapshots</text><text x="560" y="235" fill="#94a3b8" font-family="system-ui" font-size="12">• 1-Click Restore</text></svg>`;
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const checksum = await computeSHA256(blob);
        const blobId = 'blob_file_architecture_svg';
        await storeBlob(blobId, blob);
        existingFiles.push({
          id: 'file_architecture_svg',
          name: 'Cloud_Drive_Architecture.svg',
          extension: 'svg',
          mimeType: 'image/svg+xml',
          category: 'image',
          sizeBytes: blob.size,
          folderId: null,
          ownerId: 'usr_admin_1',
          blobId: blobId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
          checksum: checksum,
          sharedWith: [],
          versions: [],
        });
        updated = true;
      }

      const secAuditFile = existingFiles.find(f => f.id === 'file_security_audit_pdf');
      if (secAuditFile && !secAuditFile.publicLink) {
        secAuditFile.publicLink = {
          token: 'share_audit_sec2026',
          role: 'viewer',
          createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          passwordProtected: true,
          password: 'Audit2026!',
          downloadCount: 3,
          allowDownload: true,
        };
        updated = true;
      }

      if (updated) {
        localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(existingFiles));
      }
    } catch (e) {
      console.error('Failed to sync sample files:', e);
    }
  }
}

// LocalStorage accessors
export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

export function getFiles(): FileItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FILES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFiles(files: FileItem[]): void {
  localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(files));
}

export function getFolders(): FolderItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFolders(folders: FolderItem[]): void {
  localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
}

export function getAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
  try {
    const logs = getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    // Keep last 500 logs
    if (logs.length > 500) logs.pop();
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to log audit event', e);
  }
}

export function findItemByShareToken(token: string): { item: FileItem; type: 'file' } | { item: FolderItem; type: 'folder' } | null {
  try {
    const files = getFiles();
    const file = files.find(f => f.publicLink?.token === token && !f.isDeleted);
    if (file) return { item: file, type: 'file' };

    const folders = getFolders();
    const folder = folders.find(f => f.publicLink?.token === token && !f.isDeleted);
    if (folder) return { item: folder, type: 'folder' };

    return null;
  } catch {
    return null;
  }
}

export function incrementShareDownload(token: string): void {
  try {
    const files = getFiles();
    const fileIndex = files.findIndex(f => f.publicLink?.token === token);
    if (fileIndex !== -1) {
      const file = files[fileIndex];
      if (file.publicLink) {
        file.publicLink.downloadCount = (file.publicLink.downloadCount || 0) + 1;
        files[fileIndex] = file;
        saveFiles(files);
        addAuditLog({
          userId: 'anonymous_visitor',
          userEmail: 'public_link@storagedrive.com',
          eventType: 'FILE_DOWNLOAD',
          description: `Downloaded file "${file.name}" via public share link (${token})`,
          ipAddress: '127.0.0.1',
          severity: 'info'
        });
      }
    }
  } catch (e) {
    console.error('Failed to increment share download', e);
  }
}

export function getCurrentSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCurrentSession(session: { userId: string } | null): void {
  if (session) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }
}

// Password reset store
export interface PasswordResetRequest {
  email: string;
  code: string;
  expiresAt: number;
}

export function savePasswordResetCode(email: string, code: string): void {
  const reqs = getPasswordResetRequests();
  const filtered = reqs.filter(r => r.email.toLowerCase() !== email.toLowerCase());
  filtered.push({
    email,
    code,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins expiry
  });
  localStorage.setItem(STORAGE_KEYS.PASSWORD_RESETS, JSON.stringify(filtered));
}

export function verifyPasswordResetCode(email: string, code: string): boolean {
  const reqs = getPasswordResetRequests();
  const match = reqs.find(r => r.email.toLowerCase() === email.toLowerCase() && r.code.trim() === code.trim());
  if (!match) return false;
  if (Date.now() > match.expiresAt) return false;
  return true;
}

export function clearPasswordReset(email: string): void {
  const reqs = getPasswordResetRequests();
  const filtered = reqs.filter(r => r.email.toLowerCase() !== email.toLowerCase());
  localStorage.setItem(STORAGE_KEYS.PASSWORD_RESETS, JSON.stringify(filtered));
}

function getPasswordResetRequests(): PasswordResetRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PASSWORD_RESETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Offline Mode, Service Worker Caching, and Pending Uploads Queue
// ---------------------------------------------------------------------------

export function getPendingOfflineUploads(): PendingOfflineUpload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_UPLOADS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingOfflineUploads(items: PendingOfflineUpload[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_UPLOADS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save pending offline uploads', e);
  }
}

export function addPendingOfflineUpload(item: PendingOfflineUpload): void {
  const current = getPendingOfflineUploads();
  const existingIdx = current.findIndex(i => i.id === item.id);
  if (existingIdx >= 0) {
    current[existingIdx] = item;
  } else {
    current.push(item);
  }
  savePendingOfflineUploads(current);
}

export function updatePendingOfflineUpload(id: string, updates: Partial<PendingOfflineUpload>): void {
  const current = getPendingOfflineUploads();
  const idx = current.findIndex(i => i.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...updates };
    savePendingOfflineUploads(current);
  }
}

export function removePendingOfflineUpload(id: string): void {
  const current = getPendingOfflineUploads();
  const filtered = current.filter(i => i.id !== id);
  savePendingOfflineUploads(filtered);
}

export function getCachedOfflineFileIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CACHED_OFFLINE_FILES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedOfflineFileIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHED_OFFLINE_FILES, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save cached offline file IDs', e);
  }
}

export function addCachedOfflineFileId(fileId: string): void {
  const ids = getCachedOfflineFileIds();
  if (!ids.includes(fileId)) {
    ids.push(fileId);
    saveCachedOfflineFileIds(ids);
  }
}

export function removeCachedOfflineFileId(fileId: string): void {
  const ids = getCachedOfflineFileIds();
  const filtered = ids.filter(id => id !== fileId);
  saveCachedOfflineFileIds(filtered);
}

export function getRecentlyViewedFileIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENTLY_VIEWED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordFileViewed(fileId: string): void {
  try {
    const ids = getRecentlyViewedFileIds();
    const updated = [fileId, ...ids.filter(id => id !== fileId)].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEYS.RECENTLY_VIEWED, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to record viewed file', e);
  }
}

export function saveOfflineMetadataSnapshot(snapshot: { files: FileItem[]; folders: FolderItem[]; timestamp: string }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_METADATA, JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to save offline metadata snapshot', e);
  }
}

export function getOfflineMetadataSnapshot(): { files: FileItem[]; folders: FolderItem[]; timestamp: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_METADATA);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
