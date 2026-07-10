import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistem Absensi Kapel PUSTEKOM | by James',
  description: 'Sistem absensi berbasis pengenalan wajah menggunakan AI - PUSTEKOM',
  keywords: 'absensi, facial recognition, attendance, PUSTEKOM, CompreFace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={`${inter.className} antialiased`} style={{ background: '#f8f9fa', color: '#111827' }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              fontSize: 13,
            },
          }}
        />
      </body>
    </html>
  );
}
