'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderItem, Payment, PaymentMethod } from '@/lib/types'
import { clientProfileFromUser, orderClientCompanyName } from '@/lib/order-client'
import { ClientProfileModal } from '@/components/admin/ClientProfileModal'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CLIENT_PAYMENT_METHODS } from '@/lib/payment-methods'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  ClipboardList, ChevronRight, Clock, Building2, CheckCircle2,
  FileText, Loader2, AlertCircle, Printer, Wallet, XCircle, PackageCheck,
} from 'lucide-react'
import { clientPaymentStatus, paymentMethodLabelFr, paymentStatusBadgeFr } from '@/lib/payment-labels'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatDistanceToNow, formatAr } from '@/lib/utils'
import { applyClientDeliveryStock } from '@/lib/client-stock'
import { sendInvoiceEmail } from '@/lib/actions/send-invoice-email'
import { toast } from 'sonner'

const statusConfig: Record<string, { label: string; class: string }> = {
  pending:              { label: 'En attente',          class: 'bg-amber-50 text-amber-700 border-amber-200' },
  validated:            { label: 'Confirmée',           class: 'bg-blue-50 text-blue-700 border-blue-200' },
  to_deliver:           { label: 'Confirmée',           class: 'bg-blue-50 text-blue-700 border-blue-200' },
  partially_delivered:  { label: 'En livraison',        class: 'bg-violet-50 text-violet-700 border-violet-200' },
  delivered:            { label: 'Livrée',              class: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:            { label: 'Annulée',             class: 'bg-red-50 text-red-700 border-red-200' },
}

type FilterTab = 'pending' | 'confirmed' | 'cancelled'

// Ligne de livraison dans le modal de création de livraison
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

export function AdminOrdersContent() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>(
    searchParams.get('status') === 'cancelled' ? 'cancelled' : 'pending'
  )
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [profileOrder, setProfileOrder] = useState<Order | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payReference, setPayReference] = useState('')
  const [payDate, setPayDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)

  // ── État modal livraison partielle ─────────────────────────────────────────
  const [deliveryOpen, setDeliveryOpen] = useState(false)
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null)
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLine[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState('')

  async function fetchOrders() {
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
      .order('created_at', { ascending: false })

    const enriched = (data ?? []).map(o => {
      const sumPay = o.payments?.reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0) ?? 0
      const stored = Number(o.paid_amount ?? 0)
      const paid = Math.max(stored, sumPay)
      return { ...o, total: (o.total_amount || 0) + (o.delivery_fee || 0), amount_paid: paid }
    })
    setOrders(enriched)
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  // ── Valider BC avec réservation de stock ───────────────────────────────────
  async function validateOrderWithReservation(order: Order) {
    setSaving(true)
    const supabase = createClient()
    const items = order.order_items ?? []

    try {
      // 1. Vérifier le stock disponible pour chaque ligne
      const errors: string[] = []
      for (const item of items) {
        if (item.variant_id) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('stock_quantity, reserved_quantity, color')
            .eq('id', item.variant_id)
            .single()
          if (!v) { errors.push(`Variante introuvable pour "${item.product?.name}"`); continue }
          const available = (v.stock_quantity ?? 0) - (v.reserved_quantity ?? 0)
          if (available < item.quantity) {
            errors.push(
              `Stock insuffisant : "${item.product?.name} — ${v.color}" — ` +
              `${available} disponible(s) (${v.stock_quantity} - ${v.reserved_quantity ?? 0} réservé(s)), ` +
              `${item.quantity} commandé(s)`
            )
          }
        } else {
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity, reserved_quantity, name')
            .eq('id', item.product_id)
            .single()
          if (!prod) { errors.push(`Produit introuvable`); continue }
          const available = (prod.stock_quantity ?? 0) - (prod.reserved_quantity ?? 0)
          if (available < item.quantity) {
            errors.push(
              `Stock insuffisant : "${prod.name}" — ` +
              `${available} disponible(s) (${prod.stock_quantity} - ${prod.reserved_quantity ?? 0} réservé(s)), ` +
              `${item.quantity} commandé(s)`
            )
          }
        }
      }

      if (errors.length > 0) {
        errors.forEach(e => toast.error(e, { duration: 6000 }))
        setSaving(false)
        return
      }

      // 2. Réserver le stock pour chaque ligne
      for (const item of items) {
        if (item.variant_id) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('reserved_quantity')
            .eq('id', item.variant_id)
            .single()
          if (v) {
            await supabase.from('product_variants')
              .update({ reserved_quantity: (v.reserved_quantity ?? 0) + item.quantity })
              .eq('id', item.variant_id)
          }
        } else {
          const { data: prod } = await supabase
            .from('products')
            .select('reserved_quantity')
            .eq('id', item.product_id)
            .single()
          if (prod) {
            await supabase.from('products')
              .update({ reserved_quantity: (prod.reserved_quantity ?? 0) + item.quantity })
              .eq('id', item.product_id)
          }
        }
      }

      // 3. Passer la commande en 'validated' → le trigger génère bc_number
      // planned_delivery_date : J+1 si avant midi, J+2 sinon
      const now = new Date()
      const plannedDate = new Date(now)
      plannedDate.setDate(plannedDate.getDate() + (now.getHours() < 12 ? 1 : 2))
      const plannedDateStr = plannedDate.toISOString().split('T')[0]

      const { error } = await supabase.from('orders').update({
        status: 'validated',
        planned_delivery_date: plannedDateStr,
      }).eq('id', order.id)
      if (error) throw new Error('Erreur validation: ' + error.message)

      toast.success('Commande validée — stock réservé')
      fetchOrders()
      setDetailOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur validation')
    }
    setSaving(false)
  }

  // ── Annuler une commande (libère la réservation) ───────────────────────────
  async function cancelOrder(order: Order) {
    setSaving(true)
    const supabase = createClient()
    const items = order.order_items ?? []

    try {
      // Libérer le stock réservé (seulement pour les quantités non encore livrées)
      for (const item of items) {
        const toRelease = item.quantity - (item.delivered_quantity ?? 0)
        if (toRelease <= 0) continue

        if (item.variant_id) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('reserved_quantity')
            .eq('id', item.variant_id)
            .single()
          if (v) {
            await supabase.from('product_variants')
              .update({ reserved_quantity: Math.max(0, (v.reserved_quantity ?? 0) - toRelease) })
              .eq('id', item.variant_id)
          }
        } else {
          const { data: prod } = await supabase
            .from('products')
            .select('reserved_quantity')
            .eq('id', item.product_id)
            .single()
          if (prod) {
            await supabase.from('products')
              .update({ reserved_quantity: Math.max(0, (prod.reserved_quantity ?? 0) - toRelease) })
              .eq('id', item.product_id)
          }
        }
      }

      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      toast.success('Commande annulée — stock libéré')
      fetchOrders()
      setDetailOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur annulation')
    }
    setSaving(false)
  }

  // ── Ouvrir le modal de livraison partielle ─────────────────────────────────
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

  // ── Créer et valider une livraison ────────────────────────────────────────
  async function createAndValidateDelivery() {
    if (!deliveryOrder) return

    const lines = deliveryLines.filter(l => l.toDeliver > 0)
    if (lines.length === 0) {
      toast.error('Aucune quantité à livrer')
      return
    }

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
      // 1. Créer la livraison (status = pending)
      const { data: delivery, error: dErr } = await supabase
        .from('deliveries')
        .insert({ order_id: deliveryOrder.id, status: 'pending' })
        .select()
        .single()
      if (dErr) throw new Error('Erreur création livraison: ' + dErr.message)

      // 2. Créer les lignes de livraison
      const deliveryItems = lines.map(l => ({
        delivery_id: delivery.id,
        order_item_id: l.orderItemId,
        product_id: l.productId,
        variant_id: l.variantId,
        quantity: l.toDeliver,
      }))
      const { error: diErr } = await supabase.from('delivery_items').insert(deliveryItems)
      if (diErr) throw new Error('Erreur lignes livraison: ' + diErr.message)

      // 3. Générer le numéro BL (transactionnel via RPC)
      const { data: blNumber, error: blErr } = await supabase
        .rpc('next_document_number', { p_type: 'BL' })
      if (blErr) throw new Error('Erreur numéro BL: ' + blErr.message)

      // 4. Finaliser la livraison (validated + bl_number + date)
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('deliveries').update({
        status: 'validated',
        bl_number: blNumber,
        delivery_date: today,
        notes: deliveryNotes.trim() || null,
      }).eq('id', delivery.id)

      // 5. Décrémenter le stock physique + réservé
      const syncedProducts = new Set<string>()
      for (const line of lines) {
        if (line.variantId) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('stock_quantity, reserved_quantity')
            .eq('id', line.variantId)
            .single()
          if (v) {
            await supabase.from('product_variants').update({
              stock_quantity:   Math.max(0, (v.stock_quantity ?? 0) - line.toDeliver),
              reserved_quantity: Math.max(0, (v.reserved_quantity ?? 0) - line.toDeliver),
            }).eq('id', line.variantId)
          }
          syncedProducts.add(line.productId)
        } else {
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity, reserved_quantity')
            .eq('id', line.productId)
            .single()
          if (prod) {
            await supabase.from('products').update({
              stock_quantity:    Math.max(0, (prod.stock_quantity ?? 0) - line.toDeliver),
              reserved_quantity: Math.max(0, (prod.reserved_quantity ?? 0) - line.toDeliver),
            }).eq('id', line.productId)
          }
        }
      }

      // Resync produit agrégat (somme des variantes)
      for (const pid of Array.from(syncedProducts)) {
        const { data: vars } = await supabase
          .from('product_variants').select('stock_quantity').eq('product_id', pid)
        if (vars && vars.length > 0) {
          const sum = vars.reduce((s, x) => s + (x.stock_quantity ?? 0), 0)
          await supabase.from('products').update({ stock_quantity: sum }).eq('id', pid)
        }
      }

      // 6. Créer les mouvements de stock entrepôt (OUT)
      const movements = lines.map(l => ({
        product_id: l.productId,
        type: 'OUT' as const,
        quantity: l.toDeliver,
        source: 'delivery' as const,
        reference_id: deliveryOrder!.id,
        notes: `BL ${blNumber as string}`,
      }))
      await supabase.from('stock_movements').insert(movements)

      // 7. Mettre à jour delivered_quantity sur order_items
      for (const line of lines) {
        const { data: oi } = await supabase
          .from('order_items')
          .select('delivered_quantity')
          .eq('id', line.orderItemId)
          .single()
        if (oi !== null && oi !== undefined) {
          await supabase.from('order_items')
            .update({ delivered_quantity: ((oi as { delivered_quantity?: number }).delivered_quantity ?? 0) + line.toDeliver })
            .eq('id', line.orderItemId)
        }
      }

      // 8. Vérifier si toutes les quantités sont livrées
      const { data: allItems } = await supabase
        .from('order_items')
        .select('quantity, delivered_quantity')
        .eq('order_id', deliveryOrder!.id)

      const fullyDelivered = (allItems ?? []).every(i =>
        ((i as { delivered_quantity?: number }).delivered_quantity ?? 0) >= i.quantity
      )

      let newStatus: string = 'partially_delivered'
      let faNumber: string | null = null

      if (fullyDelivered) {
        const { data: fa } = await supabase.rpc('next_document_number', { p_type: 'FA' })
        faNumber = fa as string | null
        newStatus = 'delivered'
      }

      // 9. Mettre à jour le statut de la commande
      const orderUpdate: Record<string, unknown> = { status: newStatus }
      if (fullyDelivered) {
        orderUpdate.delivery_date = today
        if (faNumber) {
          orderUpdate.fa_number = faNumber
          // Rétrocompat : si invoice_number est encore l'ancien INV- ou null
          if (!deliveryOrder!.invoice_number || deliveryOrder!.invoice_number?.startsWith('BC-')) {
            orderUpdate.invoice_number = faNumber
          }
        }
        // due_date calculée à partir de la date de livraison réelle
        const ptDays = deliveryOrder!.user?.client_profiles?.[0]?.payment_terms_days ?? 0
        if (ptDays > 0) {
          const dueDate = new Date(today + 'T00:00:00')
          dueDate.setDate(dueDate.getDate() + ptDays)
          orderUpdate.due_date = dueDate.toISOString().split('T')[0]
        }
      }
      await supabase.from('orders').update(orderUpdate).eq('id', deliveryOrder!.id)

      // 10. Appliquer le stock entreprise client (idempotent par delivery_id)
      const clientItems = lines.map(l => ({
        product_id: l.productId,
        variant_id: l.variantId,
        quantity: l.toDeliver,
      }))
      const clientRes = await applyClientDeliveryStock(
        supabase,
        { delivery_id: delivery.id, order_id: deliveryOrder!.id, user_id: deliveryOrder!.user_id },
        clientItems
      )
      if (!clientRes.ok) throw new Error(clientRes.message)

      toast.success(`Livraison ${blNumber as string} validée`)
      setDeliveryOpen(false)
      fetchOrders()

      // Email facture final (async, non-bloquant)
      if (fullyDelivered) {
        sendInvoiceEmail(deliveryOrder!.id).catch(() => {})
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la livraison')
    }
    setSaving(false)
  }

  async function addPayment() {
    if (!selectedOrder || !payAmount) return
    setSaving(true)
    const supabase = createClient()
    const amount = parseFloat(payAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      setSaving(false)
      return
    }
    const total = selectedOrder.total ?? 0
    const alreadyPaid = Math.max(
      Number(selectedOrder.paid_amount ?? 0),
      Number(selectedOrder.amount_paid ?? 0),
    )
    const remaining = Math.max(0, total - alreadyPaid)
    if (amount > remaining + 0.01) {
      toast.error(`Le montant dépasse le reste dû (${formatAr(remaining)})`)
      setSaving(false)
      return
    }

    const paymentDateIso = new Date(`${payDate}T12:00:00`).toISOString()

    const { error: insErr } = await supabase.from('payments').insert({
      order_id: selectedOrder.id,
      amount,
      payment_method: payMethod,
      payment_date: paymentDateIso,
      reference: payReference.trim() || null,
    })

    if (insErr) {
      toast.error(insErr.message)
      setSaving(false)
      return
    }

    const newPaid = alreadyPaid + amount
    const { error: ordErr } = await supabase
      .from('orders')
      .update({ paid_amount: newPaid, is_paid: newPaid >= total - 0.01 })
      .eq('id', selectedOrder.id)

    if (ordErr) {
      toast.error('Paiement enregistré mais mise à jour commande impossible : ' + ordErr.message)
    } else {
      toast.success(`Paiement de ${formatAr(amount)} enregistré`)
    }
    setPaymentOpen(false)
    setPayAmount('')
    setPayReference('')
    setPayDate(format(new Date(), 'yyyy-MM-dd'))
    fetchOrders()
    setSaving(false)
  }

  function openPaymentModal(order: Order) {
    setSelectedOrder(order)
    setPayAmount('')
    setPayReference('')
    setPayDate(format(new Date(), 'yyyy-MM-dd'))
    setPayMethod('cash')
    setPaymentOpen(true)
  }

  function openDocument(orderId: string, type: 'bc' | 'bl' | 'facture') {
    window.open(`/print/orders/${orderId}?type=${type}`, '_blank')
  }

  function orderRemaining(o: Order) {
    const t = o.total ?? (o.total_amount || 0) + (o.delivery_fee || 0)
    const p = o.amount_paid ?? 0
    return Math.max(0, Math.round((t - p) * 100) / 100)
  }

  const filtered = orders.filter(o => {
    if (activeTab === 'pending') return o.status === 'pending'
    if (activeTab === 'confirmed') return ['validated', 'to_deliver', 'partially_delivered'].includes(o.status)
    if (activeTab === 'cancelled') return o.status === 'cancelled'
    return false
  })

  const counts: Record<FilterTab, number> = {
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => ['validated', 'to_deliver', 'partially_delivered'].includes(o.status)).length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  const tabs: { value: FilterTab; label: string }[] = [
    { value: 'pending',   label: 'En attente' },
    { value: 'confirmed', label: 'Confirmées' },
    { value: 'cancelled', label: 'Annulées' },
  ]

  // Référence document à afficher dans la liste
  function orderRef(o: Order): string {
    return o.bc_number ?? o.invoice_number ?? `#${o.id.slice(0, 8).toUpperCase()}`
  }

  return (
    <>
      <div className="space-y-3">
        <div className="px-0.5">
          <h1 className="text-xl font-semibold text-slate-900">Commandes</h1>
          <p className="text-sm text-slate-600 mt-0.5">Gérer les commandes, livraisons et paiements</p>
        </div>

        <div className="saas-surface overflow-hidden">
          {/* Onglets de filtre */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-slate-100 flex-wrap">
            {tabs.map(tab => (
              <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  activeTab === tab.value ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-semibold ${
                  activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[tab.value]}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <ClipboardList className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Aucune commande trouvée</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-orange-50">
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Commande</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Client</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Date</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Statut</th>
                  <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Total</th>
                  <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Paiement</th>
                  <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const status = statusConfig[order.status]
                  const total = order.total ?? 0
                  const paid = order.amount_paid ?? 0
                  const pctPaid = total > 0 ? Math.min(100, (paid / total) * 100) : 0
                  const paySt = clientPaymentStatus(total, paid)
                  const payBadge = paymentStatusBadgeFr[paySt]
                  const rem = orderRemaining(order)
                  const canDeliver = ['validated', 'to_deliver', 'partially_delivered'].includes(order.status)
                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2">
                        <p className="text-sm font-semibold text-slate-900">{orderRef(order)}</p>
                        <p className="text-[11px] text-slate-400">{order.order_items?.length ?? 0} article(s)</p>
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-left max-w-[180px] group"
                          onClick={() => setProfileOrder(order)}
                        >
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-slate-600" />
                          <span className="text-sm text-slate-700 truncate group-hover:underline underline-offset-2">
                            {orderClientCompanyName(order)}
                          </span>
                        </button>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(order.created_at))}
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        <Badge className={`text-[11px] border ${status?.class ?? ''}`}>{status?.label ?? order.status}</Badge>
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatAr(total)}</p>
                        {(order.delivery_fee || 0) > 0 && (
                          <p className="text-[11px] text-slate-400">+{formatAr(order.delivery_fee || 0)} livr.</p>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="space-y-1">
                          <Badge variant="outline" className={`text-[10px] font-medium border ${payBadge.className}`}>
                            {payBadge.label}
                          </Badge>
                          <p className="text-[10px] text-slate-500 tabular-nums">{formatAr(paid)} / {formatAr(total)}</p>
                          {paySt !== 'paid' && (
                            <div className="w-20 bg-slate-100 rounded-full h-1">
                              <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${pctPaid}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {order.status !== 'pending' && order.status !== 'cancelled' && rem > 0.01 && (
                            <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px] gap-1"
                              title="Enregistrer un paiement" onClick={() => openPaymentModal(order)}>
                              <Wallet className="w-3 h-3" /> Payer
                            </Button>
                          )}
                          {/* BC inline */}
                          {['validated', 'to_deliver', 'partially_delivered', 'delivered'].includes(order.status) && (
                            <Button size="sm" variant="outline"
                              className="h-6 px-1.5 text-[10px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              title="Imprimer le bon de commande" onClick={() => openDocument(order.id, 'bc')}>
                              <Printer className="w-3 h-3" /> BC
                            </Button>
                          )}
                          {/* BL inline — uniquement si au moins une livraison existe */}
                          {(order.deliveries ?? []).length > 0 && (
                            <Button size="sm" variant="outline"
                              className="h-6 px-1.5 text-[10px] gap-1 border-green-200 text-green-700 hover:bg-green-50"
                              title="Imprimer le bon de livraison" onClick={() => openDocument(order.id, 'bl')}>
                              <Printer className="w-3 h-3" /> BL
                            </Button>
                          )}
                          {canDeliver && (
                            <Button size="sm" className="h-6 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => openDeliveryModal(order)} disabled={saving}>
                              <PackageCheck className="w-3 h-3" /> Livrer
                            </Button>
                          )}
                          {/* FA inline */}
                          {(order.status === 'delivered' || order.fa_number || order.invoice_number) && order.status !== 'cancelled' && (
                            <Button size="sm" variant="outline"
                              className="h-6 px-1.5 text-[10px] gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
                              title="Imprimer la facture" onClick={() => openDocument(order.id, 'facture')}>
                              <FileText className="w-3 h-3" /> FA
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-900"
                            onClick={() => { setSelectedOrder(order); setDetailOpen(true) }}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Détail commande ── */}
      {selectedOrder && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-base font-bold">{orderRef(selectedOrder)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={`text-xs border ${statusConfig[selectedOrder.status]?.class ?? ''}`}>
                      {statusConfig[selectedOrder.status]?.label ?? selectedOrder.status}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {format(parseISO(selectedOrder.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                    </span>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-1">
              {/* Client */}
              <div className="bg-slate-50 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Client</p>
                <button type="button"
                  className="font-semibold text-slate-900 text-sm hover:underline underline-offset-2 text-left w-full"
                  onClick={() => { setDetailOpen(false); setProfileOrder(selectedOrder) }}
                >
                  {orderClientCompanyName(selectedOrder)}
                </button>
                <p className="text-xs text-slate-500 mt-0.5">{clientProfileFromUser(selectedOrder.user)?.email ?? selectedOrder.user?.email}</p>
                {selectedOrder.delivery_address && (
                  <p className="text-xs text-slate-500 mt-1">📍 {selectedOrder.delivery_address}</p>
                )}
                {clientProfileFromUser(selectedOrder.user)?.payment_terms_days != null && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Délais de paiement : {clientProfileFromUser(selectedOrder.user)?.payment_terms_days} jours
                  </p>
                )}
              </div>

              {(selectedOrder.due_date || selectedOrder.total != null) && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedOrder.due_date && (
                    <Badge variant="outline" className="text-xs font-normal border-slate-200">
                      Échéance : {format(parseISO(selectedOrder.due_date), 'd MMM yyyy', { locale: fr })}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs border ${paymentStatusBadgeFr[clientPaymentStatus(selectedOrder.total ?? 0, selectedOrder.amount_paid ?? 0)].className}`}
                  >
                    {paymentStatusBadgeFr[clientPaymentStatus(selectedOrder.total ?? 0, selectedOrder.amount_paid ?? 0)].label}
                  </Badge>
                </div>
              )}

              {/* Articles */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Articles</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {selectedOrder.order_items?.map(raw => {
                    const item = raw as OrderItem
                    const lineTotal = item.unit_price * item.quantity
                    const margin = item.product
                      ? (item.unit_price - item.product.purchase_price) * item.quantity : null
                    const deliveredQty = item.delivered_quantity ?? 0
                    const remaining = item.quantity - deliveredQty
                    return (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {item.product?.name}
                            {item.variant?.color && (
                              <span className="text-slate-500 font-normal"> — {item.variant.color}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.quantity} × {formatAr(item.unit_price)}
                            {deliveredQty > 0 && (
                              <span className="ml-2 text-green-600">· {deliveredQty} livré(s){remaining > 0 ? `, ${remaining} restant(s)` : ''}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-slate-900">{formatAr(lineTotal)}</p>
                          {margin !== null && (
                            <p className={`text-[11px] ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              marge {formatAr(margin)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Livraisons existantes */}
              {(selectedOrder.deliveries ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Livraisons</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {(selectedOrder.deliveries ?? []).map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.bl_number ?? '—'}</p>
                          <p className="text-xs text-slate-400">
                            {d.delivery_date ? format(parseISO(d.delivery_date), 'd MMM yyyy', { locale: fr }) : '—'}
                          </p>
                        </div>
                        <Badge className={`text-[10px] border ${d.status === 'validated' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {d.status === 'validated' ? 'Validée' : 'En attente'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totaux */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Sous-total</span>
                  <span>{formatAr(selectedOrder.total_amount || 0)}</span>
                </div>
                {(selectedOrder.delivery_fee || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Livraison</span>
                    <span>{formatAr(selectedOrder.delivery_fee || 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-base">{formatAr(selectedOrder.total ?? 0)}</span>
                </div>
              </div>

              {/* Paiements */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Paiements</p>
                  {orderRemaining(selectedOrder) > 0.01 && selectedOrder.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => { setDetailOpen(false); openPaymentModal(selectedOrder) }}>
                      <Wallet className="w-3 h-3" /> Enregistrer paiement
                    </Button>
                  )}
                </div>
                {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {selectedOrder.payments.map((p: Payment) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{formatAr(p.amount)}</p>
                          <p className="text-xs text-slate-400">
                            {paymentMethodLabelFr(p.payment_method)}
                            {' · '}{format(parseISO(p.payment_date), 'd MMM yyyy', { locale: fr })}
                          </p>
                          {p.reference?.trim() && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">Réf. {p.reference}</p>
                          )}
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">Aucun paiement enregistré</p>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Documents</p>
                <div className="flex gap-2 flex-wrap">
                  {['validated', 'to_deliver', 'partially_delivered', 'delivered'].includes(selectedOrder.status) && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => openDocument(selectedOrder.id, 'bc')}>
                      <Printer className="w-3.5 h-3.5" /> Bon de commande
                    </Button>
                  )}
                  {(selectedOrder.deliveries ?? []).length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-green-200 text-green-700 hover:bg-green-50"
                      onClick={() => openDocument(selectedOrder.id, 'bl')}>
                      <Printer className="w-3.5 h-3.5" /> Bon de livraison
                    </Button>
                  )}
                  {(selectedOrder.status === 'delivered' || selectedOrder.fa_number || (selectedOrder.invoice_number && selectedOrder.status !== 'cancelled')) && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-violet-200 text-violet-700 hover:bg-violet-50"
                      onClick={() => openDocument(selectedOrder.id, 'facture')}>
                      <FileText className="w-3.5 h-3.5" /> Facture
                    </Button>
                  )}
                </div>
              </div>

              {/* Actions statut */}
              <div className="flex gap-2 flex-wrap">
                {selectedOrder.status === 'pending' && (
                  <Button onClick={() => validateOrderWithReservation(selectedOrder)}
                    className="flex-1 gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirmer la commande
                  </Button>
                )}
                {['validated', 'to_deliver', 'partially_delivered'].includes(selectedOrder.status) && (
                  <Button onClick={() => { setDetailOpen(false); openDeliveryModal(selectedOrder) }}
                    className="flex-1 gap-2 text-sm bg-green-600 hover:bg-green-700 text-white" disabled={saving}>
                    <PackageCheck className="w-4 h-4" /> Livrer
                  </Button>
                )}
                {/* Annulation (toute commande non livrée / non annulée) */}
                {!['delivered', 'cancelled'].includes(selectedOrder.status) && (
                  <Button
                    onClick={() => {
                      if (window.confirm('Annuler cette commande ? Le stock réservé sera libéré.')) {
                        void cancelOrder(selectedOrder)
                      }
                    }}
                    variant="outline"
                    className="gap-2 text-sm text-red-600 border-red-200 hover:bg-red-50"
                    disabled={saving}
                  >
                    <XCircle className="w-4 h-4" /> Annuler
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal de livraison partielle ── */}
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
                            {line.variantColor && (
                              <span className="text-slate-500"> — {line.variantColor}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-slate-600">{line.ordered}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-green-600">{line.alreadyDelivered}</td>
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
                  placeholder="Ex: livraison partielle, manque stylos rouges…"
                  className="h-9 text-sm"
                />
              </div>

              {/* Résumé de ce qui sera livré */}
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                Confirmer la livraison
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Enregistrer paiement ── */}
      {selectedOrder && (
        <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-xl p-3.5 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Commande</span>
                  <strong>{orderRef(selectedOrder)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Restant dû</span>
                  <strong className="text-red-600">{formatAr(orderRemaining(selectedOrder))}</strong>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Montant (Ar)</Label>
                <Input type="number" min={1} value={payAmount}
                  onChange={e => setPayAmount(e.target.value)} placeholder="0" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-method">Mode de paiement</Label>
                <select
                  id="pay-method"
                  className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 shadow-sm outline-none focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200/60"
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                >
                  {CLIENT_PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Référence (n° chèque, virement…)</Label>
                <Input value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Optionnel" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Date du paiement</Label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-8" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentOpen(false)} disabled={saving}>Annuler</Button>
              <Button onClick={addPayment} disabled={saving || !payAmount} className="bg-orange-500 hover:bg-orange-600 text-white">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</> : 'Valider'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ClientProfileModal
        open={!!profileOrder}
        onOpenChange={open => { if (!open) setProfileOrder(null) }}
        companyTitle={profileOrder ? orderClientCompanyName(profileOrder) : ''}
        profile={profileOrder ? clientProfileFromUser(profileOrder.user) : null}
      />
    </>
  )
}
