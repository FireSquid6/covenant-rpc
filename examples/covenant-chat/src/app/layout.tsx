import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Covenant Chat',
  description: 'Discord-like chat app built with Covenant RPC showcasing realtime channels and WebSocket communication',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
