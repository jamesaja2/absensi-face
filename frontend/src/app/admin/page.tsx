'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheck, Eye, EyeOff, Lock, UserCheck } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleClientReady, setGoogleClientReady] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      authApi.verify()
        .then(() => router.replace('/admin/dashboard'))
        .catch(() => localStorage.removeItem('admin_token'));
    }
  }, [router]);

  // Load Google Identity Services Script
  useEffect(() => {
    if (!googleClientId) return;

    const loadScript = () => {
      if (document.getElementById('google-jssdk')) {
        initializeGoogle();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.body.appendChild(script);
    };

    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        });

        const btnContainer = document.getElementById('googleSignInBtn');
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          });
        }
        setGoogleClientReady(true);
      }
    };

    loadScript();
  }, [googleClientId]);

  const handleGoogleResponse = async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const res = await authApi.googleLogin(response.credential);
      localStorage.setItem('admin_token', res.data.token);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      toast.success(`Selamat datang, ${res.data.user.name}!`);
      router.push('/admin/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Login Google gagal';
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Isi username dan password');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      localStorage.setItem('admin_token', res.data.token);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      toast.success('Login berhasil!');
      router.push('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0F172A', // Dark Slate 900
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <Toaster position="top-center" />

      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
              marginBottom: 16,
            }}
          >
            <ShieldCheck size={32} color="#FFFFFF" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
            Portal Administrator
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>
            Enterprise Facial Attendance & Kiosk Management System
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#1E293B',
            borderRadius: 16,
            padding: 32,
            border: '1px solid #334155',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Google Sign-in Option */}
          {googleClientId ? (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Masuk Cepat dengan Akun Google
              </label>
              <div id="googleSignInBtn" style={{ display: 'flex', justifyContent: 'center' }} />
              <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#334155' }} />
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>atau login kredensial</span>
                <div style={{ flex: 1, height: 1, background: '#334155' }} />
              </div>
            </div>
          ) : null}

          {/* Credentials Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: 6 }}>
                Username / Email
              </label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#0F172A',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>Password</label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 14px',
                    borderRadius: 8,
                    background: '#0F172A',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                border: 'none',
                background: '#2563EB',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: 6,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
            </button>
          </form>

          {/* Footer note */}
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            <a href="/" style={{ color: '#60A5FA', textDecoration: 'none' }}>
              ← Kembali ke Terminal Absensi Kiosk
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
