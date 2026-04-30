import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Our Collection',
  description: 'Family media collection tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Our Collection',
  },
  icons: {
    icon: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#c67c3c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // style sets background before globals.css loads — prevents white flash on PWA startup
    <html lang="en" style={{ backgroundColor: '#f5ede0' }}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-v2.png" />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: '#f5ede0' }}>
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
