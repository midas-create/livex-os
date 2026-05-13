/** Libellés FR pour modes de paiement (DB + legacy `bank`) */
export function paymentMethodLabelFr(method: string): string {
  switch (method) {
    case 'cash':
      return 'Espèces'
    case 'cheque':
      return 'Chèque'
    case 'transfer':
    case 'bank':
      return 'Virement'
    case 'mobile_money':
      return 'Mobile money'
    default:
      return method
  }
}

export type ClientPaymentStatus = 'unpaid' | 'partial' | 'paid'

export function clientPaymentStatus(totalTtc: number, paid: number): ClientPaymentStatus {
  if (totalTtc <= 0) return 'paid'
  const r = Math.round((totalTtc - paid) * 100) / 100
  if (r <= 0) return 'paid'
  if (paid <= 0) return 'unpaid'
  return 'partial'
}

export const paymentStatusBadgeFr: Record<ClientPaymentStatus, { label: string; className: string }> = {
  unpaid: { label: 'Impayé', className: 'bg-red-50 text-red-700 border-red-200' },
  partial: { label: 'Partiellement payé', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  paid: { label: 'Payé', className: 'bg-green-50 text-green-700 border-green-200' },
}
