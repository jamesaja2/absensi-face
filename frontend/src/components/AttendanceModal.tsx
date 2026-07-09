'use client';

import { useEffect, useState } from 'react';
import { AttendanceLog } from '@/lib/api';

interface AttendanceModalProps {
  log: AttendanceLog;
  message: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function AttendanceModal({
  log,
  message,
  onDismiss,
  autoDismissMs = 4000,
}: AttendanceModalProps) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoDismissMs) * 100);
      setProgress(remaining);
    }, 50);

    const dismissTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, autoDismissMs);

    return () => {
      clearInterval(interval);
      clearTimeout(dismissTimer);
    };
  }, [autoDismissMs, onDismiss]);

  const formattedTime = new Date(log.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.3s ease',
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
        onClick={() => { setExiting(true); setTimeout(onDismiss, 300); }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#fff',
        borderRadius: 20,
        padding: '36px 40px',
        width: '100%', maxWidth: 380,
        margin: '0 24px',
        textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
        transform: exiting ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.3s ease',
      }}>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '3px solid var(--color-success)',
            overflow: 'hidden',
            background: 'var(--color-success-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {log.photo_url
              ? <img src={log.photo_url} alt={log.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-success)' }}>{log.name.charAt(0).toUpperCase()}</span>
            }
            {/* Checkmark overlay */}
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--color-success)', marginBottom: 8,
        }}>
          Berhasil Absen
        </div>

        {/* Name */}
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          {log.name}
        </div>

        {/* Nomor induk */}
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
          {log.nomor_induk}
        </div>

        {/* Time */}
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {formattedTime}
        </div>

        {/* Confidence + status */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {log.confidence && (
            <span className="badge badge-success">
              {log.confidence.toFixed(1)}% keyakinan
            </span>
          )}
          <span className="badge badge-neutral">{log.status}</span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: 'var(--color-success)',
            borderRadius: 99,
            width: `${progress}%`,
            transition: 'width 0.07s linear',
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Menutup otomatis...
        </div>
      </div>
    </div>
  );
}
