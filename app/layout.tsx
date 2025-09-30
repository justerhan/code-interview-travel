import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Travel Rec AI',
  description: 'AI-powered travel recommendations',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-5xl p-6">{children}</div>
      </body>
    </html>
  );
}