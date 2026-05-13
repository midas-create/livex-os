'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useUser } from '@/hooks/useUser'
import { loginWithNext, PENDING_CART_KEY } from '@/lib/auth-routes'
import type { Product, ProductVariant } from '@/lib/types'
import { cartItemKey, availableStock } from '@/lib/types'
import { ShoppingCart, Plus, Minus, Check, X, ZoomIn, Heart, Bell, Box } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { catalogPriceTtc } from '@/lib/catalog-pricing'

interface ProductCardProps {
  product: Product
  layout?: 'grid' | 'list'
  /** Stock chez le client (catalogue connecté) */
  clientStockQty?: number
}

function validImageUrl(url?: string | null): string | null {
  if (!url) return null
  return url.startsWith('https://') ? url : null
}

export function ProductCard({ product, layout = 'grid', clientStockQty }: ProductCardProps) {
  const { addItem, items } = useCart()
  const { user, loading } = useUser()
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [imageZoom, setImageZoom] = useState(false)
  const [wish, setWish] = useState(false)

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
      return (v.find(x => availableStock(x) > 0) ?? v[0]).id
    })
  }, [product.id, product.variants])

  const selectedVariant: ProductVariant | null = hasVariants && selectedVariantId
    ? variants.find(v => v.id === selectedVariantId) ?? null
    : null

  const effectiveStock = hasVariants && selectedVariant
    ? availableStock(selectedVariant)
    : availableStock(product)

  const cartKey = hasVariants && selectedVariant
    ? cartItemKey({ product, variant_id: selectedVariant.id })
    : cartItemKey({ product, variant_id: null })

  const cartItem = items.find(i => cartItemKey(i) === cartKey)
  const cartQty = cartItem?.quantity ?? 0
  const remaining = effectiveStock - cartQty
  const isOutOfStock = hasVariants
    ? variants.every(v => availableStock(v) === 0)
    : availableStock(product) === 0
  const isLowStock = !isOutOfStock && effectiveStock > 0 && effectiveStock <= 5

  const imageUrl = validImageUrl(product.image_url)

  function handleAdd() {
    if (loading) return
    if (hasVariants) {
      if (!selectedVariant) {
        toast.error('Choisissez une couleur')
        return
      }
      if (availableStock(selectedVariant) === 0) {
        toast.error('Rupture de stock pour cette couleur')
        return
      }
    }
    if (qty > remaining) {
      toast.error('Stock insuffisant pour cette couleur')
      return
    }
    if (!user) {
      sessionStorage.setItem(
        PENDING_CART_KEY,
        JSON.stringify({
          productId: product.id,
          quantity: qty,
          variantId: hasVariants ? selectedVariant?.id ?? null : null,
        })
      )
      const next = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/products'
      router.push(loginWithNext(next))
      return
    }
    addItem(product, qty, hasVariants ? selectedVariant : null)
    toast.success(`${product.name}${selectedVariant ? ` — ${selectedVariant.color}` : ''} ajouté au panier`)
    setAdded(true)
    setQty(1)
    setTimeout(() => setAdded(false), 2000)
  }

  function increment() {
    setQty(q => Math.min(remaining, q + 1))
  }
  function decrement() {
    setQty(q => Math.max(1, q - 1))
  }

  const listMode = layout === 'list'

  return (
    <>
      <div
        className={cn(
          'group relative flex overflow-hidden rounded-xl border bg-white',
          'border-slate-300/95 shadow-livex-catalog',
          'transition-all duration-200 ease-out will-change-transform',
          'hover:-translate-y-1 hover:shadow-livex-catalog-hover hover:border-orange-300/70',
          listMode
            ? 'flex-col sm:flex-row sm:items-stretch'
            : 'flex-col h-full min-h-[360px]',
          isOutOfStock && 'opacity-75'
        )}
      >
        <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5 pointer-events-none">
          {isOutOfStock ? (
            <span className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-[#f3f4f6] text-[#6b7280] border border-slate-300/90">
              Rupture
            </span>
          ) : (
            <span className="inline-flex rounded px-1 py-px text-[9px] font-bold bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80">
              En stock
            </span>
          )}
          {isLowStock && !isOutOfStock && (
            <span className="inline-flex rounded px-1 py-px text-[9px] font-semibold bg-amber-100 text-amber-900 ring-1 ring-amber-200/70">
              Stock limité
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            setWish(w => !w)
          }}
          className={cn(
            'absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full border flex items-center justify-center transition-colors',
            'border-slate-200 bg-white/95 shadow-sm',
            wish ? 'text-rose-500 border-rose-200' : 'text-slate-400 hover:text-orange-500'
          )}
          aria-label="Favoris"
        >
          <Heart className={cn('w-3 h-3', wish && 'fill-current')} />
        </button>

        <div
          className={cn(
            'relative shrink-0 cursor-zoom-in border-b border-slate-200/90 bg-[#f8f6f1]',
            imageUrl && 'bg-white',
            listMode ? 'w-full sm:w-[132px] h-[108px] sm:border-b-0 sm:border-r' : 'h-[108px] w-full'
          )}
          onClick={() => imageUrl && setImageZoom(true)}
          role={imageUrl ? 'button' : undefined}
          tabIndex={imageUrl ? 0 : undefined}
          onKeyDown={e => {
            if (imageUrl && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setImageZoom(true)
            }
          }}
        >
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center p-1.5',
              !imageUrl && 'bg-[#f8f6f1]',
              imageUrl && 'bg-transparent'
            )}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={product.name}
                className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-[1.03] pointer-events-none"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center pointer-events-none" aria-hidden>
                <Box className="w-10 h-10 text-[#d1d5db]" strokeWidth={1.25} />
              </div>
            )}
          </div>
          {imageUrl && (
            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm">
                <ZoomIn className="w-2.5 h-2.5 text-slate-500" />
              </span>
            </div>
          )}
        </div>

        <div
          className={cn(
            'flex flex-col flex-1 min-w-0 min-h-0 px-2 pb-2 pt-1.5',
            listMode ? 'sm:py-2 sm:pr-2 sm:pl-2' : 'h-full'
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-0.5 line-clamp-1 leading-none shrink-0">
            {product.subcategory?.name ?? product.category?.name}
          </p>

          <h3 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 tracking-tight shrink-0">
            <Link
              href={`/product/${product.id}`}
              className="hover:text-orange-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 rounded-sm"
            >
              {product.name}
            </Link>
          </h3>

          {product.brand ? (
            <p className="text-[13px] font-semibold text-slate-500 mt-0.5 truncate leading-tight shrink-0">{product.brand}</p>
          ) : (
            <div className="mt-0.5 h-[18px] shrink-0" aria-hidden />
          )}

          {typeof clientStockQty === 'number' && (
            <p className="text-[10px] font-bold text-livex-navy mt-0.5 tabular-nums shrink-0">
              Votre stock : {clientStockQty}
            </p>
          )}

          <div className="mt-1.5 pt-1.5 border-t border-slate-200/90 shrink-0">
            <p className="leading-snug tracking-tight text-livex-navy">
              <span className="text-[19px] font-extrabold tabular-nums">
                {catalogPriceTtc(product.price).toLocaleString('fr-FR')}
              </span>
              <span className="text-xs font-semibold text-slate-600"> Ar HT / unité</span>
            </p>
          </div>

          {/* Zone d’info fixe : pas de saut de layout selon couleurs / stock */}
          <div className={cn('flex-1 flex flex-col min-h-[5.5rem] mt-1.5', listMode && 'sm:min-h-[4.5rem]')}>
            <div className="h-5 flex items-start shrink-0">
              {!isOutOfStock ? (
                <p
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    isLowStock ? 'text-amber-700' : 'text-slate-500'
                  )}
                >
                  {hasVariants && selectedVariant
                    ? `${effectiveStock} dispo. · ${selectedVariant.color}`
                    : `${effectiveStock} disponible${effectiveStock > 1 ? 's' : ''}`}
                </p>
              ) : (
                <span className="invisible text-[10px] select-none" aria-hidden>
                  —
                </span>
              )}
            </div>

            <div className="min-h-[2.65rem] flex flex-col justify-start">
              {hasVariants ? (
                <>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Couleur</p>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {variants.map(v => {
                      const disabled = availableStock(v) === 0
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
                            'px-1 py-px rounded text-[10px] font-semibold border leading-tight transition-colors',
                            disabled && 'opacity-40 cursor-not-allowed line-through',
                            active && !disabled && 'border-orange-500 bg-orange-50 text-orange-900 shadow-sm',
                            !active && !disabled && 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                          )}
                        >
                          {v.color}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="min-h-[2.65rem]" aria-hidden />
              )}
            </div>

            <div className="h-4 flex items-center shrink-0">
              {cartQty > 0 ? (
                <div className="inline-flex items-center gap-0.5 rounded bg-emerald-50 border border-emerald-200/80 px-1 py-px text-[9px] font-bold text-emerald-900 w-fit">
                  <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" />
                  {cartQty} panier
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-auto pt-1.5 border-t border-slate-100 shrink-0">
            {isOutOfStock ? (
              <button
                type="button"
                className="w-full h-8 rounded-md border-2 border-orange-500 bg-white text-[12px] font-bold text-orange-600 hover:bg-orange-50 hover:text-orange-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                onClick={() =>
                  toast.message('Bientôt disponible', {
                    description: 'Nous vous préviendrons lorsque ce produit sera de retour.',
                  })
                }
              >
                <Bell className="w-3.5 h-3.5 shrink-0" />
                Me prévenir
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <div className="flex items-center border border-slate-300/90 rounded-md overflow-hidden bg-slate-50 h-7 shrink-0">
                  <button
                    type="button"
                    onClick={decrement}
                    disabled={qty <= 1}
                    className="w-6 h-7 flex items-center justify-center text-slate-500 hover:bg-white active:bg-slate-100 disabled:opacity-25"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-[11px] font-bold text-livex-navy tabular-nums leading-none">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={increment}
                    disabled={qty >= remaining}
                    className="w-6 h-7 flex items-center justify-center text-slate-500 hover:bg-white active:bg-slate-100 disabled:opacity-25"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={
                    remaining <= 0 || (hasVariants && (!selectedVariant || availableStock(selectedVariant) === 0))
                  }
                  className={cn(
                    'flex-1 min-w-0 h-8 rounded-md text-[12px] font-bold flex items-center justify-center gap-1',
                    'transition-all shadow-sm',
                    added
                      ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                      : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/25 hover:shadow-md'
                  )}
                >
                  {added ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Ajouté
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-3.5 h-3.5" /> Ajouter
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {imageZoom && imageUrl && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
          onClick={() => setImageZoom(false)}
        >
          <button
            type="button"
            onClick={() => setImageZoom(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="max-w-2xl w-full max-h-[80vh] bg-white rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full h-[50vh] flex items-center justify-center bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="px-4 py-2.5 border-t border-slate-200 bg-[#faf9f6]">
              <p className="font-bold text-sm text-livex-navy">{product.name}</p>
              {product.brand && <p className="text-[11px] font-semibold text-blue-700 mt-0.5">{product.brand}</p>}
              <p className="mt-1 leading-snug text-livex-navy">
                <span className="text-xl font-extrabold tabular-nums">
                  {catalogPriceTtc(product.price).toLocaleString('fr-FR')}
                </span>
                <span className="text-sm font-bold"> Ar HT / unité</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
