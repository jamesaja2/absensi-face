import axios from 'axios';

const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const BACKEND_URL = envUrl !== undefined ? envUrl : 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  verify: () =>
    api.post('/auth/verify'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get('/users'),
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
  getLogs: (params?: { date?: string; user_id?: number; limit?: number; offset?: number }) =>
    api.get('/attendance', { params }),
  getStatsToday: () => api.get('/attendance/stats/today'),
  exportCSV: (params?: { date?: string; user_id?: number }) => {
    const queryStr = new URLSearchParams(params as Record<string, string>).toString();
    window.open(`${BACKEND_URL}/api/attendance/export?${queryStr}`, '_blank');
  },
  recognize: (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, 'frame.jpg');
    return api.post('/attendance/recognize', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  nomor_induk: string;
  photo_url: string | null;
  compreface_subject_id: string | null;
  created_at: string;
  total_attendance?: number;
}

export interface AttendanceLog {
  id: number;
  timestamp: string;
  status: string;
  confidence: number;
  user_id: number;
  name: string;
  nomor_induk: string;
  photo_url: string | null;
}

export interface TodayStats {
  date: string;
  totalAttendanceToday: number;
  totalUsers: number;
  latestLog: AttendanceLog | null;
  hourlyBreakdown: { hour: string; count: number }[];
}
