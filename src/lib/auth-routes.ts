/**
 * Same-origin paths only — prevents open redirects after login.
 * Accepts pathname + optional search + hash (e.g. /product/abc?contact=1).
 */
export function safeInternalPath(raw: string | null | undefined, fallback = '/'): string {
  if (raw == null || raw === '') return fallback
  const s = raw.trim()
  if (!s.startsWith('/') || s.startsWith('//')) return fallback
  if (s.includes('://')) return fallback
  return s
}

export function postLoginDestination(raw: string | null | undefined): string {
  const s = safeInternalPath(raw, '/')
  if (s === '/login' || s === '/signup') return '/'
  return s
}

export function loginWithNext(next: string): string {
  const n = safeInternalPath(next, '/')
  return `/login?next=${encodeURIComponent(n)}`
}

export const PENDING_CART_KEY = 'livex:pendingCartAdd'

export interface PendingCartPayload {
  productId: string
  quantity: number
  variantId: string | null
}
