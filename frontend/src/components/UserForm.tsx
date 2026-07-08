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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const msg = err.response?.data?.error || 'Gagal menyimpan data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-dark-500 border-l border-white/10 shadow-2xl animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Edit Karyawan' : 'Tambah Karyawan'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Photo preview + upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-full overflow-hidden bg-dark-600 border-2 border-dashed border-brand-primary/40 flex items-center justify-center cursor-pointer hover:border-brand-primary transition-colors relative"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-500">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">Upload</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className="text-xs text-slate-500">Klik untuk upload foto (opsional)</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nama Lengkap *</label>
            <input
              id="user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              className="w-full bg-dark-600 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-brand-primary input-glow transition-all text-sm"
            />
          </div>

          {/* Nomor Induk */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nomor Induk *</label>
            <input
              id="user-nomor-induk"
              type="text"
              value={nomorInduk}
              onChange={(e) => setNomorInduk(e.target.value)}
              placeholder="e.g. 12345678"
              disabled={isEdit}
              className="w-full bg-dark-600 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-brand-primary input-glow transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isEdit && <p className="text-xs text-slate-500 mt-1">Nomor Induk tidak dapat diubah setelah dibuat.</p>}
          </div>

          {/* Photo URL (alternative) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              URL Foto <span className="text-slate-500 font-normal">(alternatif upload)</span>
            </label>
            <input
              id="user-photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                if (e.target.value) setPhotoPreview(e.target.value);
              }}
              placeholder="https://..."
              className="w-full bg-dark-600 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-brand-primary input-glow transition-all text-sm"
            />
          </div>

          {isEdit && user?.compreface_subject_id && (
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-success" />
              <p className="text-xs text-slate-400">
                CompreFace Subject: <span className="text-brand-accent font-mono">{user.compreface_subject_id}</span>
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-dark-600 hover:bg-dark-400 transition-colors"
          >
            Batal
          </button>
          <button
            id="save-user"
            type="submit"
            form="user-form"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menyimpan...
              </span>
            ) : isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
          </button>
        </div>
      </div>
    </>
  );
}
