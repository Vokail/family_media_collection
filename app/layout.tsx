import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Our Collection',
  description: 'Family media collection tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
