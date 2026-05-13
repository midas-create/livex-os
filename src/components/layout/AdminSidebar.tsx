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
  ChevronDown,
  Users,
  Landmark,
  AlertTriangle,
  Menu,
  X,
  Truck,
  Building2,
  Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

const operationsItems: NavItem[] = [
  { href: '/admin/orders',       label: 'Commandes',    icon: ClipboardList },
  { href: '/admin/livraisons',   label: 'Livraisons',   icon: Truck },
  { href: '/admin/recouvrement', label: 'Recouvrement', icon: AlertTriangle },
  { href: '/admin/tresorerie',   label: 'Trésorerie',   icon: Landmark },
  { href: '/admin/purchases',    label: 'Achats',       icon: ShoppingCart },
]

const structureItems: NavItem[] = [
  { href: '/admin/clients',      label: 'Clients',      icon: Users },
  { href: '/admin/fournisseurs', label: 'Fournisseurs', icon: Building2 },
  { href: '/admin/products',     label: 'Articles',     icon: Boxes },
]

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-orange-500/15 text-orange-100 border border-orange-400/30 shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
      )}
    >
      <Icon className={cn(
        'w-4 h-4 shrink-0 transition-colors',
        isActive ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300'
      )} />
      <span className="flex-1 truncate tracking-tight">{item.label}</span>
      {isActive && <ChevronRight className="w-3 h-3 text-orange-400/70 shrink-0" />}
    </Link>
  )
}

export function AdminSidebar() {
  const { user } = useUser()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [structureOpen, setStructureOpen] = useState(false)

  const isStructureActive = structureItems.some(i => pathname.startsWith(i.href))

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isStructureActive) setStructureOpen(true)
  }, [isStructureActive])

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
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(v => !v)}
        className="lg:hidden fixed top-3 left-3 z-[60] w-10 h-10 bg-[#0F172A] text-white rounded-lg flex items-center justify-center shadow-lg border border-slate-700/50 touch-manipulation"
        aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile backdrop */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-56 flex flex-col z-50',
          'bg-[#0B1220] border-r border-slate-700/40',
          'shadow-2xl shadow-slate-950/60',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center px-4 border-b border-slate-700/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/40">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-none tracking-tight">LiveX Supply</p>
              <p className="text-[9px] text-slate-500 leading-none mt-1 uppercase tracking-widest font-semibold">Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">

          {/* Dashboard */}
          <NavLink
            item={{ href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true }}
            isActive={pathname === '/admin'}
          />

          {/* Operations section */}
          <div className="pt-3 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 px-3 mb-1.5">
              Opérations
            </p>
            {operationsItems.map(item => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname.startsWith(item.href)}
              />
            ))}
          </div>

          {/* Structure collapsible group */}
          <div className="pt-2 pb-1">
            <button
              type="button"
              onClick={() => setStructureOpen(v => !v)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isStructureActive
                  ? 'text-orange-100 bg-orange-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              )}
            >
              <Building2 className={cn(
                'w-4 h-4 shrink-0',
                isStructureActive ? 'text-orange-400' : 'text-slate-500'
              )} />
              <span className="flex-1 text-left tracking-tight">Structure</span>
              <ChevronDown className={cn(
                'w-3.5 h-3.5 shrink-0 transition-transform duration-200',
                structureOpen ? 'rotate-180' : '',
                isStructureActive ? 'text-orange-400/70' : 'text-slate-600'
              )} />
            </button>

            {structureOpen && (
              <div className="mt-0.5 ml-3 pl-2.5 border-l border-slate-700/50 space-y-0.5">
                {structureItems.map(item => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={pathname.startsWith(item.href)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div className="pt-2 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 px-3 mb-1.5">
              Inventaire
            </p>
            <NavLink
              item={{ href: '/admin/stock', label: 'Stock', icon: Layers }}
              isActive={pathname.startsWith('/admin/stock')}
            />
            <NavLink
              item={{ href: '/admin/reports', label: 'Rapports', icon: BarChart3 }}
              isActive={pathname.startsWith('/admin/reports')}
            />
          </div>
        </nav>

        {/* User footer */}
        <div className="px-2 pb-3 pt-2 border-t border-slate-700/40 shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-900/40 border border-slate-700/30">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-slate-700 text-slate-100 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate leading-tight">
                {user?.company_name || user?.email}
              </p>
              <p className="text-[9px] text-slate-500 truncate leading-tight mt-0.5">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-orange-400 hover:bg-slate-800 transition-colors shrink-0"
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
