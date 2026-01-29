import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Covenant Hello World',
  description: 'A minimal example of Covenant RPC with authentication',
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
