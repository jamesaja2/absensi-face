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
  Clock,
  ArrowRight,
  Info,
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
        const logsRes = await attendanceApi.getLogs({ limit: 12 });
        setRecentLogs(logsRes.data.logs || []);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 20000);
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

    // Attendance Recorded Event
    socket.on('attendance:kiosk_event', (data: any) => {
      if (data?.log) {
        setRecentLogs((prev) => [data.log, ...prev].slice(0, 12));
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

    // Inquiry Event (Check Mode)
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

    // Kiosk status updated by admin live
    socket.on('kiosk:status_changed', (kiosk: any) => {
      if (kiosk.kiosk_id === kioskId) {
        setIsApproved(kiosk.status === 'APPROVED');
        if (kiosk.name) setKioskNameState(kiosk.name);
        toast.success(`Status Kiosk diperbarui: ${kiosk.status}`);
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
    // Local detection feedback for spoofing
    const spoofFace = faces.find((f) => f.status === 'spoof' || !f.is_real);
    if (spoofFace) {
      setPopupEvent({
        id: String(Date.now()),
        mode: 'ATTENDANCE',
        status: 'spoof',
        name: 'Peringatan Spoofing',
        message: 'Layar HP atau media cetak terdeteksi (Anti-Spoofing)',
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

  const formatConfidence = (conf?: number | null) => {
    if (conf === undefined || conf === null) return 'Hadir';
    const num = Number(conf);
    if (isNaN(num) || num <= 0) return 'Hadir';
    const percentage = num > 1 ? num : num * 100;
    return `${Math.min(100, percentage).toFixed(0)}% Cocok`;
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
    <main className="min-h-screen bg-[#F4F5F7] text-slate-800 flex flex-col select-none font-sans">
      <Toaster position="top-center" />

      {/* Floating Biometric Event Notification Badge */}
      <AttendancePopup
        event={popupEvent}
        onDismiss={() => setPopupEvent(null)}
        autoDismissMs={4500}
      />

      {/* ── CLEAN TOP NAVBAR (Cloudflare Style) ────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3.5">
          <img src="/logo.png" alt="PUSTEKOM" className="h-9 object-contain" />
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              Sistem Presensi Wajah PUSTEKOM
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Terminal Multi-Face & Anti-Spoofing</p>
          </div>
        </div>

        {/* Center: Kiosk Status Pill */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setShowKioskModal(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isApproved === true
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : isApproved === false
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="Klik untuk info & pengaturan terminal"
          >
            <Monitor size={14} className={isApproved === true ? 'text-emerald-600' : 'text-amber-600'} />
            <span>{kioskNameState || kioskId}</span>
            <span className="text-slate-300">•</span>
            {isApproved === true ? (
              <span className="flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 size={13} />
                <span>Approved (Pencatat Presensi)</span>
              </span>
            ) : isApproved === false ? (
              <span className="flex items-center gap-1 font-bold text-amber-700">
                <AlertCircle size={13} />
                <span>Mode Cek (Menunggu Persetujuan)</span>
              </span>
            ) : (
              <span>Memeriksa status...</span>
            )}
            <Settings size={13} className="text-slate-400 ml-1" />
          </button>
        </div>

        {/* Right: Connection dot */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span>{socketConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* ── UNAPPROVED KIOSK WARNING BANNER ──────────────────────────── */}
      {isApproved === false && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <span>
              <strong>Terminal dalam Mode Pemeriksaan:</strong> Kiosk ID{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold text-amber-900">
                {kioskId}
              </code>{' '}
              belum disetujui Admin. Wajah dikenali untuk <em>memeriksa status jam absen</em>, namun{' '}
              <strong>tidak mencatat presensi baru</strong> sampai disetujui di Admin Dashboard.
            </span>
          </div>
          <button
            onClick={() => setShowKioskModal(true)}
            className="underline underline-offset-2 font-semibold text-amber-800 hover:text-amber-950 shrink-0 ml-4"
          >
            Info Kiosk
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE GRID ──────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Camera & Time */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Synchronized Precision Clock Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 font-mono">
                {formatTime(currentTime)}
                <span className="text-xs font-sans text-slate-500 ml-2 font-medium">WIB</span>
              </div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-2">
                <Clock size={13} className="text-blue-600" />
                <span className="capitalize">{formatDate(currentTime)}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                Mode Terminal
              </div>
              <div
                className={`text-xs font-bold mt-1 px-2.5 py-1 rounded inline-flex items-center gap-1.5 border ${
                  isApproved
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span>{isApproved ? 'Presensi Otomatis Aktif' : 'Cek Status Kehadiran'}</span>
              </div>
            </div>
          </div>

          {/* Camera Viewport Container */}
          <div className="flex-1 min-h-[380px] relative">
            <CameraFeed className="w-full h-full" onFacesDetected={handleFacesDetected} />
          </div>
        </div>

        {/* RIGHT COLUMN: Live Attendance Feed */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
            {/* Stream Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Aktivitas Kehadiran Terakhir
                </span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                {recentLogs.length} Terakhir
              </span>
            </div>

            {/* Attendance List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
              {recentLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                  <Clock size={24} className="text-slate-300" />
                  <div className="text-xs font-medium text-slate-500">Belum ada presensi tercatat hari ini</div>
                  <div className="text-[11px] text-slate-400 max-w-xs">
                    Karyawan yang terdeteksi di terminal akan otomatis muncul di sini.
                  </div>
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-3.5 group"
                  >
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                      {log.photo_url ? (
                        <img src={log.photo_url} alt={log.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitial(log.name)
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {log.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {log.nomor_induk || '—'}
                      </div>
                    </div>

                    {/* Timestamp & Score */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-700 font-mono">
                        {formatLogTime(log.timestamp)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatConfidence(log.confidence)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Status Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
              <span>PUSTEKOM Biometric Terminal</span>
              <span className="font-semibold text-emerald-700">Online & Terenkripsi</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KIOSK SETTINGS MODAL ── */}
      {showKioskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Monitor size={18} className="text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Pengaturan Terminal Kiosk</h3>
              </div>
              <button
                onClick={() => setShowKioskModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Kiosk Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Kiosk ID:</span>
                <span className="font-mono font-bold text-slate-800">{kioskId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status Lisensi:</span>
                <span className={isApproved ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                  {isApproved ? 'APPROVED (Pencatat Resmi)' : 'PENDING (Menunggu Persetujuan Admin)'}
                </span>
              </div>
            </div>

            {/* Terminal Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lokasi Terminal
              </label>
              <input
                type="text"
                value={tempKioskName}
                onChange={(e) => setTempKioskName(e.target.value)}
                placeholder="Contoh: Kiosk Lobi Utama Lt. 1"
                className="w-full bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500">
                Beri nama yang jelas untuk membedakan lokasi fisik perangkat kiosk ini.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowKioskModal(false)}
                className="px-3.5 py-2 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={handleSaveKioskName}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm"
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
