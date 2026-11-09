'use client';

import { useState } from 'react';
import { AdminUser, adminUsersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Shield, UserPlus, Trash2, Check, X, ShieldAlert, UserCheck } from 'lucide-react';

interface AdminUsersTabProps {
  admins: AdminUser[];
  currentAdminEmail?: string;
  onRefresh: () => void;
}

export default function AdminUsersTab({ admins, currentAdminEmail, onRefresh }: AdminUsersTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'admin' | 'operator'>('admin');
  const [submitting, setSubmitting] = useState(false);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) {
      toast.error('Email dan nama wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      await adminUsersApi.create({
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        role: newRole,
      });
      toast.success('Admin baru berhasil didaftarkan');
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      setNewRole('admin');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menambahkan admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    const nextStatus = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminUsersApi.update(admin.id, { status: nextStatus });
      toast.success(`Akun ${admin.name} sekarang ${nextStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengubah status');
    }
  };

  const handleChangeRole = async (admin: AdminUser, newRoleValue: string) => {
    try {
      await adminUsersApi.update(admin.id, { role: newRoleValue });
      toast.success(`Role ${admin.name} diubah menjadi ${newRoleValue}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengubah role');
    }
  };

  const handleDelete = async (admin: AdminUser) => {
    if (!confirm(`Hapus hak akses admin untuk "${admin.name}" (${admin.email})?`)) return;
    try {
      await adminUsersApi.delete(admin.id);
      toast.success('Admin berhasil dihapus');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus admin');
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'super_admin') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: '#F5F3FF', color: '#7C3AED', fontSize: 11, fontWeight: 700 }}>
          <ShieldAlert size={12} /> SUPER ADMIN
        </span>
      );
    } else if (role === 'admin') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: '#EFF6FF', color: '#2563EB', fontSize: 11, fontWeight: 700 }}>
          <Shield size={12} /> ADMIN
        </span>
      );
    } else {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: '#F0FDF4', color: '#16A34A', fontSize: 11, fontWeight: 700 }}>
          <UserCheck size={12} /> OPERATOR
        </span>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
            Manajemen Akun Administrator & Hak Akses
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Kelola admin yang memiliki wewenang mengakses panel dashboard, menyetujui kiosk, dan mengunduh laporan presensi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <UserPlus size={14} /> Tambah Admin
        </button>
      </div>

      {/* Admin Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 56 }}>Foto</th>
                <th>Nama Administrator</th>
                <th>Email Akun (Google / Login)</th>
                <th>Tingkat Role</th>
                <th>Status Akun</th>
                <th>Terdaftar Pada</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#94A3B8' }}>
                    Belum ada data admin terdaftar.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const isCurrent = Boolean(currentAdminEmail && adm.email.toLowerCase() === currentAdminEmail.toLowerCase());
                  return (
                    <tr key={adm.id}>
                      <td>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: '#F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#334155',
                          }}
                        >
                          {adm.avatar_url ? (
                            <img src={adm.avatar_url} alt={adm.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            adm.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {adm.name} {isCurrent && <span style={{ fontSize: 11, color: '#2563EB', marginLeft: 4 }}>(Anda)</span>}
                      </td>

                      <td style={{ color: '#475569', fontSize: 13 }}>{adm.email}</td>

                      <td>
                        <select
                          value={adm.role}
                          onChange={(e) => handleChangeRole(adm, e.target.value)}
                          disabled={adm.role === 'super_admin' && admins.filter(a => a.role === 'super_admin').length <= 1}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            fontSize: 12,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="operator">Operator / Viewer</option>
                        </select>
                      </td>

                      <td>
                        <button
                          onClick={() => handleToggleStatus(adm)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {adm.status === 'ACTIVE' ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#ECFDF5', color: '#059669' }}>
                              AKTIF
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#F1F5F9', color: '#64748B' }}>
                              NONAKTIF
                            </span>
                          )}
                        </button>
                      </td>

                      <td style={{ color: '#64748B', fontSize: 12 }}>
                        {new Date(adm.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleDelete(adm)}
                            disabled={isCurrent}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              cursor: isCurrent ? 'not-allowed' : 'pointer',
                              opacity: isCurrent ? 0.3 : 1,
                            }}
                            title="Hapus Hak Akses Admin"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
              Tambah Administrator Baru
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
              Masukkan alamat email Google akun yang akan diizinkan login sebagai administrator.
            </p>

            <form onSubmit={handleAddAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Alamat Email (Akun Google)
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="budi@example.com"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Tingkat Hak Akses (Role)
                </label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="admin">Admin (Kelola User, Kiosk & Export)</option>
                  <option value="super_admin">Super Admin (Akses Penuh Termasuk Kelola Admin)</option>
                  <option value="operator">Operator / Viewer (Lihat & Export Presensi Saja)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : 'Tambahkan Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
