'use client';

import { useEffect, useState } from 'react';
import { Check, Info, AlertTriangle, X, ShieldCheck, Clock, Fingerprint } from 'lucide-react';

export interface PopupEvent {
  id: string;
  mode: 'ATTENDANCE' | 'INQUIRY';
  status: 'recorded' | 'debounced' | 'already_attended' | 'not_attended' | 'spoof';
  name: string;
  nomor_induk?: string;
  photo_url?: string | null;
  timestamp?: string;
  formatted_time?: string;
  confidence?: number;
  message?: string;
  is_approved?: boolean;
}

interface AttendancePopupProps {
  event: PopupEvent | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function AttendancePopup({
  event,
  onDismiss,
  autoDismissMs = 4500,
}: AttendancePopupProps) {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!event) return;

    setProgress(100);
    setIsClosing(false);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoDismissMs) * 100);
      setProgress(remaining);
    }, 40);

    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onDismiss, 250);
    }, autoDismissMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [event, autoDismissMs, onDismiss]);

  if (!event) return null;

  const isSuccess = event.status === 'recorded';
  const isDebounced = event.status === 'debounced';
  const isAlreadyAttended = event.status === 'already_attended';
  const isNotAttended = event.status === 'not_attended';
  const isSpoof = event.status === 'spoof';

  let accentColor = '#10B981'; // Emerald
  let badgeLabel = 'Presensi Tercatat';
  let badgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  if (isSuccess) {
    accentColor = '#10B981';
    badgeLabel = 'PRESENSI BERHASIL';
    badgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
  } else if (isDebounced) {
    accentColor = '#0EA5E9';
    badgeLabel = 'SUDAH TERCATAT';
    badgeBg = 'bg-sky-500/10 border-sky-500/30 text-sky-400';
  } else if (isAlreadyAttended) {
    accentColor = '#3B82F6';
    badgeLabel = 'MODE CEK: SUDAH ABSEN';
    badgeBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
  } else if (isNotAttended) {
    accentColor = '#F59E0B';
    badgeLabel = 'MODE CEK: BELUM ABSEN';
    badgeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  } else if (isSpoof) {
    accentColor = '#EF4444';
    badgeLabel = 'SPOOFING BLOCKED';
    badgeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  }

  const initial = (event.name || '?').charAt(0).toUpperCase();

  return (
    <div
      className={`fixed top-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-xl bg-[#0F172A]/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/70 overflow-hidden transition-all duration-300 ${
        isClosing ? 'translate-x-full opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100'
      }`}
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="p-4 flex gap-3.5 items-start relative">
        {/* User Photo / Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-xl bg-slate-800 border-2 overflow-hidden flex items-center justify-center font-bold text-lg text-slate-200 shadow-inner"
            style={{ borderColor: accentColor }}
          >
            {event.photo_url ? (
              <img src={event.photo_url} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {isSuccess && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center border-2 border-slate-900 shadow">
              <Check size={12} strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${badgeBg}`}>
              {badgeLabel}
            </span>

            {event.confidence !== undefined && (
              <span className="text-[11px] font-mono font-bold text-slate-400">
                {event.confidence.toFixed(0)}% MATCH
              </span>
            )}
          </div>

          <div className="text-sm font-bold text-white tracking-tight truncate">
            {event.name}
          </div>

          {event.nomor_induk && (
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              ID: {event.nomor_induk}
            </div>
          )}

          <div className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
            {event.message || 'Verifikasi biometrik berhasil diverifikasi'}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => {
            setIsClosing(true);
            setTimeout(onDismiss, 200);
          }}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800/80 transition-colors -mt-1 -mr-1"
          aria-label="Tutup"
        >
          <X size={15} />
        </button>
      </div>

      {/* Countdown Progress Bar */}
      <div className="w-full h-0.5 bg-slate-800">
        <div
          className="h-full transition-all duration-75 linear"
          style={{ width: `${progress}%`, backgroundColor: accentColor }}
        />
      </div>
    </div>
  );
}
