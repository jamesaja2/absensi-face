'use client';

import { AttendanceLog } from '@/lib/api';
import { useState } from 'react';

interface AttendanceTableProps {
  logs: AttendanceLog[];
}

export default function AttendanceTable({ logs }: AttendanceTableProps) {
  const [search, setSearch] = useState('');

  const filtered = logs.filter(
    (log) =>
      log.name.toLowerCase().includes(search.toLowerCase()) ||
      log.nomor_induk.toLowerCase().includes(search.toLowerCase())
  );

  const formatDateTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return {
      date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="search-logs"
          type="text"
          placeholder="Cari nama atau nomor induk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-dark-600 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-brand-primary input-glow transition-all"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Foto</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nama</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nomor Induk</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tanggal</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Jam</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Keyakinan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-slate-600">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm">
                        {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada data absensi'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log, idx) => {
                  const { date, time } = formatDateTime(log.timestamp);
                  return (
                    <tr key={log.id} className="table-row-hover transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-600 font-mono">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-primary/20 flex items-center justify-center border border-brand-primary/20">
                          {log.photo_url ? (
                            <img src={log.photo_url} alt={log.name} className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-xs font-bold text-brand-primary">{log.name.charAt(0)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-white">{log.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-400 font-mono">{log.nomor_induk}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-300">{date}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono text-brand-accent">{time}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold badge-hadir">
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-dark-400 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-success to-brand-accent"
                              style={{ width: `${log.confidence ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {log.confidence?.toFixed(1) ?? '—'}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {filtered.length} dari {logs.length} data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
