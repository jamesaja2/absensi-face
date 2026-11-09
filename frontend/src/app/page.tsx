'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { attendanceApi, AttendanceLog, kiosksApi } from '@/lib/api';
import { getKioskId, getKioskName, setKioskName } from '@/lib/kiosk';
import CameraFeed from '@/components/CameraFeed';
import AttendancePopup, { PopupEvent } from '@/components/AttendancePopup';
import toast, { Toaster } from 'react-hot-toast';
import {
  Monitor,
  CheckCircle2,
  AlertCircle,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ExternalLink,
  Radio,
  Lock,
  KeyRound,
  Sparkles,
} from 'lucide-react';

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

  // Setup Kiosk ID & Real-Time Synchronized Clock
  useEffect(() => {
    const id = getKioskId();
    const name = getKioskName();
    setKioskIdState(id);
    setKioskNameState(name);
    setTempKioskName(name);

    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Query Backend Kiosk Authorization Status
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

  // Periodic Telemetry & Recent Logs Loader
  useEffect(() => {
    if (!kioskId) return;
    refreshKioskStatus(kioskId);

    const loadData = async () => {
      try {
        const logsRes = await attendanceApi.getLogs({ limit: 10 });
        setRecentLogs(logsRes.data.logs || []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [kioskId, refreshKioskStatus]);

  // Real-Time Socket.io Connection & Event Binding
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

    // Attendance Registered Event
    socket.on('attendance:kiosk_event', (data: any) => {
      if (data?.log) {
        setRecentLogs((prev) => [data.log, ...prev].slice(0, 10));
        setPopupEvent({
          id: String(Date.now()),
          mode: 'ATTENDANCE',
          status: 'recorded',
          name: data.log.name,
          nomor_induk: data.log.nomor_induk,
          photo_url: data.log.photo_url,
          timestamp: data.log.timestamp,
          confidence: data.log.confidence,
          message: data.message || `Presensi berhasil direkam: ${data.log.name}`,
          is_approved: true,
        });
      }
    });

    // Inquiry Audit Event (Unapproved Kiosk Mode)
    socket.on('attendance:inquiry', (data: any) => {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'INQUIRY',
        status: data.already_attended ? 'already_attended' : 'not_attended',
        name: data.user?.name || 'Karyawan',
        nomor_induk: data.user?.nomor_induk,
        photo_url: data.user?.photo_url,
        confidence: data.confidence,
        formatted_time: data.formatted_time,
        message: data.message,
        is_approved: false,
      });
    });

    // Live Administrative Approval Broadcast
    socket.on('kiosk:status_changed', (kiosk: any) => {
      if (kiosk.kiosk_id === kioskId) {
        setIsApproved(kiosk.status === 'APPROVED');
        if (kiosk.name) setKioskNameState(kiosk.name);
        toast.success(`Otorisasi Kiosk diperbarui: ${kiosk.status}`, {
          icon: kiosk.status === 'APPROVED' ? '🔒' : '⚠️',
        });
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
    // Local detection feedback for spoof threats
    const spoofFace = faces.find((f) => f.status === 'spoof' || !f.is_real);
    if (spoofFace) {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'ATTENDANCE',
        status: 'spoof',
        name: 'Deteksi Anomali Biometrik',
        message: 'Layar HP atau media cetak terdeteksi (Anti-Spoofing MiniFASNet)',
      });
      return;
    }

    // Direct inquiry handling for unapproved kiosks
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
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const getInitial = (name: string) => (name || '?').charAt(0).toUpperCase();

  const handleSaveKioskName = () => {
    if (tempKioskName.trim()) {
      setKioskName(tempKioskName.trim());
      setKioskNameState(tempKioskName.trim());
      setShowKioskModal(false);
      toast.success('Konfigurasi nama terminal diperbarui');
    }
  };

  return (
    <main className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col select-none font-sans antialiased selection:bg-blue-600 selection:text-white">
      <Toaster position="top-center" />

      {/* Floating Biometric Event Badge */}
      <AttendancePopup
        event={popupEvent}
        onDismiss={() => setPopupEvent(null)}
        autoDismissMs={4500}
      />

      {/* ── TOP ENTERPRISE HEADER ────────────────────────────────────── */}
      <header className="h-16 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 z-20">
        {/* Brand & Organization */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 border border-blue-400/20 font-bold text-sm">
            PU
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">PUSTEKOM BIOMETRIC GATEWAY</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60 font-semibold">
                v2.6 PROD
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Enterprise Optical Recognition Terminal
            </div>
          </div>
        </div>

        {/* Center: Cryptographic Hardware Token & Authorization Pill */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKioskModal(true)}
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              isApproved === true
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/60'
                : isApproved === false
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-950/60'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Klik untuk konfigurasi & status otorisasi hardware"
          >
            <Monitor size={14} className={isApproved === true ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="font-semibold text-slate-200">{kioskNameState || kioskId}</span>
            <span className="text-slate-600">•</span>
            {isApproved === true ? (
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <CheckCircle2 size={13} />
                <span>AUTHORIZED (RECORDER)</span>
              </span>
            ) : isApproved === false ? (
              <span className="flex items-center gap-1.5 font-bold text-amber-400">
                <AlertCircle size={13} />
                <span>AUDIT ONLY (UNAPPROVED)</span>
              </span>
            ) : (
              <span className="text-slate-400">VERIFYING TOKEN...</span>
            )}
            <Settings size={13} className="text-slate-500 group-hover:text-slate-300 transition-colors ml-0.5" />
          </button>
        </div>

        {/* Right: Live Connection Pulse & Admin Portal Link */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800/60 text-xs font-mono text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{socketConnected ? 'SOCKET SYNCED' : 'DISCONNECTED'}</span>
          </div>

          <a
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-sm"
          >
            <Lock size={12} className="text-blue-400" />
            <span>Admin Console</span>
            <ExternalLink size={11} className="text-slate-400" />
          </a>
        </div>
      </header>

      {/* ── UNAPPROVED KIOSK WARNING BANNER ──────────────────────────── */}
      {isApproved === false && (
        <div className="bg-amber-950/70 border-b border-amber-800/80 px-6 py-2 flex items-center justify-between text-xs text-amber-200 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={15} className="text-amber-400 shrink-0" />
            <span>
              <strong>Station in Audit-Only Mode:</strong> Hardware ID <code className="bg-amber-900/80 px-1.5 py-0.5 rounded text-amber-100 font-mono">{kioskId}</code> is not yet authorized by a Security Admin. Faces will be analyzed to verify registered timestamps, but no new attendance entries will be committed to the database.
            </span>
          </div>
          <button
            onClick={() => setShowKioskModal(true)}
            className="underline underline-offset-2 font-mono text-[11px] text-amber-300 hover:text-white shrink-0 ml-4"
          >
            Review Token
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE GRID ──────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-6 p-6 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Terminal HUD Viewport */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Synchronized Precision Clock Card */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <div className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-mono">
                {formatTime(currentTime)}
                <span className="text-xs font-sans text-slate-400 ml-2 font-medium tracking-normal">WIB</span>
              </div>
              <div className="text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-2">
                <Clock size={13} className="text-blue-400" />
                <span className="capitalize">{formatDate(currentTime)}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Terminal Enforcement
              </div>
              <div
                className={`text-xs font-mono font-bold mt-1 px-2.5 py-1 rounded inline-flex items-center gap-1.5 border ${
                  isApproved
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {isApproved ? 'COMMIT_ATTENDANCE_ENABLED' : 'READONLY_INQUIRY_ONLY'}
              </div>
            </div>
          </div>

          {/* High-Tech Camera HUD Viewport */}
          <div className="flex-1 min-h-[380px] relative">
            <CameraFeed className="w-full h-full" onFacesDetected={handleFacesDetected} />
          </div>

          {/* Biometric Instruction Strip */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>
                Position your face steadily within optical view. System runs multi-target identification with <strong>MiniFASNet v2</strong> anti-spoofing defense.
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0">
              <Radio size={12} className="text-blue-400 animate-pulse" />
              <span>GATEWAY ACTIVE</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Verification Event Stream */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex-1 bg-[#0B0F19] border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
            {/* Stream Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Verification Stream
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {recentLogs.length} RECENT
              </span>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
              {recentLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <Clock size={18} />
                  </div>
                  <div className="text-xs font-medium text-slate-400">No Biometric Logs Recorded Today</div>
                  <div className="text-[11px] text-slate-400 max-w-xs">
                    Staff appearances at authorized terminals will automatically stream here.
                  </div>
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-900/30 hover:bg-slate-900/70 border border-transparent hover:border-slate-800 transition-all flex items-center gap-3.5 group"
                  >
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0 overflow-hidden relative shadow-sm">
                      {log.photo_url ? (
                        <img src={log.photo_url} alt={log.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitial(log.name)
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                        {log.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {log.nomor_induk || 'NO_ID'}
                      </div>
                    </div>

                    {/* Timestamp & Confidence */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {formatLogTime(log.timestamp)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {log.confidence ? `${(log.confidence * 100).toFixed(0)}% MATCH` : 'VERIFIED'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Status Footer */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>PUSTEKOM HARDWARE GATEWAY</span>
              <span className="text-emerald-400">ENCRYPTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KIOSK SETTINGS & TOKEN MODAL ─────────────────────────────── */}
      {showKioskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Monitor size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm text-white">Hardware Terminal Configuration</h3>
              </div>
              <button
                onClick={() => setShowKioskModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {/* Hardware Token Details */}
            <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">HARDWARE ID:</span>
                <span className="text-blue-400 font-bold">{kioskId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">AUTHORIZATION:</span>
                <span className={isApproved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {isApproved ? 'APPROVED (FULL COMMITS)' : 'PENDING APPROVAL'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CRYPTO PAIRING:</span>
                <span className="text-slate-300">256-BIT TOKEN PAIRED</span>
              </div>
            </div>

            {/* Terminal Location Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Terminal Name / Installation Location
              </label>
              <input
                type="text"
                value={tempKioskName}
                onChange={(e) => setTempKioskName(e.target.value)}
                placeholder="Contoh: Kiosk Lobi Utama Lt. 1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Identitas ini memudahkan pemantauan kehadiran berdasarkan lokasi fisik terminal.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowKioskModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={handleSaveKioskName}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm shadow-blue-500/20"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
