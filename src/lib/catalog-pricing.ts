/**
 * Tarification catalogue Livex.
 * Les prix stockes en base (products.price) sont en HT.
 * TVA 20% applicable sur les produits uniquement (pas sur la livraison).
 */
export const TVA_RATE = 0.20

export const DELIVERY_FEE = 15000
export const FREE_DELIVERY_THRESHOLD = 1000000

/** Retourne le prix HT tel quel (les prix DB sont deja HT). */
export function catalogPriceTtc(ht: number): number {
  return ht
}

/** Montant de TVA sur un montant HT. */
export function catalogTva(ht: number): number {
  return Math.round(ht * TVA_RATE)
}

/** Montant TTC = HT + TVA (sans livraison). */
export function catalogTtcFromHt(ht: number): number {
  return Math.round(ht * (1 + TVA_RATE))
}

/** Frais de livraison pour un sous-total HT donne (0 si >= seuil). */
export function deliveryFeeForTotal(subtotalHt: number): number {
  return subtotalHt >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
}

/** Total TTC a payer = HT + TVA + livraison (livraison hors TVA). */
export function grandTotalTtc(subtotalHt: number, deliveryFee: number): number {
  return Math.round(subtotalHt * (1 + TVA_RATE)) + deliveryFee
}

export function formatCatalogPriceTtcPerUnit(ht: number): string {
  return `${ht.toLocaleString('fr-FR')} Ar HT / unite`
}

export function formatCatalogMoneyTtc(ht: number): string {
  return `${ht.toLocaleString('fr-FR')} Ar HT`
}
