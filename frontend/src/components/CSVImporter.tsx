'use client';

import { useState, useRef, useCallback } from 'react';
import { usersApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface CSVImporterProps {
  onComplete: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  users: { name: string; nomor_induk: string }[];
}

export default function CSVImporter({ onComplete }: CSVImporterProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.csv')) {
      setFile(dropped);
      setResult(null);
    } else {
      toast.error('Hanya file .csv yang diizinkan');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await usersApi.importCSV(file);
      setResult(res.data);
      onComplete();
      if (res.data.success > 0) {
        toast.success(`${res.data.success} karyawan berhasil diimport`);
      }
      if (res.data.failed > 0) {
        toast.error(`${res.data.failed} karyawan gagal diimport`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Import gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const csv = `Name,Nomor Induk,Photo URL\nBudi Santoso,12345678,https://example.com/budi.jpg\nSiti Rahayu,87654321,https://example.com/siti.jpg`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_karyawan.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Format guide */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Format CSV yang Dibutuhkan</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    {['Name', 'Nomor Induk', 'Photo URL'].map((h) => (
                      <th key={h} className="text-left pr-6 py-1 text-brand-accent font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pr-6 py-1 text-slate-300">Budi Santoso</td>
                    <td className="pr-6 py-1 text-slate-300">12345678</td>
                    <td className="pr-6 py-1 text-slate-400 font-mono text-xs">https://...jpg (opsional)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <button
            id="download-template"
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-brand-accent/10 text-brand-accent border border-brand-accent/20 hover:bg-brand-accent/20 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Template
          </button>
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          id="csv-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 p-10
            flex flex-col items-center gap-4 text-center
            ${dragging
              ? 'border-brand-primary bg-brand-primary/10 scale-[1.01]'
              : file
              ? 'border-brand-success/50 bg-brand-success/5'
              : 'border-white/10 hover:border-brand-primary/50 hover:bg-brand-primary/5'
            }
          `}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />

          {file ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-brand-success/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-brand-success">{file.name}</p>
                <p className="text-sm text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB — Klik untuk ganti</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-dark-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white">Drag & Drop file CSV di sini</p>
                <p className="text-sm text-slate-400 mt-1">atau klik untuk browse file</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      {file && !result && (
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-400 bg-dark-600 hover:bg-dark-400 transition-colors"
          >
            Hapus File
          </button>
          <button
            id="start-import"
            onClick={handleImport}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Memproses... (mungkin butuh beberapa menit)
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Mulai Import
              </>
            )}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="glass rounded-2xl p-5 animate-fade-in">
          <h3 className="font-semibold text-white mb-4">Hasil Import</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-brand-success/10 border border-brand-success/20 p-4 text-center">
              <p className="text-3xl font-bold text-brand-success">{result.success}</p>
              <p className="text-xs text-slate-400 mt-1">Berhasil</p>
            </div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{result.failed}</p>
              <p className="text-xs text-slate-400 mt-1">Gagal</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-red-400 mb-2">Error Detail:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-slate-500 font-mono bg-dark-600 rounded px-2 py-1">{err}</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleReset}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/10 transition-colors"
          >
            Import Lagi
          </button>
        </div>
      )}
    </div>
  );
}
