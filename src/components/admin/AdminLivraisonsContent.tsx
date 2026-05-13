'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { orderClientCompanyName, clientProfileFromUser } from '@/lib/order-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Truck, PackageCheck, Building2, Calendar, Loader2, Clock,
  AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast, parseISO, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatAr } from '@/lib/utils'
import { applyClientDeliveryStock } from '@/lib/client-stock'
import { sendInvoiceEmail } from '@/lib/actions/send-invoice-email'
import { toast } from 'sonner'

type LivraisonFilterTab = 'today' | 'tomorrow' | 'overdue' | 'all'

type DeliveryLine = {
  orderItemId: string
  productId: string
  variantId: string | null
  productName: string
  variantColor: string | null
  ordered: number
  alreadyDelivered: number
  toDeliver: number
}

function paymentLabel(paymentTermsDays: number | null | undefined): string {
  if (!paymentTermsDays || paymentTermsDays === 0) return 'À la livraison'
  return `${paymentTermsDays} jours`
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return isPast(startOfDay(parseISO(dateStr))) && !isToday(parseISO(dateStr))
}

export function AdminLivraisonsContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<LivraisonFilterTab>('today')
  const [saving, setSaving] = useState(false)

  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null)
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLine[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState('')

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        user:users(id, email, company_name, client_profiles(id, user_id, company_name, nif, stat, rcs, manager_name, phone, email, address, region, gps_lat, gps_lng, payment_terms_days, created_at)),
        order_items(*, product:products(id,name,purchase_price), variant:product_variants(id, color)),
        payments(*),
        deliveries(id, bl_number, status, delivery_date, created_at)
      `)
      .in('status', ['validated', 'to_deliver', 'partially_delivered'])
      .order('planned_delivery_date', { ascending: true })

    const enriched = (data ?? []).map(o => {
      const sumPay = o.payments?.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0) ?? 0
      const stored = Number(o.paid_amount ?? 0)
      return { ...o, total: (o.total_amount || 0) + (o.delivery_fee || 0), amount_paid: Math.max(stored, sumPay) }
    })
    setOrders(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = orders.filter(o => {
    const d = o.planned_delivery_date
    if (activeTab === 'today')    return d ? isToday(parseISO(d)) : false
    if (activeTab === 'tomorrow') return d ? isTomorrow(parseISO(d)) : false
    if (activeTab === 'overdue')  return d ? isOverdue(d) : false
    return true
  })

  const counts = {
    today:    orders.filter(o => o.planned_delivery_date && isToday(parseISO(o.planned_delivery_date))).length,
    tomorrow: orders.filter(o => o.planned_delivery_date && isTomorrow(parseISO(o.planned_delivery_date))).length,
    overdue:  orders.filter(o => o.planned_delivery_date && isOverdue(o.planned_delivery_date)).length,
    all:      orders.length,
  }

  const tabs: { value: LivraisonFilterTab; label: string }[] = [
    { value: 'today',    label: "Aujourd'hui" },
    { value: 'tomorrow', label: 'Demain' },
    { value: 'overdue',  label: 'En retard' },
    { value: 'all',      label: 'Toutes' },
  ]

  function openDeliveryModal(order: Order) {
    const lines: DeliveryLine[] = (order.order_items ?? []).map(item => {
      const alreadyDelivered = item.delivered_quantity ?? 0
      const remaining = item.quantity - alreadyDelivered
      return {
        orderItemId: item.id,
        productId: item.product_id,
        variantId: item.variant_id ?? null,
        productName: item.product?.name ?? '—',
        variantColor: (item as unknown as { variant?: { color?: string } }).variant?.color ?? null,
        ordered: item.quantity,
        alreadyDelivered,
        toDeliver: remaining > 0 ? remaining : 0,
      }
    })
    setDeliveryOrder(order)
    setDeliveryLines(lines)
    setDeliveryNotes('')
    setDeliveryOpen(true)
  }

  async function createAndValidateDelivery() {
    if (!deliveryOrder) return
    const lines = deliveryLines.filter(l => l.toDeliver > 0)
    if (lines.length === 0) { toast.error('Aucune quantité à livrer'); return }

    for (const l of lines) {
      const max = l.ordered - l.alreadyDelivered
      if (l.toDeliver > max) {
        toast.error(`Quantité trop grande pour "${l.productName}${l.variantColor ? ' — ' + l.variantColor : ''}" (max ${max})`)
        return
      }
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const { data: delivery, error: dErr } = await supabase
        .from('deliveries')
        .insert({ order_id: deliveryOrder.id, status: 'pending' })
        .select()
        .single()
      if (dErr) throw new Error('Erreur création livraison: ' + dErr.message)

      const deliveryItems = lines.map(l => ({
        delivery_id: delivery.id,
        order_item_id: l.orderItemId,
        product_id: l.productId,
        variant_id: l.variantId,
        quantity: l.toDeliver,
      }))
      const { error: diErr } = await supabase.from('delivery_items').insert(deliveryItems)
      if (diErr) throw new Error('Erreur lignes livraison: ' + diErr.message)

      const { data: blNumber, error: blErr } = await supabase.rpc('next_document_number', { p_type: 'BL' })
      if (blErr) throw new Error('Erreur numéro BL: ' + blErr.message)

      const today = new Date().toISOString().split('T')[0]
      await supabase.from('deliveries').update({
        status: 'validated',
        bl_number: blNumber,
        delivery_date: today,
        notes: deliveryNotes.trim() || null,
      }).eq('id', delivery.id)

      const syncedProducts = new Set<string>()
      for (const line of lines) {
        if (line.variantId) {
          const { data: v } = await supabase
            .from('product_variants').select('stock_quantity, reserved_quantity').eq('id', line.variantId).single()
          if (v) {
            await supabase.from('product_variants').update({
              stock_quantity:    Math.max(0, (v.stock_quantity ?? 0) - line.toDeliver),
              reserved_quantity: Math.max(0, (v.reserved_quantity ?? 0) - line.toDeliver),
            }).eq('id', line.variantId)
          }
          syncedProducts.add(line.productId)
        } else {
          const { data: prod } = await supabase
            .from('products').select('stock_quantity, reserved_quantity').eq('id', line.productId).single()
          if (prod) {
            await supabase.from('products').update({
              stock_quantity:    Math.max(0, (prod.stock_quantity ?? 0) - line.toDeliver),
              reserved_quantity: Math.max(0, (prod.reserved_quantity ?? 0) - line.toDeliver),
            }).eq('id', line.productId)
          }
        }
      }

      for (const pid of Array.from(syncedProducts)) {
        const { data: vars } = await supabase.from('product_variants').select('stock_quantity').eq('product_id', pid)
        if (vars && vars.length > 0) {
          const sum = vars.reduce((s, x) => s + (x.stock_quantity ?? 0), 0)
          await supabase.from('products').update({ stock_quantity: sum }).eq('id', pid)
        }
      }

      await supabase.from('stock_movements').insert(lines.map(l => ({
        product_id: l.productId,
        type: 'OUT' as const,
        quantity: l.toDeliver,
        source: 'delivery' as const,
        reference_id: deliveryOrder!.id,
        notes: `BL ${blNumber as string}`,
      })))

      for (const line of lines) {
        const { data: oi } = await supabase.from('order_items').select('delivered_quantity').eq('id', line.orderItemId).single()
        if (oi !== null && oi !== undefined) {
          await supabase.from('order_items')
            .update({ delivered_quantity: ((oi as { delivered_quantity?: number }).delivered_quantity ?? 0) + line.toDeliver })
            .eq('id', line.orderItemId)
        }
      }

      const { data: allItems } = await supabase.from('order_items')
        .select('quantity, delivered_quantity').eq('order_id', deliveryOrder!.id)
      const fullyDelivered = (allItems ?? []).every(i =>
        ((i as { delivered_quantity?: number }).delivered_quantity ?? 0) >= i.quantity
      )

      let newStatus = 'partially_delivered'
      let faNumber: string | null = null
      if (fullyDelivered) {
        const { data: fa } = await supabase.rpc('next_document_number', { p_type: 'FA' })
        faNumber = fa as string | null
        newStatus = 'delivered'
      }

      const orderUpdate: Record<string, unknown> = { status: newStatus }
      if (fullyDelivered) {
        orderUpdate.delivery_date = today
        if (faNumber) {
          orderUpdate.fa_number = faNumber
          if (!deliveryOrder!.invoice_number || deliveryOrder!.invoice_number?.startsWith('BC-')) {
            orderUpdate.invoice_number = faNumber
          }
        }
        const ptDays = deliveryOrder!.user?.client_profiles?.[0]?.payment_terms_days ?? 0
        if (ptDays > 0) {
          const dueDate = new Date(today + 'T00:00:00')
          dueDate.setDate(dueDate.getDate() + ptDays)
          orderUpdate.due_date = dueDate.toISOString().split('T')[0]
        }
      }
      await supabase.from('orders').update(orderUpdate).eq('id', deliveryOrder!.id)

      const clientRes = await applyClientDeliveryStock(
        supabase,
        { delivery_id: delivery.id, order_id: deliveryOrder!.id, user_id: deliveryOrder!.user_id },
        lines.map(l => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.toDeliver }))
      )
      if (!clientRes.ok) throw new Error(clientRes.message)

      toast.success(`Livraison ${blNumber as string} confirmée`)
      setDeliveryOpen(false)
      fetchOrders()

      if (fullyDelivered) sendInvoiceEmail(deliveryOrder!.id).catch(() => {})
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la livraison')
    }
    setSaving(false)
  }

  function orderRef(o: Order): string {
    return o.bc_number ?? o.invoice_number ?? `#${o.id.slice(0, 8).toUpperCase()}`
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="saas-surface p-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Livraisons</h1>
            <p className="text-sm text-slate-600 mt-0.5">Organisation des livraisons du jour et à venir</p>
          </div>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: "Aujourd'hui", count: counts.today, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Demain',      count: counts.tomorrow, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-100' },
            { label: 'En retard',   count: counts.overdue, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
            { label: 'Total',       count: counts.all, color: 'text-slate-900', bg: 'bg-white', border: 'border-slate-200' },
          ].map(k => (
            <div key={k.label} className={`saas-surface px-3.5 py-2.5 border ${k.border}`}>
              <p className={`text-2xl font-bold ${k.color}`}>{k.count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="saas-surface overflow-hidden">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-slate-100">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === tab.value ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                {tab.value === 'overdue' && counts.overdue > 0 && (
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold ${
                    activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
                  }`}>
                    {counts.overdue}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                {activeTab === 'today' ? "Aucune livraison prévue aujourd'hui" :
                 activeTab === 'tomorrow' ? 'Aucune livraison prévue demain' :
                 activeTab === 'overdue' ? 'Aucune livraison en retard' :
                 'Aucune livraison en cours'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Les commandes confirmées apparaissent ici.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-orange-50">
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">BC</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Client</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Date prévue</th>
                  <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Montant</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Paiement prévu</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Statut</th>
                  <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const ptDays = order.user?.client_profiles?.[0]?.payment_terms_days
                  const plannedDate = order.planned_delivery_date
                  const overdue = plannedDate ? isOverdue(plannedDate) : false
                  const deliveredCount = (order.deliveries ?? []).filter(d => d.status === 'validated').length
                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <p className="text-sm font-bold text-slate-900 font-mono">{orderRef(order)}</p>
                        <p className="text-[10px] text-slate-400">{order.order_items?.length ?? 0} article(s)</p>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-1.5 max-w-[180px]">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-700 truncate font-medium">{orderClientCompanyName(order)}</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {plannedDate ? (
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            overdue ? 'text-red-600' : isToday(parseISO(plannedDate)) ? 'text-blue-600' : 'text-slate-600'
                          }`}>
                            {overdue ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <Calendar className="w-3 h-3 shrink-0" />}
                            {format(parseISO(plannedDate), 'd MMM yyyy', { locale: fr })}
                            {overdue && <span className="text-[10px] font-semibold text-red-500">(retard)</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        <p className="text-sm font-bold text-slate-900">{formatAr((order.total_amount || 0) + (order.delivery_fee || 0))}</p>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                          !ptDays || ptDays === 0
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {paymentLabel(ptDays)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {deliveredCount > 0 ? (
                          <Badge className="text-[10px] bg-violet-50 text-violet-700 border-violet-200 border">
                            {deliveredCount} BL émis
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 border">
                            Confirmée
                          </Badge>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold"
                          onClick={() => openDeliveryModal(order)}
                          disabled={saving}
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          Livrer
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delivery modal */}
      {deliveryOrder && (
        <Dialog open={deliveryOpen} onOpenChange={open => { if (!open) setDeliveryOpen(false) }}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-green-600" />
                Livraison de la commande {orderRef(deliveryOrder)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="font-medium">{orderClientCompanyName(deliveryOrder)}</span>
                {deliveryOrder.planned_delivery_date && (
                  <>
                    <span className="text-slate-300">·</span>
                    <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>Prévue le {format(parseISO(deliveryOrder.planned_delivery_date), 'd MMM yyyy', { locale: fr })}</span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Saisissez les quantités à livrer pour chaque article. Laissez à 0 pour exclure un article de cette livraison.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Article</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 w-20">Commandé</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 w-20">Livré</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 w-24">À livrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLines.map((line, idx) => {
                      const remaining = line.ordered - line.alreadyDelivered
                      return (
                        <tr key={line.orderItemId} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-900">{line.productName}</span>
                            {line.variantColor && <span className="text-slate-500"> — {line.variantColor}</span>}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-slate-600">{line.ordered}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-green-600 font-semibold">{line.alreadyDelivered}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              value={line.toDeliver}
                              disabled={remaining <= 0}
                              className="h-7 w-20 text-center text-sm"
                              onChange={e => {
                                const v = Math.min(remaining, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                                setDeliveryLines(prev => prev.map((l, i) => i === idx ? { ...l, toDeliver: v } : l))
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Notes (optionnel)</Label>
                <Input
                  value={deliveryNotes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  placeholder="Ex: livraison partielle, article manquant…"
                  className="h-9 text-sm"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
                <strong>Cette livraison :</strong>{' '}
                {deliveryLines.filter(l => l.toDeliver > 0).map(l =>
                  `${l.productName}${l.variantColor ? ' (' + l.variantColor + ')' : ''} ×${l.toDeliver}`
                ).join(' · ') || 'aucun article sélectionné'}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeliveryOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={() => void createAndValidateDelivery()}
                disabled={saving || deliveryLines.every(l => l.toDeliver === 0)}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmer la livraison
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
