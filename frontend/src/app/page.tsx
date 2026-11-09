'use client';

import { useEffect, useState, useCallback, useId } from 'react';
import { getSocket } from '@/lib/socket';
import { attendanceApi, AttendanceLog, kiosksApi } from '@/lib/api';
import { getKioskId, getKioskName, setKioskName } from '@/lib/kiosk';
import CameraFeed from '@/components/CameraFeed';
import AttendancePopup, { PopupEvent } from '@/components/AttendancePopup';
import toast, { Toaster } from 'react-hot-toast';
import { Monitor, CheckCircle, AlertCircle, Settings, ShieldAlert } from 'lucide-react';

export default function KioskPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [popupEvent, setPopupEvent] = useState<PopupEvent | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [kioskId, setKioskIdState] = useState<string>('');
  const [kioskNameState, setKioskNameState] = useState<string>('');
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [tempKioskName, setTempKioskName] = useState('');

  // Setup Kiosk ID & Clock
  useEffect(() => {
    const id = getKioskId();
    const name = getKioskName();
    setKioskIdState(id);
    setKioskNameState(name);
    setTempKioskName(name);

    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Kiosk status from backend
  const refreshKioskStatus = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await kiosksApi.getStatus(id);
      setIsApproved(res.data.is_approved);
      if (res.data.kiosk?.name) {
        setKioskNameState(res.data.kiosk.name);
      }
    } catch (e) {
      console.warn('Failed to query kiosk status:', e);
    }
  }, []);

  // Load recent logs and kiosk status
  useEffect(() => {
    if (!kioskId) return;
    refreshKioskStatus(kioskId);

    const loadData = async () => {
      try {
        const logsRes = await attendanceApi.getLogs({ limit: 8 });
        setRecentLogs(logsRes.data.logs || []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [kioskId, refreshKioskStatus]);

  // Socket.io room binding for this kiosk
  useEffect(() => {
    if (!kioskId) return;

    const socket = getSocket();

    const joinKioskRoom = () => {
      setSocketConnected(true);
      socket.emit('kiosk:join', kioskId);
    };

    if (socket.connected) {
      joinKioskRoom();
    }

    socket.on('connect', joinKioskRoom);
    socket.on('disconnect', () => setSocketConnected(false));

    // Targeted Kiosk Event (Attendance Recorded)
    socket.on('attendance:kiosk_event', (data: any) => {
      if (data?.log) {
        setRecentLogs((prev) => [data.log, ...prev].slice(0, 8));
        setPopupEvent({
          id: String(Date.now()),
          mode: 'ATTENDANCE',
          status: 'recorded',
          name: data.log.name,
          nomor_induk: data.log.nomor_induk,
          photo_url: data.log.photo_url,
          timestamp: data.log.timestamp,
          confidence: data.log.confidence,
          message: data.message || `Presensi berhasil: ${data.log.name}`,
          is_approved: true,
        });
      }
    });

    // Targeted Inquiry Event (Check Mode)
    socket.on('attendance:inquiry', (data: any) => {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'INQUIRY',
        status: data.already_attended ? 'already_attended' : 'not_attended',
        name: data.user?.name || 'Pengguna',
        nomor_induk: data.user?.nomor_induk,
        photo_url: data.user?.photo_url,
        confidence: data.confidence,
        formatted_time: data.formatted_time,
        message: data.message,
        is_approved: false,
      });
    });

    // Kiosk status updated by admin live
    socket.on('kiosk:status_changed', (kiosk: any) => {
      if (kiosk.kiosk_id === kioskId) {
        setIsApproved(kiosk.status === 'APPROVED');
        if (kiosk.name) setKioskNameState(kiosk.name);
        toast.success(`Status Kiosk diperbarui: ${kiosk.status}`, { icon: '🔄' });
      }
    });

    return () => {
      socket.off('connect', joinKioskRoom);
      socket.off('disconnect');
      socket.off('attendance:kiosk_event');
      socket.off('attendance:inquiry');
      socket.off('kiosk:status_changed');
    };
  }, [kioskId]);

  const handleFacesDetected = useCallback((faces: any[]) => {
    // Local detection feedback
    const spoofFace = faces.find((f) => f.status === 'spoof' || !f.is_real);
    if (spoofFace) {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'ATTENDANCE',
        status: 'spoof',
        name: 'Peringatan Keamanan',
        message: 'Layar HP atau Foto Cetak terdeteksi (Anti-Spoofing)',
      });
      return;
    }

    // If unapproved kiosk returns face results directly from API response
    const inquiryFace = faces.find((f) => f.mode === 'INQUIRY');
    if (inquiryFace && inquiryFace.user) {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'INQUIRY',
        status: inquiryFace.already_attended ? 'already_attended' : 'not_attended',
        name: inquiryFace.user.name,
        nomor_induk: inquiryFace.user.nomor_induk,
        photo_url: inquiryFace.user.photo_url,
        confidence: inquiryFace.confidence,
        message: inquiryFace.message,
        is_approved: false,
      });
    }
  }, []);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const formatLogTime = (timestamp: string) => {
    const normalized = timestamp.replace(' ', 'T');
    const d = new Date(normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z');
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const getInitial = (name: string) => (name || '?').charAt(0).toUpperCase();

  const handleSaveKioskName = () => {
    if (tempKioskName.trim()) {
      setKioskName(tempKioskName.trim());
      setKioskNameState(tempKioskName.trim());
      setShowKioskModal(false);
      toast.success('Nama Kiosk disimpan');
    }
  };

  return (
    <main className="kiosk-bg min-h-screen flex flex-col select-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Toaster position="top-center" />

      {/* ── TOP-RIGHT FLOATING NOTIFICATION POPUP ── */}
      <AttendancePopup
        event={popupEvent}
        onDismiss={() => setPopupEvent(null)}
        autoDismissMs={4000}
      />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 28px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.png" alt="Logo PUSTEKOM" style={{ height: 42 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>
              Sistem Absensi Face Recognition
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>PUSTEKOM Attendance Terminal</div>
          </div>
        </div>

        {/* Center: Kiosk Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            onClick={() => setShowKioskModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: isApproved === true ? '#ECFDF5' : isApproved === false ? '#FFFBEB' : '#F1F5F9',
              color: isApproved === true ? '#047857' : isApproved === false ? '#B45309' : '#64748B',
              border: `1px solid ${isApproved === true ? '#A7F3D0' : isApproved === false ? '#FDE68A' : '#E2E8F0'}`,
            }}
            title="Klik untuk info / pengaturan Kiosk"
          >
            <Monitor size={14} />
            <span>{kioskNameState || kioskId}</span>
            {isApproved === true ? (
              <span className="flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle size={13} /> Approved (Pencatat Absen)
              </span>
            ) : isApproved === false ? (
              <span className="flex items-center gap-1 font-bold text-amber-700">
                <AlertCircle size={13} /> Mode Cek (Menunggu Approve Admin)
              </span>
            ) : (
              <span>Memeriksa status...</span>
            )}
            <Settings size={13} className="ml-1 opacity-60" />
          </div>
        </div>

        {/* Right: Connection dot & Admin Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span className={`status-dot ${socketConnected ? 'online' : 'offline'}`} />
            {socketConnected ? 'Online' : 'Offline'}
          </div>

          <a
            href="/admin"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#3B82F6',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
            }}
          >
            Admin Portal →
          </a>
        </div>
      </header>

      {/* ── UNAPPROVED KIOSK NOTIFICATION BANNER (IF PENDING) ── */}
      {isApproved === false && (
        <div
          style={{
            background: '#FEF3C7',
            borderBottom: '1px solid #FCD34D',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            color: '#92400E',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} />
          <span>
            <strong>Terminal Mode Pemeriksaan:</strong> Kiosk ID <code>{kioskId}</code> belum di-approve oleh Admin.
            Wajah akan dikenali untuk <em>mengecek status & waktu kehadiran</em>, tetapi <em>tidak mencatat absensi baru</em> sampai disetujui di Admin Dashboard.
          </span>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, padding: 24, minHeight: 0 }}>
        {/* LEFT — Camera Feed column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Clock Header */}
          <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  letterSpacing: '-2px',
                  lineHeight: 1,
                  color: 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatTime(currentTime)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 6, textTransform: 'capitalize' }}>
                {formatDate(currentTime)}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Terminal Mode
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: isApproved ? '#059669' : '#D97706',
                  marginTop: 4,
                }}
              >
                {isApproved ? 'Presensi Otomatis Aktif' : 'Cek Status Kehadiran'}
              </div>
            </div>
          </div>

          {/* Camera Feed with real-time bounding boxes */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <CameraFeed className="h-full" onFacesDetected={handleFacesDetected} />
          </div>

          {/* Instruction Card */}
          <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
              Hadapkan wajah ke arah kamera. Sistem mendukung pengenalan banyak wajah sekaligus dengan proteksi <strong>Anti-Spoofing MiniFASNet</strong>.
            </div>
          </div>
        </div>

        {/* RIGHT — Live Activity Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aktivitas Kehadiran
              </span>
              <span style={{ fontSize: 11, background: '#F1F5F9', padding: '3px 8px', borderRadius: 999, fontWeight: 600, color: '#475569' }}>
                {recentLogs.length} Terakhir
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {recentLogs.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Belum ada catatan kehadiran hari ini
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--color-accent-light)',
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {log.photo_url ? (
                        <img src={log.photo_url} alt={log.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitial(log.name)
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {log.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{log.nomor_induk}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className="badge badge-success">{log.status}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {formatLogTime(log.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            Sistem Absensi Presensi Wajah © 2026. Enterprise Face Recognition Terminal.
          </div>
        </div>
      </div>

      {/* ── KIOSK SETTINGS MODAL ── */}
      {showKioskModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>Informasi & Pengaturan Terminal Kiosk</h3>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#475569' }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Kiosk ID:</strong> <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{kioskId}</code>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>Status Lisensi:</strong>{' '}
                <span style={{ fontWeight: 600, color: isApproved ? '#059669' : '#D97706' }}>
                  {isApproved ? 'APPROVED (Terdaftar & Resmi)' : 'PENDING (Menunggu Persetujuan Admin)'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Nama Lokasi / Kiosk
              </label>
              <input
                type="text"
                value={tempKioskName}
                onChange={(e) => setTempKioskName(e.target.value)}
                placeholder="Contoh: Kiosk Gerbang Utama"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowKioskModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Batal
              </button>
              <button
                onClick={handleSaveKioskName}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
