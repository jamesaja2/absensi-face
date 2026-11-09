'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { ShieldCheck, Eye, EyeOff, Lock, User, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

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
          window.google.accounts.id.renderButton(targetDiv, {
            theme: 'filled_black',
            size: 'large',
            width: 360,
            text: 'continue_with',
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
      toast.success('Autentikasi administrator berhasil');
      router.push('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Kredensial tidak valid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090D16] text-[#F8FAFC] flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      <Toaster position="top-center" />

      {/* Top Subtle App Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-slate-800/60 bg-[#090D16]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm">
            <Cpu size={16} />
          </div>
          <div>
            <span className="font-bold tracking-tight text-sm text-slate-100">PUSTEKOM BIOMETRIC OS</span>
            <span className="text-[10px] text-slate-500 font-mono ml-2 uppercase px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
              Enterprise v2.0
            </span>
          </div>
        </div>

        <a
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60"
        >
          <span>Terminal Kiosk</span>
          <ArrowRight size={12} />
        </a>
      </header>

      {/* Center Auth Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Header Card */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20 text-white mb-4">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Administrator Access</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Secure authentication gateway for attendance operations
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0F172A] border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-black/80">
            {/* Google OAuth Section */}
            {googleClientId ? (
              <div className="mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-3">
                  Google Workspace Single Sign-On
                </div>
                <div id="googleAuthContainer" className="flex justify-center" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                    <span className="bg-[#0F172A] px-3 text-slate-500">or sign in with credentials</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Traditional Credentials Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Username / Administrator ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User size={15} />
                  </div>
                  <input
                    id="admin-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#090D16] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock size={15} />
                  </div>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#090D16] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Authenticate Session</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Security Badges */}
      <footer className="px-8 py-5 border-t border-slate-900 text-center text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#090D16]">
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ArcFace GPU & MiniFASNet Online
          </span>
          <span className="text-slate-800">•</span>
          <span>PostgreSQL Active</span>
          <span className="text-slate-800">•</span>
          <span>Zero-CORS Reverse Proxy</span>
        </div>

        <div className="text-[11px] text-slate-500">
          PUSTEKOM Enterprise Attendance Terminal © 2026. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
