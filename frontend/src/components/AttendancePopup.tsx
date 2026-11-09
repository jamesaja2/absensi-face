'use client';

import { useEffect, useState } from 'react';
import { Check, Info, AlertTriangle, X, ShieldCheck, Clock } from 'lucide-react';

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
      setTimeout(onDismiss, 200);
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

  let accentColor = '#16a34a'; // Emerald
  let badgeLabel = 'PRESENSI BERHASIL';
  let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (isSuccess) {
    accentColor = '#16a34a';
    badgeLabel = 'PRESENSI BERHASIL';
    badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (isDebounced) {
    accentColor = '#0284c7';
    badgeLabel = 'SUDAH TERCATAT';
    badgeBg = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (isAlreadyAttended) {
    accentColor = '#2563eb';
    badgeLabel = 'MODE CEK: SUDAH ABSEN';
    badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (isNotAttended) {
    accentColor = '#d97706';
    badgeLabel = 'MODE CEK: BELUM ABSEN';
    badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (isSpoof) {
    accentColor = '#dc2626';
    badgeLabel = 'SPOOFING TERDETEKSI';
    badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const initial = (event.name || '?').charAt(0).toUpperCase();

  return (
    <div
      className={`fixed top-5 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] rounded-lg bg-white border border-slate-200 shadow-xl overflow-hidden transition-all duration-200 ${
        isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase border ${badgeBg}`}
            >
              {isSuccess && <Check size={12} strokeWidth={3} />}
              {isSpoof && <AlertTriangle size={12} />}
              {(isAlreadyAttended || isNotAttended || isDebounced) && <Info size={12} />}
              <span>{badgeLabel}</span>
            </span>

            {event.confidence && (
              <span className="text-[11px] font-semibold text-slate-500">
                {Math.min(100, Number(event.confidence) > 1 ? Number(event.confidence) : Number(event.confidence) * 100).toFixed(0)}% Cocok
              </span>
            )}
          </div>

          <button
            onClick={() => {
              setIsClosing(true);
              setTimeout(onDismiss, 150);
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content row */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg shrink-0 overflow-hidden">
            {event.photo_url ? (
              <img src={event.photo_url} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{event.name}</div>
            {event.nomor_induk && (
              <div className="text-xs text-slate-500 font-medium">{event.nomor_induk}</div>
            )}
            <div className="text-xs text-slate-600 mt-1 leading-snug">
              {event.message ||
                (isAlreadyAttended
                  ? `Sudah presensi jam ${event.formatted_time || ''}`
                  : isNotAttended
                  ? 'Belum ada catatan presensi hari ini'
                  : 'Presensi otomatis berhasil')}
            </div>
          </div>
        </div>
      </div>

      {/* Linear progress countdown bar */}
      <div className="h-1 w-full bg-slate-100">
        <div
          className="h-full transition-all duration-75"
          style={{ width: `${progress}%`, backgroundColor: accentColor }}
        />
      </div>
    </div>
  );
}
