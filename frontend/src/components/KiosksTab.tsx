'use client';

import { useState } from 'react';
import { Kiosk, kiosksApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Check, X, Edit2, Trash2, Monitor, ShieldCheck, AlertCircle } from 'lucide-react';

interface KiosksTabProps {
  kiosks: Kiosk[];
  onRefresh: () => void;
}

export default function KiosksTab({ kiosks, onRefresh }: KiosksTabProps) {
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleUpdateStatus = async (kioskId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    setLoadingId(kioskId);
    try {
      await kiosksApi.update(kioskId, { status });
      toast.success(`Kiosk ${status === 'APPROVED' ? 'berhasil disetujui (Approved)' : 'ditolak'}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengubah status kiosk');
    } finally {
      setLoadingId(null);
    }
  };

  const handleSaveName = async () => {
    if (!editingKiosk || !editName.trim()) return;
    try {
      await kiosksApi.update(editingKiosk.kiosk_id, { name: editName.trim() });
      toast.success('Nama kiosk diperbarui');
      setEditingKiosk(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan nama');
    }
  };

  const handleDelete = async (kiosk: Kiosk) => {
    if (!confirm(`Hapus kiosk "${kiosk.name || kiosk.kiosk_id}"?`)) return;
    try {
      await kiosksApi.delete(kiosk.kiosk_id);
      toast.success('Kiosk berhasil dihapus');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menghapus kiosk');
    }
  };

  const formatLastSeen = (ts: string | null) => {
    if (!ts) return 'Belum pernah';
    return new Date(ts).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
            Manajemen Otorisasi Kiosk Terminal
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
            Hanya Kiosk dengan status <strong>APPROVED</strong> yang dapat merekam absensi kehadiran. Kiosk yang belum di-acc hanya berfungsi dalam mode pemeriksaan (cek status jam berapa sudah absen).
          </p>
        </div>

        <button onClick={onRefresh} className="btn btn-secondary" style={{ fontSize: 12 }}>
          Segarkan Data
        </button>
      </div>

      {/* Kiosks Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Nama Kiosk</th>
                <th>Kiosk ID</th>
                <th>IP Address</th>
                <th>Terakhir Online</th>
                <th>Presensi Hari Ini</th>
                <th>Total Presensi</th>
                <th style={{ textAlign: 'right' }}>Aksi Persetujuan</th>
              </tr>
            </thead>
            <tbody>
              {kiosks.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#94A3B8' }}>
                    Belum ada terminal kiosk yang terhubung. Buka halaman utama terminal untuk mendaftarkan kiosk baru secara otomatis.
                  </td>
                </tr>
              ) : (
                kiosks.map((k) => {
                  const isApproved = k.status === 'APPROVED';
                  const isPending = k.status === 'PENDING';
                  const isRejected = k.status === 'REJECTED';

                  return (
                    <tr key={k.id}>
                      <td>
                        {isApproved && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#ECFDF5',
                              color: '#059669',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <ShieldCheck size={12} /> APPROVED
                          </span>
                        )}
                        {isPending && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#FEF3C7',
                              color: '#B45309',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <AlertCircle size={12} /> PENDING
                          </span>
                        )}
                        {isRejected && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#FEE2E2',
                              color: '#DC2626',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <X size={12} /> REJECTED
                          </span>
                        )}
                      </td>

                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Monitor size={15} color="#64748B" />
                          <span>{k.name}</span>
                          <button
                            onClick={() => {
                              setEditingKiosk(k);
                              setEditName(k.name);
                            }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
                            title="Edit Nama"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </td>

                      <td>
                        <code style={{ fontSize: 12, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, color: '#334155' }}>
                          {k.kiosk_id}
                        </code>
                      </td>

                      <td style={{ color: '#64748B', fontSize: 12 }}>
                        {k.ip_address || '—'}
                      </td>

                      <td style={{ color: '#475569', fontSize: 12 }}>
                        {formatLastSeen(k.last_seen)}
                      </td>

                      <td style={{ fontWeight: 700, color: '#2563EB', fontSize: 13 }}>
                        {k.today_attendance || 0}
                      </td>

                      <td style={{ color: '#64748B', fontSize: 13 }}>
                        {k.total_attendance || 0}
                      </td>

                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {!isApproved && (
                            <button
                              onClick={() => handleUpdateStatus(k.kiosk_id, 'APPROVED')}
                              disabled={loadingId === k.kiosk_id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#10B981',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Setujui Kiosk untuk merekam absensi"
                            >
                              <Check size={13} /> Approve
                            </button>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => handleUpdateStatus(k.kiosk_id, 'REJECTED')}
                              disabled={loadingId === k.kiosk_id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: '1px solid #CBD5E1',
                                background: '#fff',
                                color: '#DC2626',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Cabut persetujuan Kiosk"
                            >
                              <X size={13} /> Cabut
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(k)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              cursor: 'pointer',
                            }}
                            title="Hapus Kiosk"
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

      {/* Edit Name Modal */}
      {editingKiosk && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Ubah Nama Kiosk</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input"
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="Contoh: Kiosk Lobby Depan"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditingKiosk(null)} className="btn btn-secondary">
                Batal
              </button>
              <button onClick={handleSaveName} className="btn btn-primary">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

