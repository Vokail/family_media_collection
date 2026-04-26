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
    apple: '/apple-touch-icon.png',
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
    <html lang="en">
      <body className="min-h-screen">
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
