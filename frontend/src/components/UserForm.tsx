'use client';

import { useState, useRef } from 'react';
import { usersApi, User } from '@/lib/api';
import toast from 'react-hot-toast';

interface UserFormProps {
  user?: User | null;
  onSave: () => void;
  onClose: () => void;
}

export default function UserForm({ user, onSave, onClose }: UserFormProps) {
  const [name, setName] = useState(user?.name || '');
  const [nomorInduk, setNomorInduk] = useState(user?.nomor_induk || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photo_url || null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!user;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name || !nomorInduk) {
      toast.error('Nama dan Nomor Induk wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', name);
      form.append('nomor_induk', nomorInduk);
      if (photoUrl) form.append('photo_url', photoUrl);
      if (photoFile) form.append('photo', photoFile);

      if (isEdit && user) {
        await usersApi.update(user.id, form);
      } else {
        await usersApi.create(form);
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: '100%', maxWidth: 420,
        background: '#fff',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {isEdit ? 'Edit Karyawan' : 'Tambah Karyawan'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Photo preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                border: '2px dashed var(--color-border-strong)',
                background: 'var(--color-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-muted)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Klik untuk upload foto (opsional)</p>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>Nama Lengkap *</label>
            <input
              id="user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              className="input"
            />
          </div>

          {/* Nomor Induk */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>Nomor Induk *</label>
            <input
              id="user-nomor-induk"
              type="text"
              value={nomorInduk}
              onChange={(e) => setNomorInduk(e.target.value)}
              placeholder="e.g. 12345678"
              disabled={isEdit}
              className="input"
              style={isEdit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            />
            {isEdit && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Nomor Induk tidak dapat diubah setelah dibuat.</p>}
          </div>

          {/* Photo URL */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              URL Foto <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(alternatif upload)</span>
            </label>
            <input
              id="user-photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => { setPhotoUrl(e.target.value); if (e.target.value) setPhotoPreview(e.target.value); }}
              placeholder="https://..."
              className="input"
            />
          </div>

          {isEdit && user?.compreface_subject_id && (
            <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-dot online" />
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                CompreFace Subject: <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>{user.compreface_subject_id}</span>
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 12 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1, padding: '10px 16px' }}>
            Batal
          </button>
          <button
            id="save-user"
            disabled={loading}
            onClick={() => handleSubmit()}
            className="btn btn-primary"
            style={{ flex: 1, padding: '10px 16px' }}
          >
            {loading ? <><div className="spinner" /> Menyimpan...</> : isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
          </button>
        </div>
      </div>
    </>
  );
}
