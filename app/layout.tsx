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
        {/* iOS PWA startup images — one per iPhone screen size */}
        <link rel="apple-touch-startup-image" media="screen and (device-width:320px) and (device-height:568px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/splash-640x1136.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:375px) and (device-height:667px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:736px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1242x2208.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:375px) and (device-height:812px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:2) and (orientation:portrait)" href="/splash/splash-828x1792.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:414px) and (device-height:896px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:360px) and (device-height:780px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1080x2340.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:390px) and (device-height:844px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:428px) and (device-height:926px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:393px) and (device-height:852px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:430px) and (device-height:932px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:440px) and (device-height:956px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1320x2868.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width:402px) and (device-height:874px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait)" href="/splash/splash-1206x2622.png" />
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
