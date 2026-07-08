'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, attendanceApi, User, AttendanceLog, TodayStats } from '@/lib/api';
import toast from 'react-hot-toast';
import AttendanceTable from '@/components/AttendanceTable';
import UserForm from '@/components/UserForm';
import CSVImporter from '@/components/CSVImporter';

type Tab = 'attendance' | 'users' | 'import';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('attendance');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [filterDate, setFilterDate] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.replace('/admin'); return; }
    authApi.verify().catch(() => {
      localStorage.removeItem('admin_token');
      router.replace('/admin');
    });
  }, [router]);

  const loadStats = useCallback(async () => {
    try {
      const res = await attendanceApi.getStatsToday();
      setStats(res.data);
    } catch { /* silent */ }
  }, []);

  const loadLogs = useCallback(async (date?: string) => {
    try {
      const res = await attendanceApi.getLogs({ date: date || undefined, limit: 200 });
      setLogs(res.data.logs);
      setLogsTotal(res.data.total);
    } catch (err: any) {
      toast.error('Gagal memuat data absensi');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await usersApi.getAll();
      setUsers(res.data.users);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadLogs(), loadUsers()]).finally(() => setLoading(false));
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats, loadLogs, loadUsers]);

  const handleFilterDate = (date: string) => {
    setFilterDate(date);
    loadLogs(date);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.replace('/admin');
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Hapus "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await usersApi.delete(user.id);
      toast.success(`Pengguna "${user.name}" berhasil dihapus`);
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus pengguna');
    }
  };

  const handleUserSaved = () => {
    setShowUserForm(false);
    setEditingUser(null);
    loadUsers();
    toast.success('Data pengguna berhasil disimpan');
  };

  const handleImportComplete = () => {
    loadUsers();
    loadStats();
    toast.success('Import CSV selesai');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-t-brand-primary border-white/10 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-dark-800 bg-grid flex flex-col">
      {/* ── TOPBAR ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-dark-800/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Admin Dashboard</h1>
              <p className="text-xs text-slate-500 mt-0.5">Sistem Absensi Pengenalan Wajah</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-dark-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Kiosk
            </a>
            <button
              id="admin-logout"
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-white hover:bg-red-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-6 flex-1">
        {/* ── STATS CARDS ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Hadir Hari Ini', value: stats?.totalAttendanceToday ?? '-', icon: '✓', color: 'brand-success', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-500/20' },
            { label: 'Total Karyawan', value: stats?.totalUsers ?? '-', icon: '👥', color: 'brand-accent', gradient: 'from-cyan-500/10 to-blue-500/10', border: 'border-cyan-500/20' },
            { label: 'Log Ditampilkan', value: logsTotal, icon: '📋', color: 'brand-primary', gradient: 'from-indigo-500/10 to-purple-500/10', border: 'border-indigo-500/20' },
            { label: 'Check-in Terakhir', value: stats?.latestLog ? new Date(stats.latestLog.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-', icon: '🕐', color: 'brand-warning', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-500/20' },
          ].map((card) => (
            <div key={card.label} className={`glass rounded-2xl p-5 bg-gradient-to-br ${card.gradient} border ${card.border}`}>
              <p className="text-2xl mb-1">{card.icon}</p>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ── TABS ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 glass rounded-xl w-fit">
          {([
            { id: 'attendance', label: 'Log Absensi', icon: '📋' },
            { id: 'users', label: 'Karyawan', icon: '👥' },
            { id: 'import', label: 'Import CSV', icon: '📤' },
          ] as { id: Tab; label: string; icon: string }[]).map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-brand-primary text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-dark-500'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────────────── */}
        <div className="flex-1">
          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Log Absensi</h2>
                <div className="flex items-center gap-3">
                  <input
                    id="filter-date"
                    type="date"
                    value={filterDate}
                    onChange={(e) => handleFilterDate(e.target.value)}
                    className="bg-dark-600 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-primary input-glow transition-all"
                  />
                  {filterDate && (
                    <button
                      onClick={() => handleFilterDate('')}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    id="export-csv"
                    onClick={() => attendanceApi.exportCSV({ date: filterDate || undefined })}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white border border-brand-primary/30 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>
              <AttendanceTable logs={logs} />
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Daftar Karyawan ({users.length})</h2>
                <button
                  id="add-user"
                  onClick={() => { setEditingUser(null); setShowUserForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:opacity-90 transition-all shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tambah Karyawan
                </button>
              </div>

              {/* Users Table */}
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Foto</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nama</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nomor Induk</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Absen</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status CompreFace</th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500">
                          Belum ada karyawan terdaftar. Tambah manual atau import CSV.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="table-row-hover transition-colors">
                          <td className="px-6 py-4">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-primary/20 border border-brand-primary/20 flex items-center justify-center">
                              {user.photo_url ? (
                                <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <span className="text-sm font-bold text-brand-primary">{user.name.charAt(0)}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-white">{user.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-400 font-mono">{user.nomor_induk}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-brand-accent">{user.total_attendance ?? 0}x</span>
                          </td>
                          <td className="px-6 py-4">
                            {user.compreface_subject_id ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium badge-hadir">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
                                Terdaftar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                Belum Terdaftar
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingUser(user); setShowUserForm(true); }}
                                className="p-2 rounded-lg text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Hapus"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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

          {/* Import CSV Tab */}
          {activeTab === 'import' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Import Dataset CSV</h2>
                <p className="text-sm text-slate-400 mt-1">Upload file CSV dengan kolom: <code className="text-brand-accent bg-dark-600 px-1 rounded">Name, Nomor Induk, Photo URL</code></p>
              </div>
              <CSVImporter onComplete={handleImportComplete} />
            </div>
          )}
        </div>
      </div>

      {/* ── USER FORM DRAWER ──────────────────────────────────────── */}
      {showUserForm && (
        <UserForm
          user={editingUser}
          onSave={handleUserSaved}
          onClose={() => { setShowUserForm(false); setEditingUser(null); }}
        />
      )}
    </main>
  );
}
