'use client';

import { AttendanceLog } from '@/lib/api';
import { useState } from 'react';
import { ShieldCheck, Monitor, Search } from 'lucide-react';

interface AttendanceTableProps {
  logs: AttendanceLog[];
}

function parseDbTimestamp(ts: string): Date {
  const normalized = ts.replace(' ', 'T');
  if (normalized.endsWith('Z') || normalized.includes('+')) return new Date(normalized);
  return new Date(normalized + 'Z');
}

const PAGE_SIZE = 15;

export default function AttendanceTable({ logs }: AttendanceTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = logs.filter(
    (log) =>
      log.name.toLowerCase().includes(search.toLowerCase()) ||
      log.nomor_induk.toLowerCase().includes(search.toLowerCase()) ||
      (log.email && log.email.toLowerCase().includes(search.toLowerCase())) ||
      (log.kiosk_name && log.kiosk_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const formatDateTime = (timestamp: string) => {
    const d = parseDbTimestamp(timestamp);
    return {
      date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }),
      time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
        />
        <input
          id="search-logs"
          type="text"
          placeholder="Cari nama, nomor induk, email, atau kiosk..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="input"
          style={{ paddingLeft: 40, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 56 }}>Foto</th>
                <th>Nama Karyawan</th>
                <th>Nomor Induk</th>
                <th>Email</th>
                <th>Waktu Presensi</th>
                <th>Kiosk</th>
                <th>Confidence</th>
                <th>Anti-Spoof</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 16px', color: '#94A3B8' }}>
                    {search ? `Tidak ada hasil pencarian untuk "${search}"` : 'Belum ada data absensi untuk kriteria yang dipilih'}
                  </td>
                </tr>
              ) : (
                paginated.map((log, idx) => {
                  const { date, time } = formatDateTime(log.timestamp);
                  const globalIdx = (safeCurrentPage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={log.id}>
                      <td style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: 12 }}>{globalIdx}</td>
                      <td>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: '#EFF6FF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#2563EB',
                            border: '1px solid #DBEAFE',
                          }}
                        >
                          {log.photo_url ? (
                            <img
                              src={log.photo_url}
                              alt={log.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            log.name.charAt(0)
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>{log.name}</td>
                      <td style={{ fontFamily: 'monospace', color: '#475569', fontSize: 13 }}>{log.nomor_induk}</td>
                      <td style={{ color: '#64748B', fontSize: 13 }}>{log.email || '—'}</td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{time}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{date}</div>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#334155', background: '#F8FAFC', padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                          <Monitor size={12} color="#64748B" />
                          <span>{log.kiosk_name || log.kiosk_id || 'Kiosk'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#059669', fontSize: 13 }}>
                          {log.confidence ? `${log.confidence.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: log.is_real ? '#ECFDF5' : '#FEF2F2',
                            color: log.is_real ? '#059669' : '#DC2626',
                          }}
                        >
                          <ShieldCheck size={12} />
                          {log.is_real ? 'Live / Asli' : 'Spoof'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">{log.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {filtered.length > 0 && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FAFAFA',
            }}
          >
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Menampilkan {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} log
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setPage(Math.max(1, safeCurrentPage - 1))}
                disabled={safeCurrentPage <= 1}
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12, opacity: safeCurrentPage <= 1 ? 0.3 : 1 }}
              >
                ← Sebelumnya
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', padding: '0 8px' }}>
                Halaman {safeCurrentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, safeCurrentPage + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: 12, opacity: safeCurrentPage >= totalPages ? 0.3 : 1 }}
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
