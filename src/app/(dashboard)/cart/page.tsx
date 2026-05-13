'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CartItemRow } from '@/components/cart/CartItemRow'
import {
  ShoppingCart, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, ShieldCheck, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  deliveryFeeForTotal, grandTotalTtc, catalogTva, FREE_DELIVERY_THRESHOLD,
} from '@/lib/catalog-pricing'
import { cartItemKey } from '@/lib/types'

export default function CartPage() {
  const { items, totalPrice, clearCart } = useCart()
  const { user } = useUser()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [validating, setValidating] = useState(false)

  const deliveryFee = deliveryFeeForTotal(totalPrice)
  const tva = catalogTva(totalPrice)
  const grandTotal = grandTotalTtc(totalPrice, deliveryFee)

  async function handleValidateOrder() {
    if (!user || items.length === 0) return
    setValidating(true)

    try {
      const supabase = createClient()

      // 1. Vérifier le stock disponible (stock_quantity - reserved_quantity) pour chaque article
      const stockErrors: string[] = []
      await Promise.all(items.map(async item => {
        if (item.variant_id) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('stock_quantity, reserved_quantity, color')
            .eq('id', item.variant_id)
            .single()
          const available = v ? Math.max(0, (v.stock_quantity ?? 0) - (v.reserved_quantity ?? 0)) : 0
          if (!v || available < item.quantity) {
            stockErrors.push(
              `Stock insuffisant pour "${item.product.name}" (${v?.color ?? 'couleur'}) — ` +
              `${available} disponible(s), ${item.quantity} demandé(s)`
            )
          }
        } else {
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity, reserved_quantity, name')
            .eq('id', item.product.id)
            .single()
          const available = prod ? Math.max(0, (prod.stock_quantity ?? 0) - (prod.reserved_quantity ?? 0)) : 0
          if (!prod || available < item.quantity) {
            stockErrors.push(
              `Stock insuffisant pour "${item.product.name}" — ` +
              `${available} disponible(s), ${item.quantity} demandé(s)`
            )
          }
        }
      }))

      if (stockErrors.length > 0) {
        stockErrors.forEach(e => toast.error(e))
        setValidating(false)
        return
      }

      const { data: cp } = await supabase
        .from('client_profiles')
        .select('payment_terms_days')
        .eq('user_id', user.id)
        .maybeSingle()

      const termsDays = cp?.payment_terms_days ?? 30
      const created = new Date()
      const due = new Date(created)
      due.setDate(due.getDate() + termsDays)
      const dueDate = due.toISOString().split('T')[0]

      // 2. Create the order (status = 'pending', admin validates later)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_amount: totalPrice,
          delivery_fee: deliveryFee,
          is_paid: false,
          paid_amount: 0,
          due_date: dueDate,
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 3. Insert order items (variant_id when color line)
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        variant_id: item.variant_id ?? null,
        quantity: item.quantity,
        unit_price: item.product.price,
        price: item.product.price,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      // Note: Stock decrement happens at delivery validation (in AdminOrdersContent.validateDelivery)
      // This prevents double-decrement and aligns with the business spec

      clearCart()
      setConfirmOpen(false)
      toast.success('Commande envoyée avec succès ! Elle sera traitée par notre équipe.')
      router.push('/orders')
    } catch {
      toast.error('Erreur lors de la validation. Veuillez réessayer.')
    } finally {
      setValidating(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mon panier</h1>
          <p className="text-slate-500 text-sm mt-0.5">Vérifiez vos articles avant de passer commande</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Votre panier est vide</h3>
          <p className="text-slate-500 text-sm mt-1">Ajoutez des produits depuis le catalogue.</p>
          <Link
            href="/products"
            className="mt-5 inline-flex items-center justify-center h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Parcourir le catalogue
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/products" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour au catalogue
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mon panier</h1>
            <p className="text-slate-500 text-sm mt-0.5">{items.length} article{items.length !== 1 ? 's' : ''} prêt{items.length !== 1 ? 's' : ''} à commander</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCart()}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Vider le panier
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {items.map((item, index) => (
                <div key={cartItemKey(item)}>
                  <CartItemRow item={item} />
                  {index < items.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sticky top-6">
              <h2 className="font-semibold text-slate-900 text-lg mb-4">Récapitulatif</h2>

              <div className="space-y-2.5">
                {items.map(item => (
                  <div key={cartItemKey(item)} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate max-w-[150px]">
                      {item.product.name}
                      {item.variant ? <span className="text-slate-400"> ({item.variant.color})</span> : null}
                      <span className="text-slate-400"> ×{item.quantity}</span>
                    </span>
                    <span className="text-slate-900 font-medium ml-2 tabular-nums">
                      {(item.product.price * item.quantity).toLocaleString('fr-FR')} Ar HT
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Sous-total HT</span>
                  <span className="text-slate-900 tabular-nums">
                    {totalPrice.toLocaleString('fr-FR')} Ar
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">TVA 20%</span>
                  <span className="text-slate-900 tabular-nums">
                    {tva.toLocaleString('fr-FR')} Ar
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Livraison (hors TVA)</span>
                  {deliveryFee === 0 ? (
                    <span className="text-green-600 font-medium">Gratuite</span>
                  ) : (
                    <span className="text-slate-900 tabular-nums">
                      {deliveryFee.toLocaleString('fr-FR')} Ar
                    </span>
                  )}
                </div>
                {deliveryFee > 0 && (
                  <p className="text-xs text-slate-500">
                    Livraison gratuite dès {FREE_DELIVERY_THRESHOLD.toLocaleString('fr-FR')} Ar HT
                  </p>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total TTC</span>
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {grandTotal.toLocaleString('fr-FR')} Ar
                </span>
              </div>

              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3.5">
                <div className="flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Important :</strong> En validant cette commande, vous vous engagez à acheter ces produits.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setConfirmOpen(true)}
                className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 font-medium gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Valider la commande
              </Button>

              <p className="text-xs text-slate-400 text-center mt-2">
                Aucun paiement requis — engagement d&apos;achat ferme
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Confirmer la commande
            </DialogTitle>
            <DialogDescription className="text-slate-600 mt-2">
              Vous êtes sur le point de passer une commande de{' '}
              <strong className="text-slate-900">{items.reduce((s, i) => s + i.quantity, 0)} articles</strong>{' '}
              pour un montant de{' '}
              <strong className="text-slate-900 tabular-nums">
                {grandTotal.toLocaleString('fr-FR')} Ar TTC
              </strong>
              .
              Notre équipe traitera votre commande sous 24h.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 my-2">
            <div className="flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Engagement ferme.</strong> En confirmant, vous acceptez d&apos;acheter tous les articles listés.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={validating} className="flex-1">
              Annuler
            </Button>
            <Button
              onClick={handleValidateOrder}
              disabled={validating}
              className="flex-1 bg-slate-900 hover:bg-slate-800"
            >
              {validating
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi en cours...</>
                : 'Confirmer la commande'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
