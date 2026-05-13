'use client'

import type { Order, OrderItem } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Package, Calendar, Truck, CheckCircle2, Clock } from 'lucide-react'
import { catalogPriceTtc } from '@/lib/catalog-pricing'

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending:    { label: 'En attente',  class: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Clock },
  validated:  { label: 'Confirmée',   class: 'bg-blue-50 text-blue-700 border-blue-200',       icon: CheckCircle2 },
  to_deliver: { label: 'En transit',  class: 'bg-violet-50 text-violet-700 border-violet-200', icon: Truck },
  delivered:  { label: 'Livrée',      class: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle2 },
}

interface OrderDetailsModalProps {
  order: Order
  open: boolean
  onClose: () => void
}

export function OrderDetailsModal({ order, open, onClose }: OrderDetailsModalProps) {
  const cfg = statusConfig[order.status] ?? statusConfig['pending']
  const StatusIcon = cfg.icon
  const subtotal = order.order_items?.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0
  const deliveryFee = order.delivery_fee ?? 0
  const grandTotal = subtotal + deliveryFee

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-base font-bold">
                {order.invoice_number ?? `Commande #${order.id.slice(0, 8).toUpperCase()}`}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge className={`text-xs border flex items-center gap-1 ${cfg.class}`}>
                  <StatusIcon className="w-3 h-3" />
                  {cfg.label}
                </Badge>
                {order.is_paid && (
                  <Badge className="text-xs border bg-green-50 text-green-700 border-green-200">Payée</Badge>
                )}
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(order.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Order items */}
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {order.order_items?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Aucun article</p>
          )}
          {order.order_items?.map(raw => {
            const item = raw as OrderItem
            return (
            <div key={item.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {item.product?.name ?? `Produit #${item.product_id.slice(0, 8)}`}
                  {item.variant?.color && (
                    <span className="text-slate-500 font-normal"> — {item.variant.color}</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {catalogPriceTtc(item.price).toLocaleString('fr-FR')} Ar TTC × {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                {catalogPriceTtc(item.price * item.quantity).toLocaleString('fr-FR')} Ar TTC
              </p>
            </div>
            )
          })}
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2 px-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Sous-total TTC</span>
            <span className="text-slate-900 tabular-nums">
              {catalogPriceTtc(subtotal).toLocaleString('fr-FR')} Ar TTC
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Frais de livraison TTC</span>
            {deliveryFee === 0
              ? <span className="text-green-600 font-medium">Gratuite</span>
              : (
                <span className="text-slate-900 tabular-nums">
                  {catalogPriceTtc(deliveryFee).toLocaleString('fr-FR')} Ar TTC
                </span>
              )
            }
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">Total TTC</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {catalogPriceTtc(grandTotal).toLocaleString('fr-FR')} Ar TTC
            </span>
          </div>
        </div>

        {/* Delivery info */}
        {order.delivery_address && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Adresse de livraison</p>
            <p className="text-slate-700">{order.delivery_address}</p>
            {order.delivery_date && (
              <p className="text-xs text-slate-400 mt-1">
                Livré le {new Date(order.delivery_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
