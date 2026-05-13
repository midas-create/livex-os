import type { ClientProfile, Order, User } from '@/lib/types'

export function clientProfileFromUser(user: User | undefined | null): ClientProfile | null {
  const list = user?.client_profiles
  if (!list || list.length === 0) return null
  return list[0] ?? null
}

/** Display name for orders / admin — never use raw user_id in UI */
export function orderClientCompanyName(order: Order): string {
  const cp = clientProfileFromUser(order.user)
  const fromProfile = cp?.company_name?.trim()
  if (fromProfile) return fromProfile
  const fromUser = order.user?.company_name?.trim()
  if (fromUser) return fromUser
  return 'Client'
}
