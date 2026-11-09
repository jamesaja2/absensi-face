'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { Eye, EyeOff, Lock, User, ArrowLeft, ShieldCheck } from 'lucide-react';

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

  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '961412708536-r7d1390rqd66hrnkgq9dctb58ur5rnh0.apps.googleusercontent.com';

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      authApi
        .verify()
        .then(() => router.replace('/admin/dashboard'))
        .catch(() => localStorage.removeItem('admin_token'));
    }
  }, [router]);

  // Load Google Identity Services SDK
  useEffect(() => {
    if (!googleClientId) return;

    const loadScript = () => {
      if (document.getElementById('google-jssdk')) {
        initGIS();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGIS;
      document.body.appendChild(script);
    };

    const initGIS = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        const targetDiv = document.getElementById('googleAuthContainer');
        if (targetDiv) {
          targetDiv.innerHTML = '';
          window.google.accounts.id.renderButton(targetDiv, {
            theme: 'outline',
            size: 'large',
            width: 360,
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
      const msg = err.response?.data?.error || 'Login Google OAuth gagal';
      toast.error(msg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Masukkan username dan password administrator');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      localStorage.setItem('admin_token', res.data.token);
      localStorage.setItem('admin_user', JSON.stringify(res.data.user));
      toast.success(`Login berhasil. Halo, ${res.data.user.name || res.data.user.username}!`);
      router.push('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F5F7] flex flex-col justify-center items-center p-4 font-sans select-none text-slate-800">
      <Toaster position="top-center" />

      {/* Cloudflare-style Container */}
      <div className="w-full max-w-[420px]">
        {/* Brand Logo & Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="PUSTEKOM" className="h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Log in to PUSTEKOM</h1>
          <p className="text-xs text-slate-500 mt-1">Sistem Manajemen Absensi & Biometrik Wajah</p>
        </div>

        {/* Clean White Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
          {/* Google SSO Section */}
          <div className="space-y-3">
            <div className="flex justify-center" id="googleAuthContainer" />

            {!googleClientReady && (
              <button
                type="button"
                disabled
                className="w-full h-10 flex items-center justify-center gap-3 px-4 border border-slate-300 rounded text-xs font-semibold text-slate-600 bg-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Memuat Google OAuth...</span>
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-white px-3 text-slate-400 font-medium">atau masuk dengan akun lokal</span>
            </div>
          </div>

          {/* Local Credential Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-slate-800 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-slate-800 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0051C3] hover:bg-[#0045A5] text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk ke Dashboard</span>
              )}
            </button>
          </form>
        </div>

        {/* Back Link */}
        <div className="mt-6 flex items-center justify-center text-xs text-slate-500 px-1">
          <a
            href="/"
            className="flex items-center gap-1.5 hover:text-slate-900 transition-colors font-medium"
          >
            <ArrowLeft size={13} />
            <span>Kembali ke Kiosk Presensi</span>
          </a>
        </div>
      </div>
    </main>
  );
}
