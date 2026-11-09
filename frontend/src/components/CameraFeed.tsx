'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { attendanceApi } from '@/lib/api';
import { ShieldCheck, ShieldAlert, Cpu, Camera, AlertTriangle } from 'lucide-react';

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

  // High-Tech Industrial HUD Corner Bracket Drawer
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

      // Video has scaleX(-1) mirror effect
      const mirroredX = canvas.width - (rawX2 * scaleX);
      const mirroredY = rawY1 * scaleY;

      // Color scheme based on biometric decision
      let themeColor = '#38bdf8'; // Sky blue default
      let bgPillColor = 'rgba(15, 23, 42, 0.85)';
      let label = 'VERIFYING';
      let sublabel = '';

      if (face.status === 'spoof' || !face.is_real) {
        themeColor = '#f43f5e'; // Rose / Crimson
        label = 'THREAT REJECTED';
        sublabel = 'ANTI-SPOOF TRIGGERED';
      } else if (face.status === 'recognized') {
        themeColor = '#10b981'; // Emerald
        label = (face.name || face.user?.name || 'VERIFIED').toUpperCase();
        sublabel = `MATCH ${(face.confidence || 0).toFixed(1)}% • RECORDED`;
      } else if (face.status === 'debounced') {
        themeColor = '#06b6d4'; // Cyan
        label = (face.name || face.user?.name || 'ATTENDED').toUpperCase();
        sublabel = 'COOLDOWN ACTIVE';
      } else if (face.status === 'already_attended') {
        themeColor = '#38bdf8'; // Blue
        label = (face.name || face.user?.name || 'ATTENDED').toUpperCase();
        sublabel = `RECORDED AT ${face.formatted_time || 'TODAY'}`;
      } else if (face.status === 'not_attended') {
        themeColor = '#f59e0b'; // Amber
        label = (face.name || face.user?.name || 'IDENTIFIED').toUpperCase();
        sublabel = 'NOT LOGGED TODAY';
      } else if (face.status === 'low_confidence' || face.status === 'unknown') {
        themeColor = '#94a3b8'; // Slate
        label = 'UNREGISTERED';
        sublabel = 'NO BIOMETRIC MATCH';
      }

      ctx.save();

      // 1. Draw Corner HUD Brackets (Precision Enterprise Look)
      const cornerLen = Math.min(24, boxW * 0.25, boxH * 0.25);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(mirroredX, mirroredY + cornerLen);
      ctx.lineTo(mirroredX, mirroredY);
      ctx.lineTo(mirroredX + cornerLen, mirroredY);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(mirroredX + boxW - cornerLen, mirroredY);
      ctx.lineTo(mirroredX + boxW, mirroredY);
      ctx.lineTo(mirroredX + boxW, mirroredY + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(mirroredX, mirroredY + boxH - cornerLen);
      ctx.lineTo(mirroredX, mirroredY + boxH);
      ctx.lineTo(mirroredX + cornerLen, mirroredY + boxH);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(mirroredX + boxW - cornerLen, mirroredY + boxH);
      ctx.lineTo(mirroredX + boxW, mirroredY + boxH);
      ctx.lineTo(mirroredX + boxW, mirroredY + boxH - cornerLen);
      ctx.stroke();

      // Subtle target bounding box outline (light translucent)
      ctx.strokeStyle = themeColor + '33'; // 20% opacity
      ctx.lineWidth = 1;
      ctx.strokeRect(mirroredX, mirroredY, boxW, boxH);

      // 2. High-Tech Monospace Identification Badge
      const pillHeight = sublabel ? 38 : 24;
      const pillY = Math.max(8, mirroredY - pillHeight - 8);

      // Measure font
      ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, Menlo, monospace';
      const labelMetrics = ctx.measureText(label);
      ctx.font = '9px "JetBrains Mono", ui-monospace, Menlo, monospace';
      const subMetrics = sublabel ? ctx.measureText(sublabel) : { width: 0 };
      const contentWidth = Math.max(labelMetrics.width, subMetrics.width);
      const pillWidth = Math.max(110, contentWidth + 24);

      // Frosted dark pill background
      ctx.fillStyle = bgPillColor;
      ctx.beginPath();
      ctx.roundRect(mirroredX, pillY, pillWidth, pillHeight, 6);
      ctx.fill();

      // Subtle border for the pill
      ctx.strokeStyle = themeColor + '88';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left vertical accent strip
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.roundRect(mirroredX, pillY, 3, pillHeight, [6, 0, 0, 6]);
      ctx.fill();

      // Text rendering
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, Menlo, monospace';
      ctx.fillText(label, mirroredX + 10, pillY + (sublabel ? 16 : 16));

      if (sublabel) {
        ctx.fillStyle = themeColor;
        ctx.font = '800 9px "JetBrains Mono", ui-monospace, Menlo, monospace';
        ctx.fillText(sublabel, mirroredX + 10, pillY + 30);
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
        // Silently tolerate single network frame drops
      } finally {
        setIsProcessing(false);
      }
    }, 'image/jpeg', 0.82);
  }, [status, isProcessing, drawFaceOverlays, onFacesDetected]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (status === 'active') {
      interval = setInterval(captureFrame, 1600);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [status, captureFrame]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStatus('active');
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setStatus('denied');
          setErrorMessage('Izin kamera ditolak oleh browser. Harap aktifkan izin kamera pada address bar.');
        } else if (err.name === 'NotFoundError') {
          setStatus('error');
          setErrorMessage('Tidak ada sensor kamera yang terhubung pada perangkat ini.');
        } else {
          setStatus('error');
          setErrorMessage(`Inisialisasi perangkat gagal: ${err.message}`);
        }
      }
    }

    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-[#070B14] border border-slate-800 rounded-xl select-none shadow-2xl ${className}`}
    >
      {/* Video Feed (mirrored for natural interaction) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          status === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Target Canvas Layer */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />

      {/* Capture Canvas (Offscreen) */}
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* HUD Telemetry: Top Status Overlay */}
      {status === 'active' && (
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 border border-slate-800 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-slate-200 tracking-wider">OPTICAL LIVE</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 border border-slate-800 backdrop-blur-md">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span className="text-[10px] font-mono font-semibold text-slate-300">MINIFASNET LIVENESS ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isProcessing ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-950/80 border border-blue-800/80 backdrop-blur-md text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                <span className="text-[10px] font-mono font-bold">ANALYZING FRAME</span>
              </div>
            ) : (
              <div className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800/60 text-slate-400 text-[10px] font-mono">
                STANDBY
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUD Telemetry: Bottom Bar */}
      {status === 'active' && (
        <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-10 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800/80 backdrop-blur-md">
            <Cpu size={11} className="text-slate-500" />
            <span>ARCFACE-RESNET100 • ONNX RUNTIME</span>
          </div>

          <div className="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800/80 backdrop-blur-md text-slate-400">
            AUTO-CAPTURE: 1.6s
          </div>
        </div>
      )}

      {/* Loading State */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B14] text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="text-xs font-mono tracking-wider text-slate-300">INITIALIZING OPTICAL SENSOR...</div>
        </div>
      )}

      {/* Error & Permission Denied State */}
      {(status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0F19] text-center p-8 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-white mb-1">SENSOR CAPTURE ERROR</div>
            <div className="text-xs text-slate-400 max-w-sm">{errorMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
}
