'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraFeedProps {
  className?: string;
}

export default function CameraFeed({ className = '' }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'active' | 'denied' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
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
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-dark-700 ${className}`}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          status === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: 'scaleX(-1)' }} // Mirror effect
      />

      {/* Loading state */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-700">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-brand-primary opacity-20 animate-ping-slow" />
            <div className="absolute inset-2 rounded-full border-2 border-t-brand-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <svg
              className="absolute inset-3 w-10 h-10 text-brand-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 animate-pulse">Menghubungkan ke kamera...</p>
        </div>
      )}

      {/* Error / denied state */}
      {(status === 'denied' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-700 p-6 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="text-sm text-red-400 font-medium mb-1">Kamera Tidak Tersedia</p>
          <p className="text-xs text-slate-500">{errorMessage}</p>
        </div>
      )}

      {/* Active overlay — corner brackets */}
      {status === 'active' && (
        <>
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-brand-accent opacity-60 rounded-tl" />
          <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-brand-accent opacity-60 rounded-tr" />
          <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-brand-accent opacity-60 rounded-bl" />
          <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-brand-accent opacity-60 rounded-br" />

          {/* Scan line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent to-transparent scan-line opacity-50" />

          {/* Live badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-white/70 tracking-widest uppercase">Live</span>
          </div>
        </>
      )}
    </div>
  );
}
