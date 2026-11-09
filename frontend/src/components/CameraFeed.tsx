'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { attendanceApi } from '@/lib/api';
import { ShieldCheck, Camera, AlertCircle, RefreshCw, Download, ExternalLink } from 'lucide-react';

interface CameraFeedProps {
  className?: string;
  onFacesDetected?: (faces: any[]) => void;
}

interface DetectedFaceBox {
  status: 'recognized' | 'debounced' | 'spoof' | 'unknown' | 'low_confidence' | 'already_attended' | 'not_attended';
  is_real: boolean;
  box: { x_min: number; y_min: number; x_max: number; y_max: number };
  name?: string;
  user?: { name: string; nomor_induk?: string };
  confidence?: number;
  message?: string;
  formatted_time?: string;
}

export default function CameraFeed({ className = '', onFacesDetected }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<'loading' | 'active' | 'denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceBox[]>([]);
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Safe rounded rect helper
  const safeDrawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) => {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, radius);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  };

  // High-precision bounding box & corner brackets overlay
  const drawFaceOverlays = useCallback((faces: DetectedFaceBox[]) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!faces || faces.length === 0) return;

    const scaleX = canvas.width / (video.videoWidth || 1);
    const scaleY = canvas.height / (video.videoHeight || 1);

    faces.forEach((face) => {
      if (!face.box) return;

      const rawX1 = face.box.x_min;
      const rawX2 = face.box.x_max;
      const rawY1 = face.box.y_min;
      const rawY2 = face.box.y_max;

      const boxW = (rawX2 - rawX1) * scaleX;
      const boxH = (rawY2 - rawY1) * scaleY;

      // Video is mirrored via scaleX(-1)
      const mirroredX = canvas.width - (rawX2 * scaleX);
      const mirroredY = rawY1 * scaleY;

      let strokeColor = '#0284c7';
      let badgeBg = '#0284c7';
      let title = 'MEMERIKSA...';
      let subtitle = '';

      // Normalize confidence value (handle both 0-1 and 0-100)
      const rawConf = face.confidence || 0;
      const normConf = rawConf > 1 ? rawConf : rawConf * 100;

      if (face.status === 'spoof' || !face.is_real) {
        strokeColor = '#dc2626';
        badgeBg = '#dc2626';
        title = 'PERINGATAN SPOOFING';
        subtitle = 'Layar HP / Foto Cetak Terdeteksi';
      } else if (face.status === 'recognized') {
        strokeColor = '#16a34a';
        badgeBg = '#16a34a';
        title = (face.name || face.user?.name || 'HADIR').toUpperCase();
        subtitle = `Terverifikasi (${Math.min(100, normConf).toFixed(0)}%)`;
      } else if (face.status === 'debounced') {
        strokeColor = '#2563eb';
        badgeBg = '#2563eb';
        title = (face.name || face.user?.name || 'SUDAH ABSEN').toUpperCase();
        subtitle = 'Sudah Tercatat';
      } else if (face.status === 'already_attended') {
        strokeColor = '#2563eb';
        badgeBg = '#2563eb';
        title = (face.name || face.user?.name || 'SUDAH ABSEN').toUpperCase();
        subtitle = `Waktu: ${face.formatted_time || 'Hari ini'}`;
      } else if (face.status === 'not_attended') {
        strokeColor = '#d97706';
        badgeBg = '#d97706';
        title = (face.name || face.user?.name || 'BELUM ABSEN').toUpperCase();
        subtitle = 'Status: Belum Absen Hari Ini';
      } else if (face.status === 'low_confidence' || face.status === 'unknown') {
        strokeColor = '#64748b';
        badgeBg = '#475569';
        title = 'TIDAK DIKENAL';
        subtitle = 'Wajah Belum Terdaftar';
      }

      ctx.save();

      // 1. Draw corner brackets around target face
      const bracketLen = Math.min(22, boxW * 0.25, boxH * 0.25);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(mirroredX, mirroredY + bracketLen);
      ctx.lineTo(mirroredX, mirroredY);
      ctx.lineTo(mirroredX + bracketLen, mirroredY);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(mirroredX + boxW - bracketLen, mirroredY);
      ctx.lineTo(mirroredX + boxW, mirroredY);
      ctx.lineTo(mirroredX + boxW, mirroredY + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(mirroredX, mirroredY + boxH - bracketLen);
      ctx.lineTo(mirroredX, mirroredY + boxH);
      ctx.lineTo(mirroredX + bracketLen, mirroredY + boxH);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(mirroredX + boxW - bracketLen, mirroredY + boxH);
      ctx.lineTo(mirroredX + boxW, mirroredY + boxH);
      ctx.lineTo(mirroredX + boxW, mirroredY + boxH - bracketLen);
      ctx.stroke();

      // Light bounding outline
      ctx.strokeStyle = strokeColor + '44';
      ctx.lineWidth = 1;
      ctx.strokeRect(mirroredX, mirroredY, boxW, boxH);

      // 2. Identification Pill
      ctx.font = 'bold 12px Inter, sans-serif';
      const titleWidth = ctx.measureText(title).width;
      ctx.font = '10px Inter, sans-serif';
      const subWidth = subtitle ? ctx.measureText(subtitle).width : 0;
      const pillW = Math.max(titleWidth, subWidth) + 20;
      const pillH = subtitle ? 34 : 22;
      const pillY = Math.max(8, mirroredY - pillH - 6);

      ctx.fillStyle = badgeBg;
      safeDrawRoundedRect(ctx, mirroredX, pillY, pillW, pillH, 5);
      ctx.fill();

      // Text inside pill
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(title, mirroredX + 8, pillY + 14);

      if (subtitle) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(subtitle, mirroredX + 8, pillY + 28);
      }

      ctx.restore();
    });
  }, []);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !captureCanvasRef.current || status !== 'active' || isProcessing) return;

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setIsProcessing(true);
      try {
        const response = await attendanceApi.recognize(blob);
        const data = response.data;

        if (data && data.faces && data.faces.length > 0) {
          setDetectedFaces(data.faces);
          drawFaceOverlays(data.faces);
          if (onFacesDetected) {
            onFacesDetected(data.faces);
          }

          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            setDetectedFaces([]);
            const overlay = overlayCanvasRef.current;
            if (overlay) {
              const ctx = overlay.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
            }
          }, 2400);
        }
      } catch (err) {
        // Silently tolerate frame drops
      } finally {
        setIsProcessing(false);
      }
    }, 'image/jpeg', 0.82);
  }, [status, isProcessing, drawFaceOverlays, onFacesDetected]);

  // Periodic frame capture
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === 'active') {
      interval = setInterval(captureFrame, 1800);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [status, captureFrame]);

  // Direct, simple Camera Initialization matching original commit
  const initCamera = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMessage('Browser tidak menyediakan WebRTC Camera API. Pastikan menggunakan Safari, Chrome, atau Edge terbaru.');
      return;
    }

    let stream: MediaStream | null = null;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
      } catch (e1) {
        // Fallback to basic constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        setStatus('active');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMessage('Izin kamera ditolak di browser untuk alamat situs ini.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('error');
        setErrorMessage('Tidak ada kamera yang terdeteksi di perangkat Anda.');
      } else {
        setStatus('error');
        setErrorMessage(`Error: ${err.message || 'Kamera sedang digunakan aplikasi lain'}`);
      }
    }
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [initCamera]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-900 border border-slate-300 rounded-lg select-none shadow-sm ${className}`}
      style={{ minHeight: '360px' }}
    >
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: status === 'active' ? 1 : 0,
          transition: 'opacity 0.4s',
        }}
      />

      {/* Canvas Overlay for corner brackets and labels */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />

      {/* Hidden Offscreen Canvas for Frame Capture */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Clean Light Badges when Camera Active */}
      {status === 'active' && (
        <>
          <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/95 border border-slate-200 shadow-sm text-xs font-medium text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Kamera Aktif</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50/95 border border-emerald-200 text-xs font-semibold text-emerald-800 shadow-sm">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>Anti-Spoofing</span>
            </div>
          </div>

          <div className="absolute top-3 right-3 pointer-events-none z-10">
            {isProcessing && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50/95 border border-blue-200 text-blue-700 text-xs font-medium shadow-sm">
                <RefreshCw size={12} className="animate-spin text-blue-600" />
                <span>Menganalisa...</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Loading State */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-600 space-y-3 p-6 text-center">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-600">Menghubungkan ke kamera...</p>
        </div>
      )}

      {/* Permission Denied State with Clear Step-by-Step Guide */}
      {(status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-center p-6 sm:p-8 space-y-4 overflow-y-auto">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <Camera size={22} />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Akses Kamera Belum Aktif</h4>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              {errorMessage}
            </p>

            {/* Platform Instructions Box */}
            <div className="text-left bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs text-slate-700 mb-3">
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 shrink-0">Safari:</span>
                <span>
                  Buka menu <strong>Safari</strong> (di kiri atas Mac) &gt; <strong>Settings...</strong> &gt; tab <strong>Websites</strong> &gt; <strong>Camera</strong> &gt; ubah <code>192.168.100.52</code> menjadi <strong>Allow (Izinkan)</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2 border-t border-slate-200 pt-2">
                <span className="font-bold text-blue-700 shrink-0">Sertifikat SSL:</span>
                <span>
                  Jika muncul &quot;Not Secure&quot;, Anda dapat mengunduh sertifikat SSL server dan klik <em>Always Trust</em> di Mac Keychain.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={initCamera}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0051C3] hover:bg-[#0045A5] text-white text-xs font-semibold rounded shadow-sm transition-colors"
              >
                <RefreshCw size={13} />
                <span>Coba Nyalakan Kamera</span>
              </button>

              <a
                href="/absensi.crt"
                download="absensi.crt"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-medium rounded transition-colors"
                title="Unduh sertifikat SSL untuk dipasang di Keychain macOS"
              >
                <Download size={13} />
                <span>Unduh SSL (.crt)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
