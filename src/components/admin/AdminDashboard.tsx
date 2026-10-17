import React, { useState } from 'react';
import { 
  Users, 
  Shield, 
  HardDrive, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Filter, 
  Download, 
  LogIn, 
  Search, 
  RefreshCw,
  PieChart as PieIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDrive } from '../../context/DriveContext';
import { formatBytes, getAuditLogs } from '../../services/db';
import { User, UserRole, UserStatus, AuditLog } from '../../types/drive';
import { StorageUsageAnalytics } from './StorageUsageAnalytics';

export const AdminDashboard: React.FC = () => {
  const { users, currentUser, updateUserStatus, updateUserRole, updateUserQuota, switchUser } = useAuth();
  const { files, folders } = useDrive();

  const [activeTab, setActiveTab] = useState<'users' | 'storage' | 'health' | 'audit'>('users');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForQuota, setSelectedUserForQuota] = useState<User | null>(null);
  const [customQuotaGB, setCustomQuotaGB] = useState<string>('5');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [logs, setLogs] = useState<AuditLog[]>(getAuditLogs());

  const refreshLogs = () => {
    setLogs(getAuditLogs());
  };

  // Compute Platform Totals
  const totalActiveFiles = files.filter(f => !f.isDeleted).length;
  const totalActiveFolders = folders.filter(f => !f.isDeleted).length;
  const totalStorageBytes = files.filter(f => !f.isDeleted).reduce((acc, f) => acc + f.sizeBytes, 0);

  // Compute storage used per user
  const getUserUsageBytes = (userId: string) => {
    return files
      .filter(f => f.ownerId === userId && !f.isDeleted)
      .reduce((acc, f) => acc + f.sizeBytes, 0);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs = logs.filter(log => {
    if (auditFilter === 'all') return true;
    if (auditFilter === 'security') return log.severity === 'security' || log.severity === 'warning';
    if (auditFilter === 'auth') return log.eventType.startsWith('AUTH_');
    if (auditFilter === 'files') return log.eventType.startsWith('FILE_');
    if (auditFilter === 'folders') return log.eventType.startsWith('FOLDER_');
    return true;
  });

  const handleSaveQuota = () => {
    if (!selectedUserForQuota) return;
    const gb = parseFloat(customQuotaGB);
    if (isNaN(gb) || gb <= 0) return;
    const bytes = Math.round(gb * 1024 * 1024 * 1024);
    updateUserQuota(selectedUserForQuota.id, bytes);
    setSelectedUserForQuota(null);
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage_drive_audit_log_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            System Administration & Telemetry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage user accounts, assign storage quotas, monitor service health, and inspect audit logs.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'storage' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Storage Usage</span>
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'health' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            System Health
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              refreshLogs();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('users')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
          title="View Users Management"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Registered Users</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {users.filter(u => u.status === 'active').length} active accounts
          </span>
        </div>

        <div 
          onClick={() => setActiveTab('storage')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group"
          title="Click to view Storage Usage & Recharts Analytics"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold group-hover:text-indigo-600 transition-colors">Total Stored Data</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{formatBytes(totalStorageBytes)}</p>
          <span className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
            <span>View Recharts Breakdown →</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">System Operational Status</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">99.98%</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> All services operational
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Security Audit Events</span>
            <Shield className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Last logged {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Tab: Users Management (US-23 & US-24) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900 text-sm">
              User Accounts & Quota Allocations
            </h3>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Storage Usage / Quota</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const used = getUserUsageBytes(u.id);
                  const pct = Math.min(100, (used / u.storageQuotaBytes) * 100);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                            style={{ backgroundColor: u.avatarColor || '#3b82f6' }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                          className="bg-slate-100 border-none rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={u.status}
                          onChange={(e) => updateUserStatus(u.id, e.target.value as UserStatus)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider outline-none cursor-pointer ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : u.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="deactivated">Deactivated</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium text-slate-700">
                            {formatBytes(used)} / {formatBytes(u.storageQuotaBytes)}
                          </span>
                          <span className="font-bold text-slate-500">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-blue-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedUserForQuota(u);
                              setCustomQuotaGB((u.storageQuotaBytes / (1024 * 1024 * 1024)).toString());
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            Set Quota
                          </button>
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => switchUser(u.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Test drive as this user"
                            >
                              <LogIn className="w-3 h-3" />
                              <span>Switch</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Storage Usage Visualization using Recharts */}
      {activeTab === 'storage' && (
        <StorageUsageAnalytics 
          users={users}
          files={files}
          onAdjustQuota={(user) => {
            setSelectedUserForQuota(user);
            setCustomQuotaGB((user.storageQuotaBytes / (1024 * 1024 * 1024)).toString());
          }}
        />
      )}

      {/* Tab: System Health Monitoring (US-25) */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Service & Infrastructure Health
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-800">IndexedDB Blob Storage Subsystem</p>
                  <p className="text-slate-400 text-[11px]">Local persistence & high-throughput binary cache</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-[10px] uppercase">
                  Healthy
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-800">Cryptographic Integrity Validator</p>
                  <p className="text-slate-400 text-[11px]">SHA-256 automated digital fingerprinting</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-[10px] uppercase">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-800">Role-Based Access Guard (ABAC)</p>
                  <p className="text-slate-400 text-[11px]">Strict isolation of private folders and shared tokens</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-[10px] uppercase">
                  Enforced
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              Storage Capacity Thresholds & Alerts
            </h3>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-blue-900">
                <span>Platform Soft Threshold (80%)</span>
                <span>Active Warning</span>
              </div>
              <p className="text-blue-700 text-[11px]">
                Users who reach 80% of their allocated storage receive proactive in-app notices and guidance to free space.
              </p>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-red-900">
                <span>Hard Cap Limit (100%)</span>
                <span>Strict Blocking</span>
              </div>
              <p className="text-red-700 text-[11px]">
                Uploads that exceed user quota are safely halted before transfer, preventing storage exhaustion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security & Audit Logs (US-20, US-25) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                Security & Operation Audit Logs
              </h3>
              <p className="text-xs text-slate-400">Chronological history of file operations, logins, and permissions</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none"
              >
                <option value="all">All Events</option>
                <option value="security">Security & Alerts Only</option>
                <option value="auth">Authentication</option>
                <option value="files">File Operations</option>
                <option value="folders">Folder Operations</option>
              </select>

              <button
                onClick={refreshLogs}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Refresh Logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 font-mono text-[11px]">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()} {new Date(log.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {log.eventType}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {log.userEmail}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-sans">
                      {log.description}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.severity === 'security'
                          ? 'bg-purple-100 text-purple-700'
                          : log.severity === 'error'
                          ? 'bg-red-100 text-red-700'
                          : log.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quota Modal (US-24) */}
      {selectedUserForQuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-100">
            <h4 className="font-semibold text-slate-900 text-sm mb-1">
              Configure Storage Quota
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Set storage capacity limit for {selectedUserForQuota.name}
            </p>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {['1', '2', '5', '15'].map((gb) => (
                <button
                  key={gb}
                  type="button"
                  onClick={() => setCustomQuotaGB(gb)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    customQuotaGB === gb
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {gb} GB
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Custom Capacity (GB):
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={customQuotaGB}
              onChange={(e) => setCustomQuotaGB(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 mb-6"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUserForQuota(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuota}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Save Quota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
