'use client';

import { useState, useRef } from 'react';
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
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
    if (selected) { setFile(selected); setResult(null); }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await usersApi.importCSV(file);
      setResult(res.data);
      onComplete();
      if (res.data.success > 0) toast.success(`${res.data.success} karyawan berhasil diimport`);
      if (res.data.failed > 0) toast.error(`${res.data.failed} karyawan gagal diimport`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Import gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Format guide */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>Format CSV yang Dibutuhkan</h3>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {['Name', 'Nomor Induk', 'Photo URL'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', paddingRight: 24, paddingBottom: 4, fontWeight: 600, color: 'var(--color-accent)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ paddingRight: 24, color: 'var(--color-text-secondary)' }}>Budi Santoso</td>
                  <td style={{ paddingRight: 24, color: 'var(--color-text-secondary)' }}>12345678</td>
                  <td style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 11 }}>https://...jpg (opsional)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button id="download-template" onClick={downloadTemplate} className="btn btn-secondary" style={{ fontSize: 12, flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
          style={{
            borderRadius: 12,
            border: `2px dashed ${dragging ? 'var(--color-accent)' : file ? 'var(--color-success)' : 'var(--color-border-strong)'}`,
            background: dragging ? 'var(--color-accent-light)' : file ? 'var(--color-success-light)' : '#fff',
            cursor: 'pointer',
            padding: '40px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileSelect} />
          {file ? (
            <>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--color-success)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--color-success)' }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — Klik untuk ganti</p>
              </div>
            </>
          ) : (
            <>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-muted)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Drag & Drop file CSV di sini</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>atau klik untuk browse file</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      {file && !result && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleReset} className="btn btn-secondary" style={{ flex: 1, padding: '10px 16px' }}>
            Hapus File
          </button>
          <button
            id="start-import"
            onClick={handleImport}
            disabled={loading}
            className="btn btn-primary"
            style={{ flex: 1, padding: '10px 16px' }}
          >
            {loading ? <><div className="spinner" /> Memproses...</> : 'Mulai Import'}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>Hasil Import</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 16, textAlign: 'center', borderRadius: 8, background: 'var(--color-success-light)' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>{result.success}</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Berhasil</p>
            </div>
            <div style={{ padding: 16, textAlign: 'center', borderRadius: 8, background: 'var(--color-danger-light)' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-danger)' }}>{result.failed}</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Gagal</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>Error Detail:</p>
              <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {result.errors.map((err, i) => (
                  <p key={i} style={{ fontSize: 11, fontFamily: 'monospace', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: 4, color: 'var(--color-text-secondary)' }}>{err}</p>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn btn-secondary" style={{ width: '100%', marginTop: 16, padding: '10px 16px' }}>
            Import Lagi
          </button>
        </div>
      )}
    </div>
  );
}
