'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { attendanceApi } from '@/lib/api';

interface CameraFeedProps {
  className?: string;
}

export default function CameraFeed({ className = '' }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'active' | 'denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || status !== 'active') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await attendanceApi.recognize(blob);
      } catch (err) {
        // Silently ignore recognition errors
      }
    }, 'image/jpeg', 0.8);
  }, [status]);

  useEffect(() => {
    if (status === 'active') {
      intervalRef.current = setInterval(captureFrame, 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
    return () => { if (stream) stream.getTracks().forEach((track) => track.stop()); };
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: 12, background: '#f1f5f9', border: '1px solid var(--color-border)' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: 'scaleX(-1)',
          opacity: status === 'active' ? 1 : 0,
          transition: 'opacity 0.5s',
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Menghubungkan ke kamera...</p>
        </div>
      )}

      {/* Error */}
      {(status === 'denied' || status === 'error') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 24, textAlign: 'center' }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--color-danger)" strokeWidth={1.5} style={{ marginBottom: 12 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-danger)', marginBottom: 4 }}>Kamera Tidak Tersedia</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{errorMessage}</p>
        </div>
      )}

      {/* Active overlay */}
      {status === 'active' && (
        <>
          {/* Corner brackets */}
          <div style={{ position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderTop: '2px solid rgba(37,99,235,0.5)', borderLeft: '2px solid rgba(37,99,235,0.5)', borderRadius: '4px 0 0 0' }} />
          <div style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderTop: '2px solid rgba(37,99,235,0.5)', borderRight: '2px solid rgba(37,99,235,0.5)', borderRadius: '0 4px 0 0' }} />
          <div style={{ position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderBottom: '2px solid rgba(37,99,235,0.5)', borderLeft: '2px solid rgba(37,99,235,0.5)', borderRadius: '0 0 0 4px' }} />
          <div style={{ position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderBottom: '2px solid rgba(37,99,235,0.5)', borderRight: '2px solid rgba(37,99,235,0.5)', borderRadius: '0 0 4px 0' }} />

          {/* Live badge */}
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 2s infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
          </div>
        </>
      )}
    </div>
  );
}
