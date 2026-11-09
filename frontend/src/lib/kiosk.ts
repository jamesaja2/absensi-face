'use client';

const KIOSK_ID_KEY = 'absensi_kiosk_id';
const KIOSK_NAME_KEY = 'absensi_kiosk_name';

export function getKioskId(): string {
  if (typeof window === 'undefined') return 'kiosk_server';

  let id = localStorage.getItem(KIOSK_ID_KEY);
  if (!id) {
    // Generate unique random kiosk ID
    const randomHex = Math.random().toString(36).substring(2, 8);
    id = `kiosk_${randomHex}`;
    localStorage.setItem(KIOSK_ID_KEY, id);
  }
  return id;
}

export function setKioskId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KIOSK_ID_KEY, id.trim());
}

export function getKioskName(): string {
  if (typeof window === 'undefined') return 'Kiosk Utama';
  return localStorage.getItem(KIOSK_NAME_KEY) || `Kiosk ${getKioskId().replace('kiosk_', '').toUpperCase()}`;
}

export function setKioskName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KIOSK_NAME_KEY, name.trim());
}
