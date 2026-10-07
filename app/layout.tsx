import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Replay Receipt',
  description: 'Turn receipts into clean, itemized expense summaries.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
