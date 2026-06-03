import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'hihi-agent', description: 'AI agent 控制台' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
