'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp, TrendingDown, Package, Building2, BarChart3,
  ShoppingCart, Layers, Wallet,
} from 'lucide-react'
import {
  format, subDays, startOfMonth, endOfMonth, startOfYear, parseISO,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SalesByDay, SalesByClient, SalesByProduct } from '@/lib/types'
import { formatAr } from '@/lib/utils'

type Period = '7d' | '30d' | 'month' | 'year'
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

type PurchaseRow = {
  supplier_name: string
  count: number
  total_amount: number
  unpaid: number
}

type MovementRow = {
  date: string
  product: string
  type: 'IN' | 'OUT'
  quantity: number
  source: string
}

type StockItem = {
  name: string
  category: string
  stock_quantity: number
  purchase_price: number
  price: number
  value: number
  margin_pct: number
}

type FinancialRow = {
  method: string
  amount: number
  count: number
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)

  // Sales data
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([])
  const [byProduct, setByProduct] = useState<SalesByProduct[]>([])
  const [byClient, setByClient] = useState<SalesByClient[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalMargin, setTotalMargin] = useState(0)
  const [, setTotalOrders] = useState(0)

  // Purchases data
  const [purchasesBySupplier, setPurchasesBySupplier] = useState<PurchaseRow[]>([])
  const [totalPurchases, setTotalPurchases] = useState(0)
  const [unpaidPurchases, setUnpaidPurchases] = useState(0)

  // Stock data
  const [recentMovements, setRecentMovements] = useState<MovementRow[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])

  // Financial
  const [cashByMethod, setCashByMethod] = useState<FinancialRow[]>([])
  const [totalReceivables, setTotalReceivables] = useState(0)
  const [totalPayables, setTotalPayables] = useState(0)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (period) {
      case '7d':    start = subDays(now, 7); break
      case '30d':   start = subDays(now, 30); break
      case 'month': start = startOfMonth(now); end = endOfMonth(now); break
      case 'year':  start = startOfYear(now); break
      default:      start = subDays(now, 30)
    }

    // ── Sales orders — CA recognized only at delivery (reference §9) ──────
    const { data: rawOrders } = await supabase
      .from('orders')
      .select(`id, created_at, delivery_date, total_amount, delivery_fee, status, is_paid, paid_amount,
        user:users(company_name, client_profiles(company_name)),
        order_items(quantity, unit_price, product_id, product:products(name, purchase_price)),
        payments(amount, payment_method)`)
      .eq('status', 'delivered')
      .gte('delivery_date', start.toISOString().split('T')[0])
      .lte('delivery_date', end.toISOString().split('T')[0])

    type RawOrder = {
      id: string; created_at: string; delivery_date: string | null; total_amount: number; delivery_fee: number
      status: string; is_paid: boolean
      user: { company_name: string; client_profiles: { company_name: string }[] | null } | null
      order_items: Array<{ quantity: number; unit_price: number; product_id: string; product: { name: string; purchase_price: number } | null }>
      payments: Array<{ amount: number; payment_method: string }>
    }
    const orders: RawOrder[] = (rawOrders ?? []) as unknown as RawOrder[]

    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000)
    const dayMap: Record<string, SalesByDay> = {}
    for (let i = days; i >= 0; i--) {
      const d = subDays(end, i)
      const key = format(d, 'yyyy-MM-dd')
      dayMap[key] = { date: format(d, period === 'year' ? 'MMM' : 'dd MMM', { locale: fr }), revenue: 0, orders: 0 }
    }

    const productRevMap: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {}
    const clientMap: Record<string, { company_name: string; orders: number; revenue: number }> = {}
    const methodMap: Record<string, { amount: number; count: number }> = {}

    for (const order of orders) {
      const orderTotal = (order.total_amount || 0) + (order.delivery_fee || 0)
      const dayKey = format(parseISO(order.delivery_date ?? order.created_at), 'yyyy-MM-dd')
      if (dayMap[dayKey]) { dayMap[dayKey].revenue += orderTotal; dayMap[dayKey].orders += 1 }

      const clientName =
        order.user?.client_profiles?.[0]?.company_name?.trim()
        || order.user?.company_name?.trim()
        || 'Inconnu'
      if (!clientMap[clientName]) clientMap[clientName] = { company_name: clientName, orders: 0, revenue: 0 }
      clientMap[clientName].orders += 1
      clientMap[clientName].revenue += orderTotal

      for (const item of order.order_items ?? []) {
        const pId = item.product_id
        const name = item.product?.name ?? pId
        const cost = (item.product?.purchase_price ?? 0) * item.quantity
        if (!productRevMap[pId]) productRevMap[pId] = { name, qty: 0, revenue: 0, cost: 0 }
        productRevMap[pId].qty += item.quantity
        productRevMap[pId].revenue += item.unit_price * item.quantity
        productRevMap[pId].cost += cost
      }

      for (const pay of order.payments ?? []) {
        const m = pay.payment_method
        if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 }
        methodMap[m].amount += pay.amount
        methodMap[m].count += 1
      }
    }

    let chartData = Object.values(dayMap)
    if (period === 'year') {
      const monthMap: Record<string, SalesByDay> = {}
      for (const d of chartData) {
        if (!monthMap[d.date]) monthMap[d.date] = { date: d.date, revenue: 0, orders: 0 }
        monthMap[d.date].revenue += d.revenue
        monthMap[d.date].orders += d.orders
      }
      chartData = Object.values(monthMap)
    }

    setSalesByDay(chartData)
    setByProduct(Object.values(productRevMap)
      .map(p => ({ product_name: p.name, quantity: p.qty, revenue: p.revenue, margin: p.revenue - p.cost }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 15))
    setByClient(Object.values(clientMap).sort((a, b) => b.revenue - a.revenue))
    setTotalRevenue(orders.reduce((s, o) => s + (o.total_amount || 0) + (o.delivery_fee || 0), 0))
    setTotalMargin(Object.values(productRevMap).reduce((s, p) => s + (p.revenue - p.cost), 0))
    setTotalOrders(orders.length)

    const methodLabels: Record<string, string> = {
      cash: 'Espèces', cheque: 'Chèque', transfer: 'Virement', bank: 'Virement', mobile_money: 'Mobile Money',
    }
    setCashByMethod(Object.entries(methodMap).map(([m, v]) => ({
      method: methodLabels[m] ?? m, amount: v.amount, count: v.count,
    })).sort((a, b) => b.amount - a.amount))

    // ── Receivables — only delivered+unpaid invoices (reference §8) ────────
    const { data: unpaidOrders } = await supabase
      .from('orders')
      .select('id, total_amount, delivery_fee, payments(amount)')
      .eq('status', 'delivered')
      .eq('is_paid', false)

    const receivables = (unpaidOrders ?? []).reduce((s, o) => {
      const total = (o.total_amount || 0) + (o.delivery_fee || 0)
      const paid = (o.payments ?? []).reduce((ps: number, p: { amount: number }) => ps + p.amount, 0)
      return s + Math.max(0, total - paid)
    }, 0)
    setTotalReceivables(receivables)

    // ── Purchases ────────────────────────────────────────────────────────
    const { data: purchaseData } = await supabase
      .from('purchases')
      .select('supplier_name, total_amount, payment_status, purchase_date')
      .gte('purchase_date', start.toISOString().split('T')[0])

    const supplierMap: Record<string, PurchaseRow> = {}
    let totalP = 0
    let unpaidP = 0
    for (const p of purchaseData ?? []) {
      const s = p.supplier_name
      if (!supplierMap[s]) supplierMap[s] = { supplier_name: s, count: 0, total_amount: 0, unpaid: 0 }
      supplierMap[s].count += 1
      supplierMap[s].total_amount += p.total_amount
      if (p.payment_status !== 'paid') supplierMap[s].unpaid += p.total_amount
      totalP += p.total_amount
      if (p.payment_status !== 'paid') unpaidP += p.total_amount
    }
    setPurchasesBySupplier(Object.values(supplierMap).sort((a, b) => b.total_amount - a.total_amount))
    setTotalPurchases(totalP)
    setUnpaidPurchases(unpaidP)
    setTotalPayables(unpaidP)

    // ── Stock movements ──────────────────────────────────────────────────
    const { data: mvtData } = await supabase
      .from('stock_movements')
      .select('created_at, type, quantity, source, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(50)

    setRecentMovements((mvtData ?? []).map(m => ({
      date: m.created_at,
      product: (m.product as unknown as { name: string } | null)?.name ?? '—',
      type: m.type as 'IN' | 'OUT',
      quantity: m.quantity,
      source: m.source,
    })))

    // ── Stock inventory ──────────────────────────────────────────────────
    const { data: prodData } = await supabase
      .from('products')
      .select('name, stock_quantity, purchase_price, price, category:categories(name)')
      .order('stock_quantity', { ascending: true })
      .limit(50)

    setStockItems((prodData ?? []).map(p => {
      const cat = p.category as unknown as { name: string } | null
      const marginPct = p.price > 0 && p.purchase_price > 0
        ? ((p.price - p.purchase_price) / p.price) * 100 : 0
      return {
        name: p.name, category: cat?.name ?? '—',
        stock_quantity: p.stock_quantity, purchase_price: p.purchase_price,
        price: p.price, value: p.stock_quantity * p.purchase_price, margin_pct: marginPct,
      }
    }))

    setLoading(false)
  }, [period])

  useEffect(() => { fetchReports() }, [fetchReports])

  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  const tabList = [
    { value: 'period',    label: 'Période',   icon: TrendingUp },
    { value: 'product',   label: 'Produits',  icon: Package },
    { value: 'client',    label: 'Clients',   icon: Building2 },
    { value: 'margin',    label: 'Marges',    icon: BarChart3 },
    { value: 'purchases', label: 'Achats',    icon: ShoppingCart },
    { value: 'stock',     label: 'Stock',     icon: Layers },
    { value: 'financial', label: 'Financier', icon: Wallet },
  ]

  const sourceLabel: Record<string, string> = {
    purchase: 'Achat', sale: 'Vente', delivery: 'Livraison', adjustment: 'Ajustement',
  }
  const methodLabel: Record<string, string> = {
    cash: 'Espèces', cheque: 'Chèque', transfer: 'Virement', bank: 'Virement', mobile_money: 'Mobile Money',
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="saas-surface p-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rapports commerciaux</h1>
          <p className="text-sm text-slate-600 mt-0.5">Ventes · Achats · Stock · Trésorerie</p>
        </div>
        <Select value={period} onValueChange={v => setPeriod((v ?? '30d') as Period)}>
          <SelectTrigger className="w-44 h-8 bg-white border-slate-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
            <SelectItem value="month">Ce mois-ci</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
          <>
            <div className="saas-surface px-3.5 py-2.5">
              <TrendingUp className="w-4 h-4 text-blue-500 mb-2" />
              <p className="text-lg font-bold text-slate-900">{formatAr(totalRevenue)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Chiffre d&apos;affaires</p>
            </div>
            <div className="saas-surface px-3.5 py-2.5">
              {totalMargin >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-500 mb-2" />
                : <TrendingDown className="w-4 h-4 text-red-500 mb-2" />
              }
              <p className={`text-lg font-bold ${totalMargin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatAr(totalMargin)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Marge brute ({marginPct.toFixed(1)}%)</p>
            </div>
            <div className="saas-surface px-3.5 py-2.5">
              <ShoppingCart className="w-4 h-4 text-violet-500 mb-2" />
              <p className="text-lg font-bold text-slate-900">{formatAr(totalPurchases)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Achats fournisseurs</p>
            </div>
            <div className="saas-surface px-3.5 py-2.5">
              <Wallet className="w-4 h-4 text-amber-500 mb-2" />
              <p className="text-lg font-bold text-red-600">{formatAr(totalReceivables)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Créances livrées impayées</p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="period">
        <TabsList className="bg-white border border-slate-200 rounded-xl p-1 h-auto gap-1 flex-wrap">
          {tabList.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="rounded-lg px-3 py-1.5 text-sm data-active:bg-orange-500 data-active:text-white flex items-center gap-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Par période ── */}
        <TabsContent value="period" className="mt-3">
          <div className="saas-surface p-4">
            <h2 className="font-semibold text-slate-900 text-sm mb-4">Chiffre d&apos;affaires sur la période</h2>
            {loading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={salesByDay} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: unknown) => [formatAr(Number(v)), 'CA']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        {/* ── Par produit ── */}
        <TabsContent value="product" className="mt-3">
          <div className="saas-surface overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : byProduct.length === 0 ? (
              <div className="py-14 text-center"><Package className="w-7 h-7 text-slate-300 mx-auto mb-2" /><p className="text-slate-500 text-sm">Aucune donnée</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Qté vendue</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-right">Marge %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProduct.map((p, i) => {
                    const mPct = p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-900">{p.product_name}</TableCell>
                        <TableCell className="text-right text-slate-700">{p.quantity}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">{formatAr(p.revenue)}</TableCell>
                        <TableCell className={`text-right font-semibold ${p.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatAr(p.margin)}
                        </TableCell>
                        <TableCell className={`text-right ${mPct >= 20 ? 'text-emerald-600' : mPct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                          {mPct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Par client ── */}
        <TabsContent value="client" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="saas-surface p-5">
              <h2 className="font-semibold text-slate-900 text-sm mb-4">Répartition CA par client</h2>
              {loading ? <Skeleton className="h-56 w-full" /> : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={byClient.slice(0, 8)} dataKey="revenue" nameKey="company_name"
                      cx="50%" cy="50%" outerRadius={85}
                      label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      labelLine={false}>
                      {byClient.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => [formatAr(Number(v)), 'CA']}
                      contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="saas-surface overflow-hidden">
              {loading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-center">Commandes</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byClient.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-900">{c.company_name}</TableCell>
                        <TableCell className="text-center text-slate-700">{c.orders}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">{formatAr(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Marges ── */}
        <TabsContent value="margin" className="mt-3">
          <div className="saas-surface p-5">
            <h2 className="font-semibold text-slate-900 text-sm mb-4">Marge brute par produit (Top 10)</h2>
            {loading ? <Skeleton className="h-56 w-full" /> : byProduct.length === 0 ? (
              <div className="py-12 text-center"><p className="text-slate-500 text-sm">Aucune donnée disponible</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={byProduct.slice(0, 10).map(p => ({
                    name: p.product_name.length > 18 ? p.product_name.slice(0, 18) + '…' : p.product_name,
                    revenue: p.revenue, margin: p.margin,
                  }))}
                  margin={{ top: 0, right: 0, left: -10, bottom: 45 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [formatAr(v as number), name === 'margin' ? 'Marge' : 'CA']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="revenue" fill="#e2e8f0" radius={[3, 3, 0, 0]} maxBarSize={36} name="CA" />
                  <Bar dataKey="margin" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={36} name="margin" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        {/* ── Achats fournisseurs ── */}
        <TabsContent value="purchases" className="mt-3">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="saas-surface px-4 py-3.5">
              <p className="text-lg font-bold text-slate-900">{formatAr(totalPurchases)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Volume achats</p>
            </div>
            <div className="saas-surface px-4 py-3.5">
              <p className="text-lg font-bold text-red-600">{formatAr(unpaidPurchases)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Dettes fournisseurs</p>
            </div>
            <div className="saas-surface px-4 py-3.5">
              <p className="text-lg font-bold text-slate-700">{purchasesBySupplier.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Fournisseurs actifs</p>
            </div>
          </div>
          <div className="saas-surface overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : purchasesBySupplier.length === 0 ? (
              <div className="py-14 text-center">
                <ShoppingCart className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Aucun achat sur cette période</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-center">Achats</TableHead>
                    <TableHead className="text-right">Montant total</TableHead>
                    <TableHead className="text-right">Impayé</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasesBySupplier.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-slate-900">{p.supplier_name}</TableCell>
                      <TableCell className="text-center text-slate-600">{p.count}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">{formatAr(p.total_amount)}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.unpaid > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {p.unpaid > 0 ? formatAr(p.unpaid) : '—'}
                      </TableCell>
                      <TableCell>
                        {p.unpaid === 0
                          ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Soldé</Badge>
                          : p.unpaid < p.total_amount
                            ? <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Partiel</Badge>
                            : <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">Impayé</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Stock ── */}
        <TabsContent value="stock" className="mt-3 space-y-4">
          {/* Inventory */}
          <div className="saas-surface overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Inventaire (valeur du stock)</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">P.A.</TableHead>
                    <TableHead className="text-right">P.V.</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="text-right">Marge %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map((s, i) => (
                    <TableRow key={i} className={s.stock_quantity === 0 ? 'bg-red-50/30' : s.stock_quantity <= 5 ? 'bg-amber-50/30' : ''}>
                      <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{s.category}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-sm ${s.stock_quantity === 0 ? 'text-red-600' : s.stock_quantity <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                          {s.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-slate-600">{formatAr(s.purchase_price)}</TableCell>
                      <TableCell className="text-right text-slate-600">{formatAr(s.price)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatAr(s.value)}</TableCell>
                      <TableCell className={`text-right text-sm ${s.margin_pct >= 20 ? 'text-emerald-600' : s.margin_pct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {s.margin_pct > 0 ? `${s.margin_pct.toFixed(0)}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Recent movements */}
          <div className="saas-surface overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">50 derniers mouvements de stock</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : recentMovements.length === 0 ? (
              <div className="py-12 text-center"><p className="text-slate-500 text-sm">Aucun mouvement</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Qté</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMovements.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-slate-500">
                        {format(parseISO(m.date), 'd MMM yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{m.product}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold ${m.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.type === 'IN' ? '↑ Entrée' : '↓ Sortie'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-sm ${m.type === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {m.type === 'IN' ? '+' : '−'}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{sourceLabel[m.source] ?? m.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Financier ── */}
        <TabsContent value="financial" className="mt-3 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
          <div className="saas-surface border-red-200 px-4 py-3.5">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Créances clients</p>
              <p className="text-xl font-bold text-red-600">{loading ? '...' : formatAr(totalReceivables)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Commandes impayées</p>
            </div>
          <div className="saas-surface border-orange-200 px-4 py-3.5">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Dettes fournisseurs</p>
              <p className="text-xl font-bold text-orange-600">{loading ? '...' : formatAr(totalPayables)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Achats non réglés</p>
            </div>
          </div>

          {/* Cash by payment method */}
          <div className="saas-surface overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="font-semibold text-slate-900 text-sm">Encaissements par mode de paiement</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : cashByMethod.length === 0 ? (
              <div className="py-12 text-center">
                <Wallet className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Aucun paiement enregistré sur cette période</p>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                {cashByMethod.map((m, i) => {
                  const total = cashByMethod.reduce((s, r) => s + r.amount, 0)
                  const pct = total > 0 ? (m.amount / total) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{methodLabel[m.method] ?? m.method}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{m.count} paiement(s)</span>
                          <span className="text-sm font-bold text-slate-900">{formatAr(m.amount)}</span>
                          <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total encaissé</span>
                  <span className="text-base font-bold text-emerald-700">
                    {formatAr(cashByMethod.reduce((s, m) => s + m.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
