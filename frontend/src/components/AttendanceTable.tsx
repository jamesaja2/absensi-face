'use client';

import { AttendanceLog } from '@/lib/api';
import { useState } from 'react';

interface AttendanceTableProps {
  logs: AttendanceLog[];
}

// Parse timestamp from DB (SQLite stores without tz info, treat as WIB = UTC+7)
function parseDbTimestamp(ts: string): Date {
  // Add +07:00 so JS parses it as WIB, not UTC
  const normalized = ts.replace(' ', 'T');
  if (normalized.endsWith('Z') || normalized.includes('+')) return new Date(normalized);
  return new Date(normalized + '+07:00');
}

export default function AttendanceTable({ logs }: AttendanceTableProps) {
  const [search, setSearch] = useState('');

  const filtered = logs.filter(
    (log) =>
      log.name.toLowerCase().includes(search.toLowerCase()) ||
      log.nomor_induk.toLowerCase().includes(search.toLowerCase())
  );

  const formatDateTime = (timestamp: string) => {
    const d = parseDbTimestamp(timestamp);
    return {
      date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }),
      time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
          width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="search-logs"
          type="text"
          placeholder="Cari nama atau nomor induk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ paddingLeft: 38 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Foto</th>
                <th>Nama</th>
                <th>Nomor Induk</th>
                <th>Tanggal</th>
                <th>Jam</th>
                <th>Status</th>
                <th>Keyakinan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-muted)' }}>
                    {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada data absensi'}
                  </td>
                </tr>
              ) : (
                filtered.map((log, idx) => {
                  const { date, time } = formatDateTime(log.timestamp);
                  return (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{idx + 1}</td>
                      <td>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--color-accent-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', fontSize: 12, fontWeight: 700, color: 'var(--color-accent)',
                        }}>
                          {log.photo_url
                            ? <img src={log.photo_url} alt={log.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : log.name.charAt(0)
                          }
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{log.name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{log.nomor_induk}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{date}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-primary)' }}>{time}</td>
                      <td><span className="badge badge-success">{log.status}</span></td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{log.confidence?.toFixed(1) ?? '—'}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Menampilkan {filtered.length} dari {logs.length} data
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
