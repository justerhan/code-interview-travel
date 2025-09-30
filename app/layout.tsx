import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Travel Rec AI',
  description: 'AI-powered travel recommendations',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-vapor-bg vapor-grid text-vapor-text">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </body>
    </html>
  );
}