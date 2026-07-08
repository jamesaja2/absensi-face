'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { attendanceApi, AttendanceLog, TodayStats } from '@/lib/api';
import CameraFeed from '@/components/CameraFeed';
import AttendanceModal from '@/components/AttendanceModal';

export default function KioskPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [activeModal, setActiveModal] = useState<{ log: AttendanceLog; message: string } | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastDetections, setLastDetections] = useState<AttendanceLog[]>([]);

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial stats
  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          attendanceApi.getStatsToday(),
          attendanceApi.getLogs({ limit: 5 }),
        ]);
        setTodayStats(statsRes.data);
        setRecentLogs(logsRes.data.logs);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('attendance:new', (data: { log: AttendanceLog; message: string }) => {
      console.log('[Kiosk] Attendance event:', data);

      // Show modal
      setActiveModal(data);

      // Update recent list
      setLastDetections((prev) => [data.log, ...prev].slice(0, 10));

      // Update today count
      setTodayStats((prev) =>
        prev ? { ...prev, totalAttendanceToday: prev.totalAttendanceToday + 1 } : prev
      );

      // Update recent logs
      setRecentLogs((prev) => [data.log, ...prev].slice(0, 5));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('attendance:new');
    };
  }, []);

  const handleModalDismiss = useCallback(() => {
    setActiveModal(null);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatLogTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <main className="kiosk-bg bg-grid min-h-screen flex flex-col select-none overflow-hidden">

      {/* ── HEADER BAR ────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center glow-primary">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Sistem Absensi</h1>
            <p className="text-xs text-slate-500 mt-0.5">Pengenalan Wajah Otomatis</p>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-brand-success animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs font-medium text-slate-300">
            {socketConnected ? 'Terhubung' : 'Terputus'}
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-5 gap-6 p-6">

        {/* LEFT — Camera + Clock */}
        <div className="col-span-3 flex flex-col gap-4">

          {/* Clock */}
          <div className="glass rounded-2xl px-6 py-5">
            <div className="flex items-end gap-4">
              <div>
                <p className="text-6xl font-black text-white tabular-nums tracking-tight leading-none">
                  {formatTime(currentTime)}
                </p>
                <p className="text-slate-400 text-sm mt-2 font-medium capitalize">
                  {formatDate(currentTime)}
                </p>
              </div>
              <div className="ml-auto text-right">
                {todayStats && (
                  <div>
                    <p className="text-3xl font-bold gradient-text">{todayStats.totalAttendanceToday}</p>
                    <p className="text-xs text-slate-500 mt-1">Hadir Hari Ini</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Camera Feed */}
          <CameraFeed className="flex-1 min-h-0" />

          {/* Instruction banner */}
          <div className="glass rounded-xl px-6 py-3 flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <p className="text-sm text-slate-300">
              Hadapkan wajah Anda ke kamera untuk absensi otomatis
            </p>
          </div>
        </div>

        {/* RIGHT — Recent Activity */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold gradient-text">
                {todayStats?.totalAttendanceToday ?? '-'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Hadir</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-brand-accent">
                {todayStats?.totalUsers ?? '-'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total Karyawan</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-slate-300">Aktivitas Terbaru</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-600">
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs">Belum ada aktivitas</p>
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-dark-600/50 hover:bg-dark-500/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-primary/20 flex-shrink-0 flex items-center justify-center border border-brand-primary/20">
                      {log.photo_url ? (
                        <img src={log.photo_url} alt={log.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-brand-primary">
                          {log.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{log.name}</p>
                      <p className="text-xs text-slate-500">{log.nomor_induk}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-brand-success">{log.status}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatLogTime(log.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer info */}
          <div className="text-center">
            <p className="text-xs text-slate-600">
              Sistem Absensi Pengenalan Wajah — Powered by CompreFace
            </p>
          </div>
        </div>
      </div>

      {/* ── SUCCESS MODAL ─────────────────────────────────────────── */}
      {activeModal && (
        <AttendanceModal
          log={activeModal.log}
          message={activeModal.message}
          onDismiss={handleModalDismiss}
          autoDismissMs={4000}
        />
      )}
    </main>
  );
}
