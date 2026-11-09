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
  UserCheck,
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

    authApi
      .getMe()
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
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center text-slate-600 font-sans text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>Memuat Dashboard PUSTEKOM...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'analytics' as Tab, label: 'Ringkasan & Metrik', icon: BarChart3, badge: null },
    { id: 'attendance' as Tab, label: 'Log Presensi & Export', icon: FileSpreadsheet, badge: logsTotal > 0 ? String(logsTotal) : null },
    {
      id: 'kiosks' as Tab,
      label: 'Terminal Kiosk',
      icon: Monitor,
      badge:
        kiosks.filter((k) => k.status === 'PENDING').length > 0
          ? `${kiosks.filter((k) => k.status === 'PENDING').length} PENDING`
          : null,
    },
    { id: 'users' as Tab, label: 'Data Karyawan & Wajah', icon: Users, badge: users.length > 0 ? String(users.length) : null },
    { id: 'admins' as Tab, label: 'Akun Admin & Roles', icon: ShieldCheck, badge: null },
    { id: 'import' as Tab, label: 'Import CSV', icon: Upload, badge: null },
  ];

  const pendingKiosksCount = kiosks.filter((k) => k.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-slate-800 flex flex-col font-sans select-none">
      <Toaster position="top-center" />

      {/* ── TOP HEADER (Cloudflare Style Navbar) ────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="PUSTEKOM" className="h-9 object-contain" />
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-900">PUSTEKOM</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 font-medium">Dashboard Presensi</span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={refreshAllData}
            disabled={isRefreshing}
            className="px-3 py-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            title="Sinkronisasi Data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <a
            href="/"
            target="_blank"
            className="px-3 py-1.5 bg-[#0051C3] hover:bg-[#0045A5] text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>Buka Kiosk</span>
            <ExternalLink size={12} />
          </a>

          <div className="h-6 w-px bg-slate-200" />

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentUser?.name || 'Administrator'}
                </div>
                <div className="text-[10px] text-blue-700 font-semibold uppercase">
                  {currentUser?.role?.replace('_', ' ') || 'ADMIN'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors"
              title="Keluar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── HORIZONTAL SUB-NAVBAR TABS (Cloudflare Style) ────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto shadow-2xs">
        <nav className="flex space-x-1 sm:space-x-4 max-w-7xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`py-3.5 px-3 inline-flex items-center gap-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#0051C3] text-[#0051C3]'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.id === 'kiosks' && pendingKiosksCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : isActive
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600'
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

      {/* ── MAIN CONTENT WORKSPACE ──────────────────────────────────── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: ANALYTICS OVERVIEW */}
        {activeTab === 'analytics' && (
          <AnalyticsTab data={analyticsData} onRefresh={loadAnalytics} />
        )}

        {/* TAB 2: ATTENDANCE LOGS & EXPORT */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                  <Filter size={14} />
                  <span>Filter:</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-slate-600">Dari:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-slate-600">Sampai:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800 outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-slate-600">Kiosk:</label>
                  <select
                    value={selectedKiosk}
                    onChange={(e) => setSelectedKiosk(e.target.value)}
                    className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800 outline-none focus:border-blue-600"
                  >
                    <option value="all">Semua Kiosk</option>
                    {kiosks.map((k) => (
                      <option key={k.id} value={k.kiosk_id}>
                        {k.name || k.kiosk_id}
                      </option>
                    ))}
                  </select>
                </div>

                {(startDate || endDate || selectedKiosk !== 'all') && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setSelectedKiosk('all');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Export Excel Button */}
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs flex items-center gap-2 shadow-sm transition-colors"
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
                  Model biometrik ArcFace menyimpan embedding wajah untuk setiap karyawan yang terdaftar.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingUser(null);
                  setShowUserForm(true);
                }}
                className="px-3.5 py-2 bg-[#0051C3] hover:bg-[#0045A5] text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span>+ Tambah Karyawan Baru</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
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
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                            {user.photo_url ? (
                              <img
                                src={user.photo_url}
                                alt={user.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              user.name.charAt(0)
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{user.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{user.nomor_induk}</td>
                        <td className="py-2.5 px-4 text-slate-500">{user.email || '—'}</td>
                        <td className="py-2.5 px-4 font-bold text-blue-600 font-mono">
                          {user.total_attendance ?? 0}x
                        </td>
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
                Format header CSV yang didukung:{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">
                  name, nomor_induk, email, photo_url
                </code>
                .
              </p>
            </div>
            <CSVImporter
              onComplete={() => {
                loadUsers();
                loadAnalytics();
              }}
            />
          </div>
        )}
      </main>

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
