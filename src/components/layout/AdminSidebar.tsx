'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  BarChart3,
  Layers,
  ShoppingCart,
  LogOut,
  ChevronRight,
  Users,
  Landmark,
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const navItems = [
  { href: '/admin',                label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders',         label: 'Commandes',        icon: ClipboardList },
  { href: '/admin/clients',        label: 'Clients',          icon: Users },
  { href: '/admin/recouvrement',   label: 'Recouvrement',     icon: AlertTriangle },
  { href: '/admin/tresorerie',     label: 'Tresorerie',       icon: Landmark },
  { href: '/admin/purchases',      label: 'Achats',           icon: ShoppingCart },
  { href: '/admin/products',       label: 'Produits',         icon: Package },
  { href: '/admin/stock',          label: 'Stock',            icon: Layers },
  { href: '/admin/reports',        label: 'Rapports',         icon: BarChart3 },
]

export function AdminSidebar() {
  const { user } = useUser()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Déconnexion réussie')
    window.location.href = '/login'
  }

  const initials = user?.company_name
    ? user.company_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'A'

  return (
    <>
      {/* ── Mobile hamburger button ─────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileOpen(v => !v)}
        className="lg:hidden fixed top-3 left-3 z-[60] w-10 h-10 bg-[#0F172A] text-white rounded-lg flex items-center justify-center shadow-lg border border-slate-700/50 touch-manipulation"
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ── Mobile backdrop overlay ─────────────────────────────────── */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* ── Sidebar panel ──────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-56 bg-[#0F172A] flex flex-col z-50',
          'border-r border-slate-700/50 shadow-2xl shadow-slate-950/40',
          'transition-transform duration-300 ease-in-out',
          // Always visible on desktop; slide in/out on mobile
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/30">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none tracking-tight">LiveX Supply</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5 uppercase tracking-widest">Admin Control</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-orange-400/10 text-orange-100 border border-orange-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-orange-300' : 'text-slate-500')} />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-orange-300 shrink-0" />}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-2 pb-3 pt-2 border-t border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-900/30">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-slate-700 text-slate-100 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate leading-tight">
                {user?.company_name || user?.email}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-orange-300 hover:bg-slate-800 transition-colors shrink-0"
              title="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
