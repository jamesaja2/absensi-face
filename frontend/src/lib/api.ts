import axios from 'axios';
import { getKioskId, getKioskToken } from './kiosk';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
});

// Attach JWT token & Kiosk Credentials to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['x-kiosk-id'] = getKioskId();
    const kioskToken = getKioskToken();
    if (kioskToken) {
      config.headers['x-kiosk-token'] = kioskToken;
    }
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  googleLogin: (credential: string) =>
    api.post('/auth/google', { credential }),
  verify: () =>
    api.post('/auth/verify'),
  getMe: () =>
    api.get('/auth/me'),
};

// ── Admin Users Management ───────────────────────────────────────────────────
export const adminUsersApi = {
  getAll: () => api.get('/admin/users'),
  create: (data: { email: string; name: string; role: 'super_admin' | 'admin' | 'operator' }) =>
    api.post('/admin/users', data),
  update: (id: number, data: { role?: string; status?: string; name?: string }) =>
    api.patch(`/admin/users/${id}`, data),
  delete: (id: number) => api.delete(`/admin/users/${id}`),
};

// ── Kiosks Management ─────────────────────────────────────────────────────────
export const kiosksApi = {
  getStatus: (kioskId: string) => api.get(`/kiosks/status/${encodeURIComponent(kioskId)}`),
  getAll: () => api.get('/admin/kiosks'),
  update: (kioskId: string, data: { status?: 'APPROVED' | 'PENDING' | 'REJECTED'; name?: string }) =>
    api.patch(`/admin/kiosks/${encodeURIComponent(kioskId)}`, data),
  delete: (kioskId: string) => api.delete(`/admin/kiosks/${encodeURIComponent(kioskId)}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: (params?: { search?: string }) => api.get('/users', { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  create: (data: FormData) =>
    api.post('/users', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: FormData) =>
    api.put(`/users/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/users/${id}`),
  importCSV: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/users/import-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  getLogs: (params?: {
    date?: string;
    start_date?: string;
    end_date?: string;
    user_id?: number;
    kiosk_id?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) => api.get('/attendance', { params }),

  getAnalytics: () => api.get('/attendance/analytics'),

  exportExcel: (params?: { start_date?: string; end_date?: string; kiosk_id?: string; user_id?: number }) => {
    const filtered: Record<string, string> = {};
    if (params?.start_date) filtered.start_date = params.start_date;
    if (params?.end_date) filtered.end_date = params.end_date;
    if (params?.kiosk_id && params.kiosk_id !== 'all') filtered.kiosk_id = params.kiosk_id;
    if (params?.user_id) filtered.user_id = String(params.user_id);
    const queryStr = new URLSearchParams(filtered).toString();
    window.open(`${BACKEND_URL}/api/attendance/export-excel${queryStr ? '?' + queryStr : ''}`, '_blank');
  },

  recognize: (blob: Blob, customKioskId?: string) => {
    const form = new FormData();
    form.append('file', blob, 'frame.jpg');
    const kioskId = customKioskId || getKioskId();
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
      'x-kiosk-id': kioskId,
    };
    const kioskToken = getKioskToken();
    if (kioskToken) {
      headers['x-kiosk-token'] = kioskToken;
    }
    return api.post('/attendance/recognize', form, { headers });
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'operator';
  avatar_url: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface Kiosk {
  id: number;
  kiosk_id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  ip_address: string | null;
  user_agent: string | null;
  last_seen: string | null;
  created_at: string;
  total_attendance?: string | number;
  today_attendance?: string | number;
}

export interface User {
  id: number;
  name: string;
  nomor_induk: string;
  email?: string | null;
  photo_url: string | null;
  compreface_subject_id: string | null;
  created_at: string;
  total_attendance?: number;
  last_attendance?: string;
}

export interface AttendanceLog {
  id: number;
  timestamp: string;
  status: string;
  confidence: number;
  is_real: boolean;
  liveness_score?: number;
  kiosk_id: string;
  kiosk_name?: string;
  user_id: number;
  name: string;
  nomor_induk: string;
  email?: string | null;
  photo_url: string | null;
}

export interface AnalyticsData {
  today: {
    totalAttendance: number;
    uniqueUsers: number;
    avgConfidence: string;
    totalRegisteredUsers: number;
    attendanceRate: number;
  };
  kiosks: {
    total: number;
    approved: number;
    pending: number;
  };
  hourly: { hour: string; count: string | number }[];
  byKiosk: { kiosk_name: string; kiosk_id: string; count: string | number }[];
  weeklyTrend: { date: string; day_name: string; count: string | number }[];
  recentLogs: AttendanceLog[];
}
