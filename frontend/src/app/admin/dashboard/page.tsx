'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  authApi,
  usersApi,
  attendanceApi,
  kiosksApi,
  adminUsersApi,
  User,
  AttendanceLog,
  AnalyticsData,
  Kiosk,
  AdminUser,
} from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import AttendanceTable from '@/components/AttendanceTable';
import UserForm from '@/components/UserForm';
import CSVImporter from '@/components/CSVImporter';
import AnalyticsTab from '@/components/AnalyticsTab';
import KiosksTab from '@/components/KiosksTab';
import AdminUsersTab from '@/components/AdminUsersTab';
import {
  BarChart3,
  FileSpreadsheet,
  Users,
  Monitor,
  ShieldCheck,
  LogOut,
  Upload,
  RefreshCw,
  ExternalLink,
  Filter,
  Cpu,
  Radio,
  ChevronRight,
  Database,
} from 'lucide-react';

type Tab = 'analytics' | 'attendance' | 'kiosks' | 'users' | 'admins' | 'import';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Data states
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedKiosk, setSelectedKiosk] = useState('all');

  // Modals
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Verify auth on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.replace('/admin');
      return;
    }

    authApi.getMe()
      .then((res) => {
        setCurrentUser(res.data.user);
      })
      .catch(() => {
        authApi.verify().catch(() => {
          localStorage.removeItem('admin_token');
          router.replace('/admin');
        });
      });
  }, [router]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await attendanceApi.getAnalytics();
      setAnalyticsData(res.data);
    } catch (e) {
      console.warn('Failed to load analytics:', e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await attendanceApi.getLogs({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        kiosk_id: selectedKiosk !== 'all' ? selectedKiosk : undefined,
        limit: 250,
      });
      setLogs(res.data.logs || []);
      setLogsTotal(res.data.total || 0);
    } catch {
      toast.error('Gagal memuat log presensi');
    }
  }, [startDate, endDate, selectedKiosk]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await usersApi.getAll();
      setUsers(res.data.users || []);
    } catch {}
  }, []);

  const loadKiosks = useCallback(async () => {
    try {
      const res = await kiosksApi.getAll();
      setKiosks(res.data.kiosks || []);
    } catch {}
  }, []);

  const loadAdminUsers = useCallback(async () => {
    try {
      const res = await adminUsersApi.getAll();
      setAdminUsers(res.data.admins || []);
    } catch {}
  }, []);

  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadAnalytics(),
      loadLogs(),
      loadUsers(),
      loadKiosks(),
      loadAdminUsers(),
    ]);
    setIsRefreshing(false);
  }, [loadAnalytics, loadLogs, loadUsers, loadKiosks, loadAdminUsers]);

  // Initial load
  useEffect(() => {
    refreshAllData().finally(() => setLoading(false));
    const interval = setInterval(loadAnalytics, 20000);
    return () => clearInterval(interval);
  }, [refreshAllData, loadAnalytics]);

  // Reload logs when filters change
  useEffect(() => {
    loadLogs();
  }, [startDate, endDate, selectedKiosk, loadLogs]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.replace('/admin');
  };

  const handleExportExcel = () => {
    attendanceApi.exportExcel({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      kiosk_id: selectedKiosk,
    });
    toast.success('File Excel sedang diunduh');
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Hapus "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await usersApi.delete(user.id);
      toast.success(`"${user.name}" berhasil dihapus`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  };

  const handleUserSaved = () => {
    setShowUserForm(false);
    setEditingUser(null);
    loadUsers();
    toast.success('Data karyawan disimpan');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-300 font-mono text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span>INITIALIZING ENTERPRISE DASHBOARD...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'analytics' as Tab, label: 'Overview & Metrics', icon: BarChart3, badge: null },
    { id: 'attendance' as Tab, label: 'Presensi Logs & Export', icon: FileSpreadsheet, badge: logsTotal > 0 ? String(logsTotal) : null },
    { id: 'kiosks' as Tab, label: 'Kiosks & Hardware', icon: Monitor, badge: kiosks.filter(k => k.status === 'PENDING').length > 0 ? `${kiosks.filter(k => k.status === 'PENDING').length} PENDING` : null },
    { id: 'users' as Tab, label: 'Data Karyawan & Wajah', icon: Users, badge: users.length > 0 ? String(users.length) : null },
    { id: 'admins' as Tab, label: 'Admin Accounts & Roles', icon: ShieldCheck, badge: null },
    { id: 'import' as Tab, label: 'CSV Dataset Importer', icon: Upload, badge: null },
  ];

  const pendingKiosksCount = kiosks.filter(k => k.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans selection:bg-blue-600 selection:text-white">
      <Toaster position="top-center" />

      {/* ── SIDEBAR NAVIGATION (Enterprise SaaS Style) ──────────────── */}
      <aside className="w-64 bg-[#0F172A] border-r border-slate-800 text-slate-300 flex flex-col justify-between shrink-0 select-none z-30">
        <div>
          {/* Workspace / Organization Switcher */}
          <div className="p-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/30">
                <Cpu size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white tracking-tight truncate">PUSTEKOM OS</div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Production Gateway</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 py-2 font-semibold">
              Platform Modules
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        item.id === 'kiosks' && pendingKiosksCount > 0
                          ? 'bg-amber-500 text-black'
                          : isActive
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Card */}
        <div className="p-3 border-t border-slate-800/80 bg-[#090D16]/50">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser?.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  currentUser?.name?.charAt(0) || 'A'
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{currentUser?.name || 'Administrator'}</div>
                <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-bold">
                  {currentUser?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
              title="Logout Session"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top App Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-slate-900 tracking-tight">
              {navItems.find(i => i.id === activeTab)?.label}
            </div>
            <span className="text-slate-300">•</span>
            <div className="text-xs text-slate-500 font-mono">
              ArcFace GPU + MiniFASNet v2 Engine
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAllData}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200 transition-all text-xs font-medium flex items-center gap-1.5"
              title="Refresh Data"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>

            <a
              href="/"
              target="_blank"
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>Terminal Kiosk</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </header>

        {/* Tab Canvas */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsTab data={analyticsData} onRefresh={loadAnalytics} />
          )}

          {/* TAB 2: ATTENDANCE & EXCEL EXPORT */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Filter & Export Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase font-mono text-[11px]">
                    <Filter size={13} className="text-slate-400" />
                    <span>Filter Range:</span>
                  </div>

                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    title="Start Date"
                  />
                  <span className="text-slate-400 font-mono">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    title="End Date"
                  />

                  <select
                    value={selectedKiosk}
                    onChange={(e) => setSelectedKiosk(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="all">Semua Kiosk Hardware</option>
                    {kiosks.map((k) => (
                      <option key={k.kiosk_id} value={k.kiosk_id}>
                        {k.name || k.kiosk_id}
                      </option>
                    ))}
                  </select>

                  {(startDate || endDate || selectedKiosk !== 'all') && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setSelectedKiosk('all');
                      }}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-xs transition-colors"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                {/* Export Excel Button */}
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-lg font-semibold text-xs flex items-center gap-2 shadow-sm shadow-emerald-700/20 transition-all"
                >
                  <FileSpreadsheet size={15} />
                  <span>Unduh Rekap Excel (.xlsx)</span>
                </button>
              </div>

              {/* Attendance Table */}
              <AttendanceTable logs={logs} />
            </div>
          )}

          {/* TAB 3: KIOSKS MANAGEMENT */}
          {activeTab === 'kiosks' && (
            <KiosksTab kiosks={kiosks} onRefresh={loadKiosks} />
          )}

          {/* TAB 4: USERS / EMPLOYEES */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Data Wajah & Karyawan Terdaftar ({users.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Model biometrik ArcFace mempelajari embedding wajah untuk setiap karyawan yang terdaftar.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingUser(null);
                    setShowUserForm(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>+ Tambah Karyawan Baru</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-mono uppercase text-slate-500">
                      <th className="py-3 px-4 w-12">Foto</th>
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">Nomor Induk</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Total Presensi</th>
                      <th className="py-3 px-4">Status AI Model</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Belum ada karyawan terdaftar. Tambah manual atau import file CSV.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                              {user.photo_url ? (
                                <img
                                  src={user.photo_url}
                                  alt={user.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                user.name.charAt(0)
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{user.name}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{user.nomor_induk}</td>
                          <td className="py-2.5 px-4 text-slate-500">{user.email || '—'}</td>
                          <td className="py-2.5 px-4 font-bold text-blue-600 font-mono">{user.total_attendance ?? 0}x</td>
                          <td className="py-2.5 px-4">
                            {user.compreface_subject_id ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                ● Trained (Active)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                Belum Terdaftar
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowUserForm(true);
                                }}
                                className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-medium"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ADMIN USERS */}
          {activeTab === 'admins' && (
            <AdminUsersTab
              admins={adminUsers}
              currentAdminEmail={currentUser?.email}
              onRefresh={loadAdminUsers}
            />
          )}

          {/* TAB 6: CSV IMPORTER */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Import Dataset Karyawan dari File CSV
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format header CSV yang didukung: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">name, nomor_induk, email, photo_url</code>.
                </p>
              </div>
              <CSVImporter onComplete={() => { loadUsers(); loadAnalytics(); }} />
            </div>
          )}
        </div>
      </div>

      {/* User Form Drawer Modal */}
      {showUserForm && (
        <UserForm
          user={editingUser}
          onSave={handleUserSaved}
          onClose={() => {
            setShowUserForm(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
