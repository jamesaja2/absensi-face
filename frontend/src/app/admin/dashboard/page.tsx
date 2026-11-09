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
  Calendar,
  FileSpreadsheet,
  Users,
  Monitor,
  Shield,
  LogOut,
  Upload,
  RefreshCw,
  ExternalLink,
  Filter,
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

  // Filter states for attendance tab
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedKiosk, setSelectedKiosk] = useState('all');

  // Modals
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

  // Initial load
  useEffect(() => {
    Promise.all([
      loadAnalytics(),
      loadLogs(),
      loadUsers(),
      loadKiosks(),
      loadAdminUsers(),
    ]).finally(() => setLoading(false));

    const interval = setInterval(loadAnalytics, 20000);
    return () => clearInterval(interval);
  }, [loadAnalytics, loadLogs, loadUsers, loadKiosks, loadAdminUsers]);

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
    toast.success('Mengunduh laporan presensi Excel...');
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
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#64748B' }}>Memuat sistem dashboard...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'analytics', label: 'Analitikal & Statistik', icon: BarChart3 },
    { id: 'attendance', label: 'Log Absensi & Export', icon: FileSpreadsheet },
    { id: 'kiosks', label: 'Otorisasi Kiosk', icon: Monitor },
    { id: 'users', label: 'Data Wajah & Karyawan', icon: Users },
    { id: 'admins', label: 'Kelola Admin & Roles', icon: Shield },
    { id: 'import', label: 'Import CSV', icon: Upload },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Toaster position="top-center" />

      {/* ── TOPBAR NAVIGATION ─────────────────────────────────────── */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/logo.png" alt="Logo PUSTEKOM" style={{ height: 40 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Admin Portal Presensi Wajah
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                Multi-Kiosk Enterprise Management System
              </div>
            </div>
          </div>

          {/* User Profile & Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {currentUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#DBEAFE',
                    color: '#1D4ED8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    overflow: 'hidden',
                  }}
                >
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    currentUser.name?.charAt(0) || 'A'
                  )}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{currentUser.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase' }}>
                    {currentUser.role?.replace('_', ' ')}
                  </div>
                </div>
              </div>
            )}

            <a
              href="/"
              target="_blank"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#2563EB',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
              Buka Terminal Kiosk
            </a>

            <button
              id="admin-logout"
              onClick={handleLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div style={{ background: '#FFFFFF', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4 }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 18px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#2563EB' : '#64748B',
                    borderBottom: isActive ? '3px solid #2563EB' : '3px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.id === 'kiosks' && kiosks.filter(k => k.status === 'PENDING').length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#F59E0B', color: '#fff' }}>
                      {kiosks.filter(k => k.status === 'PENDING').length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── BODY CONTAINER ────────────────────────────────────────── */}
      <div style={{ maxWidth: 1320, margin: '0 auto', width: '100%', padding: '24px 24px 48px', flex: 1, boxSizing: 'border-box' }}>
        {/* TAB 1: ANALYTICS */}
        {activeTab === 'analytics' && (
          <AnalyticsTab data={analyticsData} onRefresh={loadAnalytics} />
        )}

        {/* TAB 2: ATTENDANCE LOGS & EXCEL EXPORT */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Filter Bar */}
            <div
              className="card"
              style={{
                padding: '18px 24px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  <Filter size={15} color="#64748B" />
                  <span>Rentang Tanggal:</span>
                </div>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                  title="Dari Tanggal"
                />

                <span style={{ color: '#94A3B8', fontSize: 13 }}>s/d</span>

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                  title="Sampai Tanggal"
                />

                {/* Kiosk Filter */}
                <select
                  value={selectedKiosk}
                  onChange={(e) => setSelectedKiosk(e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                >
                  <option value="all">Semua Kiosk Terminal</option>
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
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '7px 12px' }}
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* Excel Export Button */}
              <button
                onClick={handleExportExcel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#059669', // Emerald Green Excel theme
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                }}
              >
                <FileSpreadsheet size={16} />
                Unduh Rekap Excel (.xlsx)
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                  Data Karyawan & Wajah Terdaftar ({users.length})
                </h2>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Setiap foto karyawan dipelajari oleh model ArcFace GPU CompreFace untuk pengenalan real-time.
                </p>
              </div>

              <button
                id="add-user"
                onClick={() => {
                  setEditingUser(null);
                  setShowUserForm(true);
                }}
                className="btn btn-primary"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                + Tambah Karyawan Baru
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nama</th>
                    <th>Nomor Induk</th>
                    <th>Email</th>
                    <th>Total Presensi</th>
                    <th>Status Wajah</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#94A3B8' }}>
                        Belum ada data karyawan. Tambahkan manual atau import file CSV.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: '#EFF6FF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#2563EB',
                              border: '1px solid #DBEAFE',
                            }}
                          >
                            {user.photo_url ? (
                              <img
                                src={user.photo_url}
                                alt={user.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              user.name.charAt(0)
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>{user.name}</td>
                        <td style={{ fontFamily: 'monospace', color: '#475569' }}>{user.nomor_induk}</td>
                        <td style={{ color: '#64748B', fontSize: 13 }}>{user.email || '—'}</td>
                        <td style={{ fontWeight: 700, color: '#2563EB' }}>{user.total_attendance ?? 0}x</td>
                        <td>
                          {user.compreface_subject_id ? (
                            <span className="badge badge-success">Terdaftar (AI Model)</span>
                          ) : (
                            <span className="badge badge-danger">Belum Terdaftar</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowUserForm(true);
                              }}
                              className="btn btn-ghost"
                              style={{ padding: '6px 10px', fontSize: 12 }}
                              title="Edit Data"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="btn btn-danger"
                              style={{ padding: '6px 10px', fontSize: 12 }}
                              title="Hapus Karyawan"
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

        {/* TAB 5: ADMINS & ROLES */}
        {activeTab === 'admins' && (
          <AdminUsersTab
            admins={adminUsers}
            currentAdminEmail={currentUser?.email}
            onRefresh={loadAdminUsers}
          />
        )}

        {/* TAB 6: IMPORT CSV */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Import Dataset Karyawan dari File CSV
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                Upload file CSV dengan kolom header: <code>name, nomor_induk, email, photo_url</code>. Sistem akan mendaftarkan subject wajah ke database dan CompreFace secara otomatis.
              </p>
            </div>
            <CSVImporter onComplete={() => { loadUsers(); loadAnalytics(); }} />
          </div>
        )}
      </div>

      {/* User Form Modal */}
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
    </main>
  );
}
