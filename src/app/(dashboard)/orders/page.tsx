'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import type { Order } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal'
import { ChevronRight, Package, Clock, CheckCircle2, Truck, TrendingUp, Inbox } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'
import { catalogPriceTtc } from '@/lib/catalog-pricing'

const statusConfig = {
  pending:    { label: 'En attente',  class: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
  validated:  { label: 'Confirmée',   class: 'bg-blue-50 text-blue-700 border-blue-200',     icon: CheckCircle2 },
  to_deliver: { label: 'En transit',  class: 'bg-violet-50 text-violet-700 border-violet-200', icon: Truck },
  delivered:  { label: 'Livrée',      class: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2 },
}

export default function OrdersPage() {
  const { user } = useUser()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return
      const supabase = createClient()
      const { data } = await supabase
        .from('orders')
        .select(`*, order_items(*, product:products(*), variant:product_variants(id, color)), payments(*)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const enriched = (data ?? []).map(o => ({
        ...o,
        total: (o.total_amount || 0) + (o.delivery_fee || 0),
        amount_paid: o.payments?.reduce((s: number, p: { amount: number }) => s + p.amount, 0) ?? 0,
      }))
      setOrders(enriched)
      setLoading(false)
    }
    fetchOrders()
  }, [user])

  const orderStats = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const monthStart = new Date(y, m, 1).getTime()
    let monthTotalTtcSum = 0
    for (const o of orders) {
      if (new Date(o.created_at).getTime() >= monthStart) {
        const raw = o.total ?? (o.total_amount || 0) + (o.delivery_fee || 0)
        monthTotalTtcSum += catalogPriceTtc(raw)
      }
    }
    const inProgress = orders.filter(o => o.status !== 'delivered').length
    let lastDelivery: string | null = null
    for (const o of orders) {
      if (o.status === 'delivered' && o.delivery_date) {
        if (!lastDelivery || o.delivery_date > lastDelivery) lastDelivery = o.delivery_date
      }
    }
    const lastDeliveryLabel =
      lastDelivery != null
        ? new Date(lastDelivery).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '—'
    return { monthTotalTtcSum, inProgress, lastDeliveryLabel }
  }, [orders])

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes commandes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Suivez l&apos;état de toutes vos commandes</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`st-${i}`} className="h-24 rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Total ce mois
                </div>
                <p className="text-xl font-bold text-slate-900 tabular-nums">
                  {orderStats.monthTotalTtcSum.toLocaleString('fr-FR')} Ar TTC
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                  <Truck className="w-3.5 h-3.5" />
                  Commandes en cours
                </div>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{orderStats.inProgress}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Dernière livraison
                </div>
                <p className="text-lg font-bold text-slate-900">{orderStats.lastDeliveryLabel}</p>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 text-center px-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 text-sm max-w-md leading-relaxed">
                  Aucune commande pour le moment — parcourez le catalogue pour commander.
                </p>
                <Link
                  href="/products"
                  className="mt-5 inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-colors"
                >
                  Voir le catalogue
                </Link>
              </div>
            ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const cfg = statusConfig[order.status as keyof typeof statusConfig]
              const StatusIcon = cfg?.icon ?? Clock
              const itemCount = order.order_items?.length ?? 0
              const total = order.total ?? 0
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-3 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {order.invoice_number ?? `Commande #${order.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <Badge className={`text-xs border ${cfg?.class ?? ''} flex items-center gap-1 shrink-0`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg?.label ?? order.status}
                          </Badge>
                          {order.is_paid && (
                            <Badge className="text-xs border bg-green-50 text-green-700 border-green-200 shrink-0">Payée</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            {formatDistanceToNow(new Date(order.created_at))}
                          </span>
                          <span>·</span>
                          <span>{itemCount} article{itemCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-slate-900 tabular-nums text-sm sm:text-base">
                          {catalogPriceTtc(total).toLocaleString('fr-FR')} Ar
                        </p>
                        <p className="text-xs text-slate-500">TTC</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
            )}
          </>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  )
}
