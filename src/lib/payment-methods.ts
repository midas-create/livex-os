/**
 * Modes de paiement client — stockés dans `payments.payment_method` (pas de table dédiée).
 * Ordre d’affichage : Espèces → Virement → Chèque → Mobile money
 */
export const CLIENT_PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'transfer', label: 'Virement' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'mobile_money', label: 'Mobile money' },
] as const

export type ClientPaymentMethod = (typeof CLIENT_PAYMENT_METHODS)[number]['value']
