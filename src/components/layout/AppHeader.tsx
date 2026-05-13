'use client'

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
  Package,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  LogOut,
  ChevronDown,
  Shield,
  Search,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const clientNav = [
  { href: '/products', label: 'Catalogue', icon: LayoutDashboard },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/cart', label: 'Panier', icon: ShoppingCart, cart: true },
  { href: '/orders', label: 'Mes commandes', icon: ClipboardList },
]

const guestNav = [
  { href: '/products', label: 'Catalogue', icon: LayoutDashboard },
  { href: '/cart', label: 'Panier', icon: ShoppingCart, cart: true },
]

const adminNav = [
  { href: '/admin', label: 'Vue globale', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Produits', icon: Package },
  { href: '/admin/orders', label: 'Commandes', icon: ClipboardList },
]

export function AppHeader() {
  const { user, loading } = useUser()
  const { totalItems } = useCart()
  const pathname = usePathname()
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')

  const isAdmin = user?.role === 'admin'
  const logoHref = isAdmin ? '/admin' : '/'

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
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5 opacity-60">
              <div className="w-8 h-8 bg-slate-200 rounded-lg" />
              <span className="font-bold text-slate-400 text-base hidden sm:block">LiveX Supply</span>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-4 lg:gap-6 min-w-0 flex-1">
            <Link href={logoHref} className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-[#0F172A] to-slate-800 rounded-lg flex items-center justify-center shadow-sm">
                <Package className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-base hidden sm:block">LiveX Supply</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 shrink-0">
              {(user && !isAdmin ? clientNav : isAdmin ? adminNav : guestNav).map(item => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href === '/products' && (pathname === '/products' || pathname.startsWith('/product/'))) ||
                  (item.href !== '/products' && item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-orange-50 text-orange-700 border border-orange-200/70'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {'cart' in item && totalItems > 0 && (
                      <span className="ml-0.5 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                        {totalItems}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <form onSubmit={onSearch} className="hidden md:flex flex-1 max-w-md min-w-0">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
                />
              </div>
            </form>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-full border border-orange-200/70">
                <Shield className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-xs font-medium text-orange-700">Admin</span>
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-slate-100 transition-colors outline-none cursor-pointer border border-transparent hover:border-slate-200">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-slate-900 leading-none">
                      {user?.company_name ?? user?.email}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-slate-200">
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.company_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {!isAdmin && (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => router.push('/account')}
                      >
                        <UserCircle className="w-4 h-4 mr-2" />
                        Mon compte
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-[#dc2626] focus:text-[#dc2626] focus:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>

        <form onSubmit={onSearch} className="md:hidden pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Rechercher un produit…"
              className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
            />
          </div>
        </form>

        <div className="md:hidden flex gap-1 pb-2 overflow-x-auto">
          {(user && !isAdmin ? clientNav : isAdmin ? adminNav : guestNav).map(item => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (item.href === '/products' && (pathname === '/products' || pathname.startsWith('/product/'))) ||
              (item.href !== '/products' && item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive ? 'bg-orange-50 text-orange-700 border border-orange-200/70' : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {'cart' in item && totalItems > 0 && (
                  <span className="bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
