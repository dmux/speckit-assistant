import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spec Kit Assistant',
  description: 'Visual orchestrator for Spec-Driven Development (SDD)',
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
