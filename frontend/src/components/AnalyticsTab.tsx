'use client';

import { AnalyticsData } from '@/lib/api';
import { Users, CheckCircle, Clock, ShieldCheck, Monitor, BarChart3, TrendingUp } from 'lucide-react';

interface AnalyticsTabProps {
  data: AnalyticsData | null;
  onRefresh: () => void;
}

export default function AnalyticsTab({ data, onRefresh }: AnalyticsTabProps) {
  if (!data) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8' }}>
        Memuat data analitik...
      </div>
    );
  }

  const { today, kiosks, hourly, byKiosk, weeklyTrend } = data;

  // Find max count for hourly chart scaling
  const maxHourlyCount = Math.max(1, ...hourly.map(h => Number(h.count)));
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map(w => Number(w.count)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI METRICS CARDS ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Total Hadir Hari Ini */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={26} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {today.totalAttendance}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              Hadir Hari Ini ({today.attendanceRate}% dari {today.totalRegisteredUsers} terdaftar)
            </div>
          </div>
        </div>

        {/* Unique Users */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={26} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {today.uniqueUsers}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              Orang Berbeda Telah Presensi
            </div>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {today.avgConfidence}%
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              Rata-rata Akurasi Pencocokan
            </div>
          </div>
        </div>

        {/* Active Kiosks */}
        <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={26} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
              {kiosks.approved} <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>/ {kiosks.total}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
              Kiosk Approved ({kiosks.pending} Pending)
            </div>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Hourly Distribution Bar Chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Distribusi Kehadiran Per Jam (Hari Ini)</h3>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Pola waktu kedatangan absensi karyawan/siswa</p>
            </div>
            <BarChart3 size={18} color="#64748B" />
          </div>

          {hourly.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
              Belum ada riwayat absensi tercatat untuk hari ini
            </div>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 12, paddingBottom: 24, position: 'relative' }}>
              {hourly.map((item) => {
                const count = Number(item.count);
                const heightPercent = Math.max(12, Math.round((count / maxHourlyCount) * 100));
                return (
                  <div
                    key={item.hour}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', marginBottom: 4 }}>
                      {count}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${heightPercent}%`,
                        background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.4s ease',
                      }}
                      title={`${item.hour}: ${count} kehadiran`}
                    />
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 8, whiteSpace: 'nowrap' }}>
                      {item.hour}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kiosk Breakdown Card */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Kehadiran per Kiosk</h3>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Terminal absensi aktif hari ini</p>
            </div>
            <Monitor size={18} color="#64748B" />
          </div>

          {byKiosk.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
              Belum ada aktivitas kiosk hari ini
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              {byKiosk.map((k) => (
                <div key={k.kiosk_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{k.kiosk_name}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}><code>{k.kiosk_id}</code></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#2563EB' }}>{k.count}</span>
                    <span style={{ fontSize: 11, color: '#64748B', marginLeft: 4 }}>absen</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 7-DAY TREND ROW ────────────────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Tren Kehadiran 7 Hari Terakhir</h3>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Grafik perbandingan presensi harian</p>
          </div>
          <TrendingUp size={18} color="#64748B" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {weeklyTrend.map((w) => {
            const count = Number(w.count);
            return (
              <div
                key={w.date}
                style={{
                  padding: '16px 12px',
                  background: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  {w.day_name}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{w.date.slice(5)}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: count > 0 ? '#0F172A' : '#CBD5E1', marginTop: 8 }}>
                  {count}
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>presensi</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

