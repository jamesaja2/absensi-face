import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistem Absensi Wajah | Facial Recognition Attendance',
  description: 'Sistem absensi berbasis pengenalan wajah menggunakan AI',
  keywords: 'absensi, facial recognition, attendance, CompreFace',
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
      <body className={`${inter.className} bg-dark-800 text-white antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e1e2e',
              color: '#fff',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            },
          }}
        />
      </body>
    </html>
  );
}
