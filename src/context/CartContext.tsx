'use client'

import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { CartItem, Product, ProductVariant } from '@/lib/types'
import { cartItemKey, availableStock } from '@/lib/types'

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: number; variant: ProductVariant | null }
  | { type: 'UPDATE_QUANTITY'; key: string; quantity: number }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'CLEAR_CART' }

interface CartContextType {
  items: CartItem[]
  addItem: (product: Product, quantity: number, variant: ProductVariant | null) => void
  updateQuantity: (key: string, quantity: number) => void
  removeItem: (key: string) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function maxStockForItem(product: Product, variant: ProductVariant | null): number {
  const hasVariants = (product.variants?.length ?? 0) > 0
  if (hasVariants && variant) return availableStock(variant)
  return availableStock(product)
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity, variant } = action
      const hasVariants = (product.variants?.length ?? 0) > 0
      if (hasVariants && !variant) return state

      const key = cartItemKey({ product, variant_id: variant?.id ?? null })
      const cap = maxStockForItem(product, variant)
      const existing = state.items.find(i => cartItemKey(i) === key)
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, cap)
        return {
          items: state.items.map(i =>
            cartItemKey(i) === key ? { ...i, quantity: newQty } : i
          ),
        }
      }
      return {
        items: [
          ...state.items,
          {
            product,
            variant_id: variant?.id ?? null,
            variant: variant ?? undefined,
            quantity: Math.min(quantity, cap),
          },
        ],
      }
    }
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { items: state.items.filter(i => cartItemKey(i) !== action.key) }
      }
      return {
        items: state.items.map(i => {
          if (cartItemKey(i) !== action.key) return i
          const cap = maxStockForItem(i.product, i.variant ?? null)
          return { ...i, quantity: Math.min(action.quantity, cap) }
        }),
      }
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => cartItemKey(i) !== action.key) }
    case 'CLEAR_CART':
      return { items: [] }
    default:
      return state
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })

  const addItem = useCallback((product: Product, quantity: number, variant: ProductVariant | null) => {
    dispatch({ type: 'ADD_ITEM', product, quantity, variant })
  }, [])

  const updateQuantity = useCallback((key: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', key, quantity })
  }, [])

  const removeItem = useCallback((key: string) => {
    dispatch({ type: 'REMOVE_ITEM', key })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items: state.items, addItem, updateQuantity, removeItem, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
