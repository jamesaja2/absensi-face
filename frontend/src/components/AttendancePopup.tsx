'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

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

  let borderColor = '#10B981'; // green
  let bgColor = '#ECFDF5';
  let badgeText = 'Presensi Berhasil';
  let badgeBg = '#D1FAE5';
  let badgeColor = '#065F46';

  if (isSuccess) {
    borderColor = '#10B981';
    bgColor = '#FFFFFF';
    badgeText = 'Presensi Tercatat ✓';
    badgeBg = '#D1FAE5';
    badgeColor = '#065F46';
  } else if (isDebounced) {
    borderColor = '#0284C7';
    bgColor = '#FFFFFF';
    badgeText = 'Sudah Tercatat';
    badgeBg = '#E0F2FE';
    badgeColor = '#0369A1';
  } else if (isAlreadyAttended) {
    borderColor = '#3B82F6';
    bgColor = '#FFFFFF';
    badgeText = 'Mode Cek: Sudah Absen';
    badgeBg = '#DBEAFE';
    badgeColor = '#1E40AF';
  } else if (isNotAttended) {
    borderColor = '#F59E0B';
    bgColor = '#FFFFFF';
    badgeText = 'Mode Cek: Belum Absen';
    badgeBg = '#FEF3C7';
    badgeColor = '#92400E';
  } else if (isSpoof) {
    borderColor = '#EF4444';
    bgColor = '#FEF2F2';
    badgeText = '⚠️ Spoofing Terdeteksi';
    badgeBg = '#FEE2E2';
    badgeColor = '#991B1B';
  }

  const initial = (event.name || '?').charAt(0).toUpperCase();

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        width: 360,
        maxWidth: 'calc(100vw - 48px)',
        transform: isClosing ? 'translateX(120%) scale(0.95)' : 'translateX(0) scale(1)',
        opacity: isClosing ? 0 : 1,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.06)',
        borderRadius: 16,
        background: bgColor,
        borderLeft: `6px solid ${borderColor}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
        {/* Avatar / Photo */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: `2px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F1F5F9',
            fontSize: 18,
            fontWeight: 700,
            color: '#334155',
          }}
        >
          {event.photo_url ? (
            <img src={event.photo_url} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initial
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: 999,
                background: badgeBg,
                color: badgeColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isSuccess && <CheckCircle2 size={12} />}
              {(isAlreadyAttended || isDebounced) && <Info size={12} />}
              {(isNotAttended || isSpoof) && <AlertTriangle size={12} />}
              {badgeText}
            </span>

            {event.confidence !== undefined && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                {event.confidence.toFixed(0)}% Match
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#0F172A',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
          >
            {event.name}
          </div>

          {event.nomor_induk && (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
              ID: {event.nomor_induk}
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: isNotAttended ? '#B45309' : '#334155',
              marginTop: 6,
              fontWeight: isNotAttended ? 600 : 400,
              lineHeight: 1.35,
            }}
          >
            {event.message || (isSuccess ? 'Kehadiran berhasil disimpan ke sistem' : '')}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => {
            setIsClosing(true);
            setTimeout(onDismiss, 200);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            color: '#94A3B8',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -4,
            marginRight: -6,
          }}
          aria-label="Tutup"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.06)' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: borderColor,
            transition: 'width 40ms linear',
          }}
        />
      </div>
    </div>
  );
}
