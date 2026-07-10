'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, usersApi, attendanceApi, User, AttendanceLog, TodayStats } from '@/lib/api';
import toast from 'react-hot-toast';
import AttendanceTable from '@/components/AttendanceTable';
import UserForm from '@/components/UserForm';
import CSVImporter from '@/components/CSVImporter';

type Tab = 'attendance' | 'users' | 'import';

function parseDbTimestamp(ts: string): Date {
  const normalized = ts.replace(' ', 'T');
  if (normalized.endsWith('Z') || normalized.includes('+')) return new Date(normalized);
  return new Date(normalized + 'Z'); // DB stores UTC without timezone suffix
}

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

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.replace('/admin'); return; }
    authApi.verify().catch(() => {
      localStorage.removeItem('admin_token');
      router.replace('/admin');
    });
  }, [router]);

  const loadStats = useCallback(async () => {
    try { const res = await attendanceApi.getStatsToday(); setStats(res.data); } catch { }
  }, []);

  const loadLogs = useCallback(async (date?: string) => {
    try {
      const res = await attendanceApi.getLogs({ date: date || undefined, limit: 200 });
      setLogs(res.data.logs);
      setLogsTotal(res.data.total);
    } catch { toast.error('Gagal memuat data absensi'); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { const res = await usersApi.getAll(); setUsers(res.data.users); } catch { }
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadLogs(), loadUsers()]).finally(() => setLoading(false));
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats, loadLogs, loadUsers]);

  const handleFilterDate = (date: string) => { setFilterDate(date); loadLogs(date); };
  const handleLogout = () => { localStorage.removeItem('admin_token'); router.replace('/admin'); };

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

  const handleUserSaved = () => { setShowUserForm(false); setEditingUser(null); loadUsers(); toast.success('Data disimpan'); };
  const handleImportComplete = () => { loadUsers(); loadStats(); };

  const lastCheckinTime = stats?.latestLog
    ? parseDbTimestamp(stats.latestLog.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : '—';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Memuat data...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attendance', label: 'Log Absensi' },
    { id: 'users', label: 'Karyawan' },
    { id: 'import', label: 'Import CSV' },
  ];

  const statCards = [
    { label: 'Hadir Hari Ini', value: stats?.totalAttendanceToday ?? '—' },
    { label: 'Total Karyawan', value: stats?.totalUsers ?? '—' },
    { label: 'Log Ditampilkan', value: logsTotal },
    { label: 'Check-in Terakhir', value: lastCheckinTime },
  ];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOPBAR ─────────────────────────────────────────────── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Logo PUSTEKOM" style={{ height: 36 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>Admin Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sistem Absensi Kapel PUSTEKOM by James</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/" target="_blank" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Kiosk
            </a>
            <button id="admin-logout" onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

        {/* ── STATS ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {statCards.map((card) => (
            <div key={card.label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* ── TABS ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)', gap: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ───────────────────────────────────────────── */}

        {/* Attendance */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Log Absensi</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => handleFilterDate(e.target.value)}
                  className="input"
                  style={{ width: 'auto', padding: '7px 12px' }}
                />
                {filterDate && (
                  <button onClick={() => handleFilterDate('')} className="btn btn-secondary" style={{ fontSize: 12 }}>
                    Reset
                  </button>
                )}
                <button
                  id="export-csv"
                  onClick={() => attendanceApi.exportCSV({ date: filterDate || undefined })}
                  className="btn btn-primary"
                  style={{ fontSize: 12 }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
            <AttendanceTable logs={logs} />
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Daftar Karyawan <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>({users.length})</span>
              </h2>
              <button
                id="add-user"
                onClick={() => { setEditingUser(null); setShowUserForm(true); }}
                className="btn btn-primary"
                style={{ fontSize: 12 }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah Karyawan
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nama</th>
                    <th>Nomor Induk</th>
                    <th>Total Absen</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-muted)' }}>
                        Belum ada karyawan terdaftar. Tambah manual atau import CSV.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>
                            {user.photo_url
                              ? <img src={user.photo_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : user.name.charAt(0)
                            }
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{user.name}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{user.nomor_induk}</td>
                        <td style={{ fontWeight: 600 }}>{user.total_attendance ?? 0}x</td>
                        <td>
                          {user.compreface_subject_id
                            ? <span className="badge badge-success">Terdaftar</span>
                            : <span className="badge badge-danger">Belum Terdaftar</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              onClick={() => { setEditingUser(user); setShowUserForm(true); }}
                              className="btn btn-ghost"
                              style={{ padding: '6px 8px' }}
                              title="Edit"
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="btn btn-danger"
                              style={{ padding: '6px 8px' }}
                              title="Hapus"
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

        {/* Import CSV */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Import Dataset CSV</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Upload file CSV dengan kolom: <code style={{ background: 'var(--color-bg)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>Name, Nomor Induk, Photo URL</code>
              </p>
            </div>
            <CSVImporter onComplete={handleImportComplete} />
          </div>
        )}
      </div>

      {/* User Form Modal */}
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
