'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardStats, SalesByDay } from '@/lib/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, AlertCircle,
  Users, Truck, CreditCard,
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatAr } from '@/lib/utils'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [salesData, setSalesData] = useState<SalesByDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      const supabase = createClient()
      const now = new Date()
      const todayStart = startOfDay(now).toISOString()
      const monthStart = startOfMonth(now).toISOString()

      const [
        { data: allOrders },
        { count: clientCount },
        { data: products },
      ] = await Promise.all([
        supabase.from('orders').select(`
          id, status, total_amount, delivery_fee, is_paid, created_at,
          order_items(unit_price, quantity, product_id)
        `).order('created_at', { ascending: false }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('products').select('id, stock_quantity'),
      ])

      const orders = allOrders ?? []
      const getTotal = (o: { total_amount: number; delivery_fee: number }) =>
        (o.total_amount || 0) + (o.delivery_fee || 0)

      // CA recognized only at delivery (reference §9)
      const deliveredOrders = orders.filter(o => o.status === 'delivered')
      const todayOrders = deliveredOrders.filter(o => o.created_at >= todayStart)
      const monthOrders = deliveredOrders.filter(o => o.created_at >= monthStart)
      // Unpaid = delivered invoices not yet settled (reference §8)
      const unpaidOrders = deliveredOrders.filter(o => !o.is_paid)

      const days: SalesByDay[] = []
      for (let i = 13; i >= 0; i--) {
        const d = subDays(now, i)
        const dayStart = startOfDay(d).toISOString()
        const dayEnd = endOfDay(d).toISOString()
        const dayOrders = orders.filter(o => o.created_at >= dayStart && o.created_at <= dayEnd)
        days.push({
          date: format(d, 'dd MMM', { locale: fr }),
          revenue: dayOrders.reduce((s, o) => s + getTotal(o), 0),
          orders: dayOrders.length,
        })
      }

      setStats({
        todaySales: todayOrders.reduce((s, o) => s + getTotal(o), 0),
        monthSales: monthOrders.reduce((s, o) => s + getTotal(o), 0),
        totalOrders: orders.length,
        unpaidOrders: unpaidOrders.length,
        unpaidAmount: unpaidOrders.reduce((s, o) => s + getTotal(o), 0),
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        toDeliverOrders: orders.filter(o => o.status === 'to_deliver').length,
        totalClients: clientCount ?? 0,
        lowStockProducts: (products ?? []).filter(p => p.stock_quantity <= 5).length,
      })
      setSalesData(days)
      setLoading(false)
    }
    fetchDashboard()
  }, [])

  const kpis = stats ? [
    {
      label: "CA aujourd'hui",
      value: formatAr(stats.todaySales),
      sub: 'Ventes du jour',
      icon: TrendingUp,
      chip: 'bg-white/20 text-white',
      card: 'from-orange-500 via-orange-500 to-orange-600',
    },
    {
      label: 'CA du mois',
      value: formatAr(stats.monthSales),
      sub: 'Ce mois-ci',
      icon: CreditCard,
      chip: 'bg-white/20 text-white',
      card: 'from-amber-500 via-orange-500 to-orange-600',
    },
    {
      label: 'Commandes',
      value: stats.totalOrders.toString(),
      sub: `${stats.pendingOrders} en attente`,
      icon: ShoppingCart,
      chip: 'bg-white/20 text-white',
      card: 'from-slate-800 via-slate-800 to-[#0F172A]',
    },
    {
      label: 'Impayées',
      value: stats.unpaidOrders.toString(),
      sub: formatAr(stats.unpaidAmount) + ' en cours',
      icon: AlertCircle,
      chip: 'bg-white/20 text-white',
      card: 'from-red-500 via-red-500 to-rose-600',
    },
    {
      label: 'À livrer',
      value: stats.toDeliverOrders.toString(),
      sub: 'Livraisons en attente',
      icon: Truck,
      chip: 'bg-white/20 text-white',
      card: 'from-indigo-500 via-indigo-500 to-blue-600',
    },
    {
      label: 'Clients',
      value: stats.totalClients.toString(),
      sub: `${stats.lowStockProducts} alertes stock`,
      icon: Users,
      chip: 'bg-white/20 text-white',
      card: 'from-emerald-500 via-emerald-500 to-teal-600',
    },
  ] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="saas-surface p-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : kpis.map(kpi => {
              const Icon = kpi.icon
              return (
                <div key={kpi.label} className={`rounded-xl border border-white/10 bg-gradient-to-br ${kpi.card} p-4 shadow-lg shadow-slate-900/10`}>
                  <div className="flex items-start justify-between mb-2.5">
                    <p className="text-xs text-white/80 font-medium leading-tight">{kpi.label}</p>
                    <div className={`w-8 h-8 ${kpi.chip} rounded-lg flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-white leading-none tracking-tight">{kpi.value}</p>
                  <p className="text-[11px] text-white/75 mt-1.5 leading-tight">{kpi.sub}</p>
                </div>
              )
            })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 saas-surface p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900 text-sm">Chiffre d&apos;affaires — 14 derniers jours</h2>
            <p className="text-xs text-slate-400 mt-0.5">Totaux journaliers des commandes</p>
          </div>
          {loading ? <Skeleton className="h-44 w-full" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={salesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(value: unknown) => [formatAr(value as number), 'CA']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="saas-surface p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900 text-sm">Commandes / jour</h2>
            <p className="text-xs text-slate-400 mt-0.5">14 derniers jours</p>
          </div>
          {loading ? <Skeleton className="h-44 w-full" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={salesData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value: unknown) => [value as number, 'Commandes']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick status */}
      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En attente', value: stats.pendingOrders, color: 'bg-amber-400', href: '/admin/orders' },
            { label: 'À livrer', value: stats.toDeliverOrders, color: 'bg-blue-500', href: '/admin/livraisons' },
            { label: 'Impayées', value: stats.unpaidOrders, color: 'bg-red-500', href: '/admin/recouvrement' },
            { label: 'Stock faible', value: stats.lowStockProducts, color: 'bg-orange-400', href: '/admin/stock' },
          ].map(item => (
            <a key={item.label} href={item.href}
              className="saas-surface px-4 py-3.5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                </div>
                <div className={`w-1.5 h-8 ${item.color} rounded-full opacity-70`} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
