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
      setTimeout(onDismiss, 400);
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
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-400
        ${exiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-fade-in'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => { setExiting(true); setTimeout(onDismiss, 400); }}
      />

      {/* Modal card */}
      <div
        className={`relative z-10 w-full max-w-md mx-6 rounded-3xl overflow-hidden
          ${exiting ? 'animate-none' : 'animate-scale-in'}`}
      >
        {/* Animated gradient border */}
        <div className="animated-border rounded-3xl">
          <div className="bg-dark-500 rounded-3xl p-8 text-center">

            {/* Success ring animation */}
            <div className="relative flex items-center justify-center mb-6">
              {/* Outer rings */}
              <div className="absolute w-36 h-36 rounded-full border border-brand-success/20 success-ring" />
              <div className="absolute w-28 h-28 rounded-full border border-brand-success/30 success-ring" style={{ animationDelay: '0.3s' }} />

              {/* Photo or icon circle */}
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-brand-success glow-success">
                {log.photo_url ? (
                  <img
                    src={log.photo_url}
                    alt={log.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {/* Fallback avatar */}
                <div className={`absolute inset-0 flex items-center justify-center bg-brand-success/20 ${log.photo_url ? 'opacity-0' : 'opacity-100'}`}>
                  <span className="text-4xl font-bold text-brand-success">
                    {log.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Checkmark badge */}
              <div className="absolute bottom-0 right-1/2 translate-x-14 translate-y-2 w-8 h-8 rounded-full bg-brand-success flex items-center justify-center shadow-lg glow-success animate-checkmark">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Text content */}
            <p className="text-sm font-medium text-brand-success/80 uppercase tracking-widest mb-2">
              ✓ Berhasil Absen
            </p>
            <h2 className="text-3xl font-bold text-white mb-1">{log.name}</h2>
            <p className="text-brand-accent text-sm font-medium mb-1">{log.nomor_induk}</p>
            <p className="text-slate-400 text-sm">{formattedTime}</p>

            {/* Confidence badge */}
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-success/10 border border-brand-success/20">
              <svg className="w-3 h-3 text-brand-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-brand-success font-semibold">
                Keyakinan: {log.confidence?.toFixed(1)}%
              </span>
            </div>

            {/* Status */}
            <div className="mt-3">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold badge-hadir">
                {log.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-6 w-full h-1 bg-dark-400 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-success to-brand-accent rounded-full transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Menutup otomatis...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
