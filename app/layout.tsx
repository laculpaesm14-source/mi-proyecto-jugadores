import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

// Elige las letras que se usan en los textos de la página.
const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

// Nombre y descripción que se ven en la pestaña del navegador.
export const metadata: Metadata = {
  title: 'Gestor de Jugadores de Fútbol',
  description: 'CRUD de jugadores con países y equipos desde APIs reales',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2f8f5b',
}

// Prepara la parte común que comparten todas las páginas del proyecto.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`bg-background ${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        {/* Cuenta las visitas solo cuando el sitio ya está publicado. */}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
