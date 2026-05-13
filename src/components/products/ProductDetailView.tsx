'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useUser } from '@/hooks/useUser'
import type { Product, ProductVariant } from '@/lib/types'
import { cartItemKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Plus, Minus, Check, AlertTriangle, ArrowLeft, Mail, Box } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { catalogPriceTtc } from '@/lib/catalog-pricing'
import { loginWithNext, PENDING_CART_KEY } from '@/lib/auth-routes'

const CONTACT_EMAIL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CONTACT_EMAIL
    ? process.env.NEXT_PUBLIC_CONTACT_EMAIL
    : 'contact@livex.mg'

function validImageUrl(url?: string | null): string | null {
  if (!url) return null
  return url.startsWith('https://') ? url : null
}

interface ProductDetailViewProps {
  product: Product
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const { addItem, items } = useCart()
  const { user, loading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  useEffect(() => {
    const v = product.variants ?? []
    if (v.length === 0) {
      setSelectedVariantId(null)
      return
    }
    setSelectedVariantId(prev => {
      const still = prev && v.some(x => x.id === prev)
      if (still) return prev
      return (v.find(x => x.stock_quantity > 0) ?? v[0]).id
    })
  }, [product.id, product.variants])

  const selectedVariant: ProductVariant | null = hasVariants && selectedVariantId
    ? variants.find(v => v.id === selectedVariantId) ?? null
    : null

  const effectiveStock = hasVariants && selectedVariant
    ? selectedVariant.stock_quantity
    : product.stock_quantity

  const cartKey = hasVariants && selectedVariant
    ? cartItemKey({ product, variant_id: selectedVariant.id })
    : cartItemKey({ product, variant_id: null })

  const cartItem = items.find(i => cartItemKey(i) === cartKey)
  const cartQty = cartItem?.quantity ?? 0
  const remaining = effectiveStock - cartQty
  const isOutOfStock = hasVariants
    ? variants.every(v => v.stock_quantity === 0)
    : product.stock_quantity === 0
  const isLowStock = effectiveStock > 0 && effectiveStock <= 5

  const imageUrl = validImageUrl(product.image_url)
  const contactMailtoDone = useRef(false)

  useEffect(() => {
    if (loading || !user || contactMailtoDone.current) return
    if (searchParams.get('contact') !== '1') return
    contactMailtoDone.current = true
    const subject = encodeURIComponent(`Demande fournisseur — ${product.name}`)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}`
    router.replace(`/product/${product.id}`)
  }, [loading, user, product.id, product.name, router, searchParams])

  function persistCartIntent() {
    const payload = {
      productId: product.id,
      quantity: qty,
      variantId: hasVariants ? selectedVariant?.id ?? null : null,
    }
    sessionStorage.setItem(PENDING_CART_KEY, JSON.stringify(payload))
  }

  function handleAdd() {
    if (loading) return
    if (!user) {
      if (hasVariants) {
        if (!selectedVariant) {
          toast.error('Choisissez une couleur')
          return
        }
        if (selectedVariant.stock_quantity === 0) {
          toast.error('Rupture de stock pour cette couleur')
          return
        }
      }
      if (qty > remaining) {
        toast.error('Stock insuffisant pour cette couleur')
        return
      }
      persistCartIntent()
      const next = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : `/product/${product.id}`
      router.push(loginWithNext(next))
      return
    }

    if (hasVariants) {
      if (!selectedVariant) {
        toast.error('Choisissez une couleur')
        return
      }
      if (selectedVariant.stock_quantity === 0) {
        toast.error('Rupture de stock pour cette couleur')
        return
      }
    }
    if (qty > remaining) {
      toast.error('Stock insuffisant pour cette couleur')
      return
    }
    addItem(product, qty, hasVariants ? selectedVariant : null)
    toast.success(`${product.name}${selectedVariant ? ` — ${selectedVariant.color}` : ''} ajouté au panier`)
    setAdded(true)
    setQty(1)
    setTimeout(() => setAdded(false), 2000)
  }

  function handleContactSupplier() {
    if (loading) return
    if (!user) {
      router.push(loginWithNext(`/product/${product.id}?contact=1`))
      return
    }
    const subject = encodeURIComponent(`Demande fournisseur — ${product.name}`)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}`
  }

  function increment() { setQty(q => Math.min(remaining, q + 1)) }
  function decrement() { setQty(q => Math.max(1, q - 1)) }

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au catalogue
      </Link>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div
          className={cn(
            'saas-surface aspect-square lg:aspect-auto lg:min-h-[420px] flex items-center justify-center p-8 rounded-2xl border border-slate-200',
            imageUrl ? 'bg-white' : 'bg-[#f8f6f1]'
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={product.name} className="max-w-full max-h-[min(420px,70vh)] object-contain" />
          ) : (
            <div className="flex items-center justify-center text-[#d1d5db]" aria-hidden>
              <Box className="w-16 h-16" strokeWidth={1.25} />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {product.subcategory?.name ?? product.category?.name}
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">{product.name}</h1>
            {product.brand && (
              <p className="text-lg font-bold text-indigo-600 mt-2">{product.brand}</p>
            )}
          </div>

          <p className="text-livex-navy leading-snug">
            <span className="text-3xl font-extrabold tabular-nums">
              {catalogPriceTtc(product.price).toLocaleString('fr-FR')}
            </span>
            <span className="text-base font-bold"> Ar TTC / unité</span>
          </p>

          {isOutOfStock ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Produit en rupture de stock
            </div>
          ) : (
            <p className={cn('text-sm font-medium', isLowStock ? 'text-amber-700' : 'text-green-700')}>
              {hasVariants && selectedVariant
                ? `${effectiveStock} unité(s) disponible(s) — ${selectedVariant.color}`
                : `${product.stock_quantity} unité(s) disponible(s)`}
            </p>
          )}

          {hasVariants && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Couleur</p>
              <div className="flex flex-wrap gap-2">
                {variants.map(v => {
                  const disabled = v.stock_quantity === 0
                  const active = v.id === selectedVariantId
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedVariantId(v.id)
                        setQty(1)
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        disabled && 'opacity-40 cursor-not-allowed line-through',
                        active && !disabled && 'border-slate-900 bg-slate-900 text-white',
                        !active && !disabled && 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      {v.color}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {cartQty > 0 && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {cartQty} article(s) déjà dans votre panier
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isOutOfStock && (
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={decrement}
                    disabled={qty <= 1}
                    className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-bold text-slate-900">{qty}</span>
                  <button
                    type="button"
                    onClick={increment}
                    disabled={qty >= remaining}
                    className="w-10 h-11 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={remaining <= 0 || (hasVariants && (!selectedVariant || selectedVariant.stock_quantity === 0))}
                  className={cn(
                    'flex-1 h-11 font-semibold gap-2',
                    added ? 'bg-green-600 hover:bg-green-600' : 'bg-slate-900 hover:bg-slate-800',
                  )}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" /> Ajouté
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" /> Ajouter au panier
                    </>
                  )}
                </Button>
              </div>
            )}
            <Button type="button" variant="outline" className="h-11 border-slate-200 gap-2" onClick={handleContactSupplier}>
              <Mail className="w-4 h-4" />
              Contacter le fournisseur
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
