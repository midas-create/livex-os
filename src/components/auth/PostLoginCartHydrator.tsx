'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/context/CartContext'
import { useUser } from '@/hooks/useUser'
import { PENDING_CART_KEY, type PendingCartPayload } from '@/lib/auth-routes'
import { toast } from 'sonner'

export function PostLoginCartHydrator() {
  const { user, loading } = useUser()
  const { addItem } = useCart()
  const ran = useRef(false)

  useEffect(() => {
    if (loading || !user || ran.current) return

    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_CART_KEY) : null
    if (!raw) return

    ran.current = true
    sessionStorage.removeItem(PENDING_CART_KEY)

    let parsed: PendingCartPayload
    try {
      parsed = JSON.parse(raw) as PendingCartPayload
    } catch {
      return
    }

    if (!parsed.productId || parsed.quantity < 1) return

    const supabase = createClient()
    ;(async () => {
      const { data: product, error } = await supabase
        .from('products')
        .select('*, category:categories(*), subcategory:subcategories(*), variants:product_variants(*)')
        .eq('id', parsed.productId)
        .single()

      if (error || !product) {
        toast.error('Impossible de retrouver le produit. Réessayez depuis le catalogue.')
        return
      }

      const variant =
        parsed.variantId && product.variants?.length
          ? product.variants.find((v: { id: string }) => v.id === parsed.variantId) ?? null
          : null

      addItem(product, parsed.quantity, variant)
      toast.success(`${product.name} ajouté au panier`)
    })()
  }, [user, loading, addItem])

  return null
}
