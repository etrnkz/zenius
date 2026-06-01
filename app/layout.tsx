import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NoteProvider } from '@/lib/note-context'
import { Toaster } from '@/components/ui/toaster'
import { SecurityProvider } from '@/components/security-provider'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Zenius',
  description: 'AI-powered learning — notes, flashcards, quizzes, and more',
  icons: {
    icon: [{ url: '/images/logo.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-black text-zinc-100">
        <SecurityProvider>
          <NoteProvider>
            <main className="min-h-screen w-full">{children}</main>
            <Toaster />
          </NoteProvider>
        </SecurityProvider>
        <Analytics />
      </body>
    </html>
  )
}
