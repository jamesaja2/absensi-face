'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { attendanceApi, AttendanceLog, TodayStats } from '@/lib/api';
import CameraFeed from '@/components/CameraFeed';
import AttendanceModal from '@/components/AttendanceModal';

export default function KioskPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [activeModal, setActiveModal] = useState<{ log: AttendanceLog; message: string } | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const logsRes = await attendanceApi.getLogs({ limit: 8 });
        setRecentLogs(logsRes.data.logs);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('attendance:new', (data: { log: AttendanceLog; message: string }) => {
      setActiveModal(data);
      setRecentLogs((prev) => [data.log, ...prev].slice(0, 8));
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('attendance:new');
    };
  }, []);

  const handleModalDismiss = useCallback(() => setActiveModal(null), []);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatLogTime = (timestamp: string) => {
    const normalized = timestamp.replace(' ', 'T');
    const d = new Date(normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z');
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <main className="kiosk-bg min-h-screen flex flex-col select-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Logo PUSTEKOM" style={{ height: 40 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>Sistem Absensi Kapel PUSTEKOM</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>by James</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span className={`status-dot ${socketConnected ? 'online' : 'offline'}`} />
          {socketConnected ? 'Terhubung' : 'Terputus'}
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, padding: 24, minHeight: 0 }}>

        {/* LEFT — Camera column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Clock only */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(currentTime)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, textTransform: 'capitalize' }}>
              {formatDate(currentTime)}
            </div>
          </div>

          {/* Camera */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <CameraFeed className="h-full" />
          </div>

          {/* Instruction */}
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Hadapkan wajah Anda ke kamera untuk absensi otomatis
            </span>
          </div>
        </div>

        {/* RIGHT — Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Recent activity */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aktivitas Terbaru
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {recentLogs.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Belum ada aktivitas hari ini
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--color-accent-light)',
                      color: 'var(--color-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0,
                      overflow: 'hidden',
                    }}>
                      {log.photo_url
                        ? <img src={log.photo_url} alt={log.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : getInitial(log.name)
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{log.nomor_induk}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="badge badge-success">{log.status}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                        {formatLogTime(log.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Copyright footer */}
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Copyright PUSTEKOM 2026. Sistem Absensi Kapel PUSTEKOM by James. All Right Reserved.
          </div>
        </div>
      </div>

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
