import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Covenant Todo',
  description: 'Todo app built with Covenant RPC showcasing resource tracking and cache invalidation',
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
