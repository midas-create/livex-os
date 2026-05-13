import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/context/CartContext'
import { UserProvider } from '@/context/UserContext'
import { PostLoginCartHydrator } from '@/components/auth/PostLoginCartHydrator'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LiveX Office Supplies',
  description: 'Professional B2B office supplies ordering platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <CartProvider>
          <UserProvider>
            <PostLoginCartHydrator />
            {children}
            <Toaster />
          </UserProvider>
        </CartProvider>
      </body>
    </html>
  )
}
