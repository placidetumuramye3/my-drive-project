import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Archive, 
  Code, 
  File, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  PieChart as PieIcon, 
  BarChart2, 
  TrendingUp, 
  Users,
  Info
} from 'lucide-react';
import { User, FileItem, FileCategory } from '../../types/drive';
import { formatBytes } from '../../services/db';

interface StorageUsageAnalyticsProps {
  users: User[];
  files: FileItem[];
  onAdjustQuota: (user: User) => void;
}

interface CategoryConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
}

const CATEGORY_MAP: Record<FileCategory, CategoryConfig> = {
  document: {
    label: 'Documents & PDFs',
    color: '#3b82f6', // blue
    icon: <FileText className="w-4 h-4 text-blue-500" />
  },
  image: {
    label: 'Images & Photos',
    color: '#10b981', // emerald
    icon: <ImageIcon className="w-4 h-4 text-emerald-500" />
  },
  video: {
    label: 'Videos & Media',
    color: '#8b5cf6', // purple
    icon: <Film className="w-4 h-4 text-purple-500" />
  },
  audio: {
    label: 'Audio & Music',
    color: '#f59e0b', // amber
    icon: <Music className="w-4 h-4 text-amber-500" />
  },
  archive: {
    label: 'Archives & ZIPs',
    color: '#ec4899', // pink
    icon: <Archive className="w-4 h-4 text-pink-500" />
  },
  code: {
    label: 'Code & Scripts',
    color: '#06b6d4', // cyan
    icon: <Code className="w-4 h-4 text-cyan-500" />
  },
  other: {
    label: 'Other Files',
    color: '#64748b', // slate
    icon: <File className="w-4 h-4 text-slate-500" />
  }
};

export const StorageUsageAnalytics: React.FC<StorageUsageAnalyticsProps> = ({
  users,
  files,
  onAdjustQuota
}) => {
  const [userUnit, setUserUnit] = useState<'MB' | 'GB'>('MB');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Active non-deleted files
  const activeFiles = useMemo(() => files.filter(f => !f.isDeleted), [files]);
  const totalStoredBytes = useMemo(() => activeFiles.reduce((acc, f) => acc + f.sizeBytes, 0), [activeFiles]);
  const totalQuotaBytes = useMemo(() => users.reduce((acc, u) => acc + u.storageQuotaBytes, 0), [users]);
  const platformUtilizationPct = totalQuotaBytes > 0 
    ? Math.min(100, Math.round((totalStoredBytes / totalQuotaBytes) * 100))
    : 0;

  // 1. Group by File Type / Category
  const categoryData = useMemo(() => {
    const map: Record<FileCategory, { count: number; bytes: number }> = {
      document: { count: 0, bytes: 0 },
      image: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      archive: { count: 0, bytes: 0 },
      code: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    };

    activeFiles.forEach(file => {
      const cat = file.category in map ? file.category : 'other';
      map[cat].count += 1;
      map[cat].bytes += file.sizeBytes;
    });

    return Object.entries(map).map(([key, val]) => {
      const cat = key as FileCategory;
      const config = CATEGORY_MAP[cat];
      const pct = totalStoredBytes > 0 ? (val.bytes / totalStoredBytes) * 100 : 0;
      return {
        key: cat,
        name: config.label,
        value: val.bytes,
        formattedSize: formatBytes(val.bytes),
        count: val.count,
        percentage: Number(pct.toFixed(1)),
        color: config.color,
        icon: config.icon
      };
    }).sort((a, b) => b.value - a.value);
  }, [activeFiles, totalStoredBytes]);

  // Non-zero category slices for the Pie chart (or fallback if empty)
  const pieChartData = useMemo(() => {
    const withData = categoryData.filter(d => d.value > 0);
    if (withData.length === 0) {
      return [{
        key: 'other' as FileCategory,
        name: 'No data stored yet',
        value: 1,
        formattedSize: '0 B',
        count: 0,
        percentage: 0,
        color: '#cbd5e1',
        icon: <File className="w-4 h-4 text-slate-400" />
      }];
    }
    return withData;
  }, [categoryData]);

  // 2. Storage Consumed by User vs. Quotas
  const userData = useMemo(() => {
    const divisor = userUnit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024;

    return users.map(user => {
      const userFiles = activeFiles.filter(f => f.ownerId === user.id);
      const usedBytes = userFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
      const quotaBytes = user.storageQuotaBytes;
      const pct = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

      const usedValue = Number((usedBytes / divisor).toFixed(2));
      const quotaValue = Number((quotaBytes / divisor).toFixed(2));
      const freeValue = Math.max(0, Number((quotaValue - usedValue).toFixed(2)));

      let status: 'normal' | 'warning' | 'danger' = 'normal';
      if (pct >= 100) status = 'danger';
      else if (pct >= 80) status = 'warning';

      return {
        userId: user.id,
        user,
        shortName: user.name.split(' ')[0] || user.name,
        name: user.name,
        email: user.email,
        role: user.role,
        fileCount: userFiles.length,
        usedBytes,
        quotaBytes,
        usedValue,
        quotaValue,
        freeValue,
        formattedUsed: formatBytes(usedBytes),
        formattedQuota: formatBytes(quotaBytes),
        utilizationPct: Math.min(100, Math.round(pct)),
        status
      };
    }).sort((a, b) => b.usedBytes - a.usedBytes);
  }, [users, activeFiles, userUnit]);

  // Users nearing or exceeding quota
  const atRiskUsers = useMemo(() => {
    return userData.filter(u => u.status === 'warning' || u.status === 'danger');
  }, [userData]);

  // Custom Recharts Tooltip for File Category Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 min-w-[170px]">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4">
            <span>Space Used:</span>
            <span className="font-semibold text-white">{data.formattedSize}</span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4">
            <span>Files:</span>
            <span className="font-semibold text-white">{data.count} file{data.count === 1 ? '' : 's'}</span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4">
            <span>Share of Total:</span>
            <span className="font-semibold text-emerald-400">{data.percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Recharts Tooltip for User Quota Bar Chart
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[210px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div>
              <p className="font-bold text-white">{entry.name}</p>
              <p className="text-[10px] text-slate-400">{entry.email}</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              entry.status === 'danger'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : entry.status === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {entry.utilizationPct}% Used
            </span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4 pt-1">
            <span>Used Storage:</span>
            <span className="font-bold text-white">{entry.formattedUsed}</span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4">
            <span>Quota Allocated:</span>
            <span className="font-bold text-slate-300">{entry.formattedQuota}</span>
          </div>
          <div className="text-slate-300 flex justify-between gap-4">
            <span>Files Owned:</span>
            <span className="font-semibold text-white">{entry.fileCount}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Platform Storage Telemetry Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <HardDrive className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-Time Storage Telemetry</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white">
              Platform Storage & Quota Distribution
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Monitor physical storage consumption segmented by document file types and track individual user quota consumption to prevent drive capacity exhaustion.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stored Data</span>
                <span className="text-base font-bold text-white">{formatBytes(totalStoredBytes)}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Quota Allocated</span>
                <span className="text-base font-bold text-white">{formatBytes(totalQuotaBytes)}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Files</span>
                <span className="text-base font-bold text-white">{activeFiles.length} files</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tracked Accounts</span>
                <span className="text-base font-bold text-white">{users.length} users</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-blue-400" />
                Global Capacity Utilization
              </span>
              <span className="font-bold text-blue-300">{platformUtilizationPct}% of Quotas</span>
            </div>

            {/* Platform Progress Bar */}
            <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  platformUtilizationPct >= 90
                    ? 'bg-gradient-to-r from-red-500 to-rose-400'
                    : platformUtilizationPct >= 75
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                }`}
                style={{ width: `${Math.max(2, platformUtilizationPct)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{formatBytes(totalStoredBytes)} used</span>
              <span>{formatBytes(Math.max(0, totalQuotaBytes - totalStoredBytes))} free across quotas</span>
            </div>

            {atRiskUsers.length > 0 ? (
              <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-2.5 flex items-center gap-2 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>{atRiskUsers.length} user{atRiskUsers.length === 1 ? '' : 's'}</strong> approaching or exceeding storage quota limit.
                </span>
              </div>
            ) : (
              <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All user accounts are operating safely within allocated quotas.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Dual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart 1: Space Consumed by File Type */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <PieIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Storage by File Type</h4>
                  <p className="text-[11px] text-slate-400">Disk space distribution by media category</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                {activeFiles.length} files
              </span>
            </div>

            {/* Recharts Pie Chart */}
            <div className="h-64 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={800}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Center donut label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</span>
                <span className="text-sm font-extrabold text-slate-800">{formatBytes(totalStoredBytes)}</span>
              </div>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="space-y-2 pt-2 border-t border-slate-100 max-h-52 overflow-y-auto pr-1">
            {categoryData.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <div 
                  key={cat.key}
                  onClick={() => setSelectedCategory(isSelected ? null : cat.key)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: cat.color }} 
                    />
                    <div className="flex items-center gap-1.5 truncate">
                      {cat.icon}
                      <span className="font-semibold text-slate-800 truncate">{cat.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <span className="text-[11px] text-slate-400">
                      {cat.count} {cat.count === 1 ? 'file' : 'files'}
                    </span>
                    <span className="font-bold text-slate-900 w-16 text-right">
                      {cat.formattedSize}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 w-12 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Space Consumed by User vs. Quotas */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">User Storage & Quota Allocation</h4>
                  <p className="text-[11px] text-slate-400">Space consumed compared with quota limit per account</p>
                </div>
              </div>

              {/* Unit Toggle & Legend */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setUserUnit('MB')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      userUnit === 'MB' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MB
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserUnit('GB')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      userUnit === 'GB' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    GB
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={userData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    unit={` ${userUnit}`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                  />
                  <Bar 
                    dataKey="usedValue" 
                    name={`Used Space (${userUnit})`} 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="quotaValue" 
                    name={`Storage Quota (${userUnit})`} 
                    fill="#e2e8f0" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Blue bar displays active data stored. Gray bar represents maximum allocated storage quota.
            </span>
            <span className="font-semibold text-slate-700">
              {userData.length} Registered Accounts
            </span>
          </div>
        </div>

      </div>

      {/* Quota Management & Audit Monitoring Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Account Storage & Quota Breakdown</h4>
              <p className="text-xs text-slate-400">Detailed space consumption and quota adjustment shortcuts</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">User Account</th>
                <th className="py-3 px-4">Files Stored</th>
                <th className="py-3 px-4">Used Space</th>
                <th className="py-3 px-4">Quota Limit</th>
                <th className="py-3 px-4 min-w-[200px]">Quota Utilization</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userData.map((u) => {
                return (
                  <tr key={u.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: u.user.avatarColor || '#3b82f6' }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{u.name}</p>
                          <p className="text-slate-400 text-[11px] truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {u.fileCount} file{u.fileCount === 1 ? '' : 's'}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      {u.formattedUsed}
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {u.formattedQuota}
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700">{u.utilizationPct}%</span>
                          <span className="text-slate-400">
                            {formatBytes(Math.max(0, u.quotaBytes - u.usedBytes))} remaining
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              u.status === 'danger'
                                ? 'bg-red-500'
                                : u.status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(2, u.utilizationPct))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {u.status === 'danger' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3" /> Exceeded (100%)
                        </span>
                      ) : u.status === 'warning' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Warning ({u.utilizationPct}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Normal
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onAdjustQuota(u.user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 hover:border-blue-300"
                        title="Adjust storage quota allocation"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Adjust Quota</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
