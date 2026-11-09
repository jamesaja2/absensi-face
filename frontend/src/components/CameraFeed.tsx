'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { attendanceApi } from '@/lib/api';

interface CameraFeedProps {
  className?: string;
  onFacesDetected?: (faces: any[]) => void;
}

interface DetectedFaceBox {
  status: 'recognized' | 'debounced' | 'spoof' | 'unknown' | 'low_confidence';
  is_real: boolean;
  box: { x_min: number; y_min: number; x_max: number; y_max: number };
  name?: string;
  confidence?: number;
  message?: string;
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

      // Coordinate mapping with mirror horizontal flip
      const rawX1 = face.box.x_min;
      const rawX2 = face.box.x_max;
      const rawY1 = face.box.y_min;
      const rawY2 = face.box.y_max;

      const boxW = (rawX2 - rawX1) * scaleX;
      const boxH = (rawY2 - rawY1) * scaleY;

      // Because video has scaleX(-1), mirrored x position is:
      const mirroredX = canvas.width - (rawX2 * scaleX);
      const mirroredY = rawY1 * scaleY;

      let color = '#3b82f6'; // default blue
      let text = 'Mengecek...';

      if (face.status === 'spoof' || !face.is_real) {
        color = '#ef4444'; // Red
        text = '⚠️ SPOOFING TERDETEKSI';
      } else if (face.status === 'recognized') {
        color = '#10b981'; // Green
        text = `✓ ${face.name || 'Terabsen'} (${(face.confidence || 0).toFixed(0)}%)`;
      } else if (face.status === 'debounced') {
        color = '#0284c7'; // Cyan
        text = `ℹ️ ${face.name || 'Sudah Absen'}`;
      } else if (face.status === 'low_confidence' || face.status === 'unknown') {
        color = '#f59e0b'; // Amber
        text = 'Wajah Belum Terdaftar';
      }

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(mirroredX, mirroredY, boxW, boxH);

      // Draw background pill for label
      ctx.font = 'bold 12px sans-serif';
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const labelH = 22;
      const labelW = textWidth + 16;
      const labelY = Math.max(0, mirroredY - labelH - 4);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(mirroredX, labelY, labelW, labelH, 4);
      ctx.fill();

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, mirroredX + 8, labelY + 15);
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

          // Reset clear timer
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            setDetectedFaces([]);
            const overlay = overlayCanvasRef.current;
            if (overlay) {
              const ctx = overlay.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
            }
          }, 2500);
        }
      } catch (err) {
        // Silently ignore network hiccup during recognition
      } finally {
        setIsProcessing(false);
      }
    }, 'image/jpeg', 0.82);
  }, [status, isProcessing, drawFaceOverlays, onFacesDetected]);

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
          setErrorMessage('Akses kamera ditolak. Harap izinkan akses kamera di browser Anda.');
        } else if (err.name === 'NotFoundError') {
          setStatus('error');
          setErrorMessage('Tidak ada kamera yang terdeteksi.');
        } else {
          setStatus('error');
          setErrorMessage(`Error: ${err.message}`);
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
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: 12, background: '#0f172a', border: '1px solid var(--color-border)' }}
    >
      {/* Video feed */}
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

      {/* Real-time bounding box overlay */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Hidden offscreen canvas for snapshot captures */}
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      {/* Loading state */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Menghubungkan ke kamera...</p>
        </div>
      )}

      {/* Error state */}
      {(status === 'denied' || status === 'error') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 24, textAlign: 'center' }}>
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.5} style={{ marginBottom: 12 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Kamera Tidak Tersedia</p>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>{errorMessage}</p>
        </div>
      )}

      {/* Active badges */}
      {status === 'active' && (
        <>
          {/* Live badge */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live</span>
          </div>

          {/* Anti-spoof active badge */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', backdropFilter: 'blur(4px)' }}>
            <span style={{ fontSize: 11 }}>🛡️</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399' }}>Anti-Spoofing Aktif</span>
          </div>

          {/* Processing pulse */}
          {isProcessing && (
            <div style={{ position: 'absolute', bottom: 12, right: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.5)', color: '#93c5fd', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', animation: 'spin 1s linear infinite' }} />
              Memproses...
            </div>
          )}
        </>
      )}
    </div>
  );
}
