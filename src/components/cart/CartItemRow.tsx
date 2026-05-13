'use client'

import { useCart } from '@/context/CartContext'
import type { CartItem } from '@/lib/types'
import { cartItemKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ImageIcon } from 'lucide-react'
import { catalogPriceTtc } from '@/lib/catalog-pricing'

interface CartItemRowProps {
  item: CartItem
}

function validImageUrl(url?: string | null): string | null {
  if (!url) return null
  return url.startsWith('https://') ? url : null
}

export function CartItemRow({ item }: CartItemRowProps) {
  const { updateQuantity, removeItem } = useCart()
  const key = cartItemKey(item)
  const imageUrl = validImageUrl(item.product.image_url)

  const maxQty = item.variant
    ? item.variant.stock_quantity
    : item.product.stock_quantity

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
      <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
        {imageUrl ? (
          <img src={imageUrl} alt={item.product.name} className="w-full h-full object-contain p-1" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-slate-300" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">
          {item.product.subcategory?.name ?? item.product.category?.name}
        </p>
        <p className="font-semibold text-slate-900 truncate text-sm">{item.product.name}</p>
        {item.variant && (
          <p className="text-xs text-blue-700 font-medium">Couleur : {item.variant.color}</p>
        )}
        {item.product.brand && (
          <p className="text-xs text-slate-500">{item.product.brand}</p>
        )}
        <p className="text-xs text-slate-600 mt-0.5 font-medium tabular-nums">
          <span className="font-bold text-livex-navy">{catalogPriceTtc(item.product.price).toLocaleString('fr-FR')}</span>
          <span> Ar HT / unité</span>
        </p>
      </div>

      <Input
        type="number"
        min={1}
        max={maxQty}
        value={item.quantity}
        onChange={e => updateQuantity(key, parseInt(e.target.value) || 1)}
        className="w-16 h-9 text-center text-sm font-medium border-slate-200"
      />

      <div className="text-right w-32">
        <p className="font-bold text-slate-900 text-sm tabular-nums">
          {catalogPriceTtc(item.product.price * item.quantity).toLocaleString('fr-FR')} Ar HT
        </p>
        {item.quantity > 1 && (
          <p className="text-[11px] text-slate-500">
            {item.quantity} × {catalogPriceTtc(item.product.price).toLocaleString('fr-FR')} Ar HT
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeItem(key)}
        className="w-8 h-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
