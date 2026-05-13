'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useCart } from '@/context/CartContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  LayoutGrid,
  ShoppingCart,
  ClipboardList,
  LogOut,
  ChevronDown,
  Shield,
  Search,
  UserCircle,
  User,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import logoLivex from '@/public/branding/logo-livex.png'

export function StorefrontHeader() {
  const { user, loading } = useUser()
  const { totalItems } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')

  const isAdmin = user?.role === 'admin'
  const catalogueActive =
    pathname === '/products' || pathname.startsWith('/product/')

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Déconnexion réussie')
    router.push('/')
    router.refresh()
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const t = searchQ.trim()
    router.push(t ? `/products?q=${encodeURIComponent(t)}` : '/products')
  }

  const initials = user?.company_name
    ? user.company_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  if (loading) {
    return (
      <header className="sticky top-0 z-50 border-b border-livex-line bg-white/95 backdrop-blur-md shadow-livex-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[58px] flex items-center">
          <div className="h-10 w-44 bg-slate-100/90 rounded-lg animate-pulse" />
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-livex-line bg-white/95 backdrop-blur-md shadow-livex-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-5 min-h-[58px] py-1.5">
          {/* Logo — hauteur augmentée, logo complet lisible, proportions conservées */}
          <Link
            href="/"
            className="flex shrink-0 items-center min-h-[44px] min-w-0 max-w-[min(100%,300px)] py-0.5"
          >
            <Image
              src={logoLivex}
              alt="Livex Office Supplies"
              priority
              className="h-11 sm:h-12 w-auto max-h-[48px] object-contain object-left"
              sizes="(max-width: 768px) 200px, 280px"
            />
          </Link>

          <form
            onSubmit={onSearch}
            className="hidden md:flex flex-1 justify-center min-w-0 max-w-2xl mx-auto"
          >
            <div className="relative w-full">
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher un produit, une marque, une référence..."
                className="h-9 w-full rounded-full border-slate-200/90 bg-slate-50 pl-3.5 pr-10 text-[13px] leading-tight shadow-inner shadow-slate-900/[0.03] placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-orange-500/20"
              />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-orange-600 transition-colors"
                aria-label="Rechercher"
              >
                <Search className="w-[15px] h-[15px]" />
              </button>
            </div>
          </form>

          <nav className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 ml-auto">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-medium text-orange-700 hover:bg-orange-50/80"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}

            <Link
              href="/products"
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1.5 text-[13px] font-semibold leading-none transition-colors',
                catalogueActive
                  ? 'text-orange-600 border-b-2 border-orange-500 rounded-b-none pb-1 -mb-px'
                  : 'text-slate-600 hover:text-livex-navy hover:bg-slate-50/90'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Catalogue</span>
            </Link>

            <Link
              href="/cart"
              className="inline-flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50/90"
            >
              <span className="relative">
                <ShoppingCart className="w-[17px] h-[17px]" />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline">Panier</span>
            </Link>

            {user && !isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 h-8 px-1.5 rounded-lg hover:bg-slate-50/90 transition-colors outline-none border border-transparent hover:border-slate-200/80">
                  <Avatar className="w-7 h-7 ring-1 ring-slate-200/80">
                    <AvatarFallback className="bg-slate-100 text-livex-navy text-[11px] font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-livex-md border-slate-200/80">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[13px] font-semibold text-livex-navy truncate">{user.company_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => router.push('/stock')}>
                    <Package className="w-3.5 h-3.5 mr-2" />
                    Stock entreprise
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => router.push('/orders')}>
                    <ClipboardList className="w-3.5 h-3.5 mr-2" />
                    Mes commandes
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => router.push('/account')}>
                    <UserCircle className="w-3.5 h-3.5 mr-2" />
                    Mon compte
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-[13px] text-[#dc2626] focus:text-[#dc2626] focus:bg-red-50"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !user ? (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] font-medium text-livex-navy hover:border-slate-300 hover:bg-slate-50/80"
                >
                  <User className="w-3.5 h-3.5" />
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center rounded-full bg-orange-500 px-3 sm:px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm shadow-orange-500/25 hover:bg-orange-600 transition-colors"
                >
                  Créer un compte
                </Link>
              </>
            ) : null}
          </nav>
        </div>

        <form onSubmit={onSearch} className="md:hidden pb-2">
          <div className="relative">
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Rechercher…"
              className="h-9 rounded-full border-slate-200/90 bg-slate-50 pl-3.5 pr-10 text-[13px]"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              aria-label="Rechercher"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </header>
  )
}
