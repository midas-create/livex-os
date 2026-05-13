import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY } from '@/lib/company-info'

type DeliveryItemLike = {
  product_id: string
  variant_id?: string | null
  quantity: number
}

type DeliveryContext = {
  /** ID de la livraison (table deliveries) — utilisé pour l'idempotence */
  delivery_id: string
  order_id: string
  user_id: string
}

/**
 * Après validation d'une livraison Livex : entrée de stock côté client (B2B).
 *
 * - Idempotent par delivery_id : si des mouvements DELIVERY existent déjà
 *   pour cette livraison, on ne ré-applique pas.
 * - Gère les variantes : client_stocks est suivi par (company_id, product_id, variant_id).
 * - Si variant_id est null : le produit n'a pas de variante (ligne unique par produit).
 */
export async function applyClientDeliveryStock(
  supabase: SupabaseClient,
  context: DeliveryContext,
  items: DeliveryItemLike[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (items.length === 0) return { ok: true }

  const { data: profile, error: pErr } = await supabase
    .from('client_profiles')
    .select('id')
    .eq('user_id', context.user_id)
    .maybeSingle()
  if (pErr) return { ok: false, message: pErr.message }
  if (!profile) return { ok: true }

  // Idempotence : si des mouvements existent déjà pour cette delivery_id, on sort.
  const { count, error: cErr } = await supabase
    .from('client_stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_id', context.delivery_id)
    .eq('source', 'DELIVERY')
  if (cErr) return { ok: false, message: cErr.message }
  if ((count ?? 0) > 0) return { ok: true }

  // Agréger les quantités par (product_id, variant_id)
  // Clé : "product_id::variant_id" (variant_id peut être null)
  const agg = new Map<string, { product_id: string; variant_id: string | null; qty: number }>()
  for (const it of items) {
    const key = `${it.product_id}::${it.variant_id ?? 'null'}`
    const existing = agg.get(key)
    if (existing) {
      existing.qty += it.quantity
    } else {
      agg.set(key, { product_id: it.product_id, variant_id: it.variant_id ?? null, qty: it.quantity })
    }
  }

  for (const { product_id, variant_id, qty } of Array.from(agg.values())) {
    const defaultTh = Math.max(5, Math.ceil(qty * 0.2))

    // Chercher la ligne client_stocks pour cette combinaison (product + variant)
    let query = supabase
      .from('client_stocks')
      .select('id, current_stock')
      .eq('company_id', profile.id)
      .eq('product_id', product_id)

    if (variant_id) {
      query = query.eq('variant_id', variant_id)
    } else {
      query = query.is('variant_id', null)
    }

    const { data: existing, error: exErr } = await query.maybeSingle()
    if (exErr) return { ok: false, message: exErr.message }

    if (!existing) {
      const { error: insE } = await supabase.from('client_stocks').insert({
        company_id: profile.id,
        product_id,
        variant_id: variant_id ?? null,
        current_stock: qty,
        min_threshold: defaultTh,
      })
      if (insE) return { ok: false, message: insE.message }
    } else {
      const { error: upE } = await supabase
        .from('client_stocks')
        .update({ current_stock: existing.current_stock + qty })
        .eq('id', existing.id)
      if (upE) return { ok: false, message: upE.message }
    }

    const { error: mE } = await supabase.from('client_stock_movements').insert({
      company_id: profile.id,
      product_id,
      variant_id: variant_id ?? null,
      type: 'IN',
      quantity: qty,
      source: 'DELIVERY',
      order_id: context.order_id,
      delivery_id: context.delivery_id,
    })
    if (mE) return { ok: false, message: mE.message }
  }

  return { ok: true }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type ClientStockExportRow = {
  productName: string
  variantColor?: string | null
  current: number
  threshold: number
  status: string
}

/** Export simple : fenêtre imprimable (Enregistrer en PDF depuis le navigateur). */
export function openClientStockPrintReport(rows: ClientStockExportRow[], title = 'Stock entreprise — Livex'): void {
  const w = window.open('', '_blank')
  if (!w) return
  const body = rows
    .map(r => {
      const label = r.variantColor ? `${escapeHtml(r.productName)} — ${escapeHtml(r.variantColor)}` : escapeHtml(r.productName)
      return `<tr><td>${label}</td><td style="text-align:right">${r.current}</td><td style="text-align:right">${r.threshold}</td><td>${escapeHtml(r.status)}</td></tr>`
    })
    .join('')
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:28px 32px;color:#1e293b;background:#fff}
    .co-header{margin-bottom:14px}
    .co-name{font-size:17px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;margin:0 0 4px}
    .co-meta{font-size:10px;color:#64748b;line-height:1.7;margin:0}
    .co-divider{border:none;border-top:2px solid #e2e8f0;margin:14px 0 18px}
    h1{font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px}
    .meta{color:#64748b;font-size:11px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%;font-size:13px;margin-top:4px}
    th,td{border:1px solid #e2e8f0;padding:8px 10px}
    th{background:#f8fafc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#64748b;text-align:left}
    tr:nth-child(even) td{background:#fafafa}
    .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
    @media print{body{padding:16px}@page{margin:1.5cm;size:A4}}
  </style></head><body>
  <div class="co-header">
    <p class="co-name">${COMPANY.name}</p>
    <p class="co-meta">NIF&nbsp;: ${COMPANY.nif}&nbsp;&nbsp;&middot;&nbsp;&nbsp;STAT&nbsp;: ${COMPANY.stat}&nbsp;&nbsp;&middot;&nbsp;&nbsp;RCS&nbsp;: ${COMPANY.rcs}</p>
    <p class="co-meta">T&eacute;l.&nbsp;${COMPANY.phone}&nbsp;&nbsp;&middot;&nbsp;&nbsp;${COMPANY.address}, ${COMPANY.city}</p>
  </div>
  <hr class="co-divider"/>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Édité le ${new Date().toLocaleString('fr-FR')}</div>
  <table><thead><tr><th>Produit</th><th style="text-align:right">Stock actuel</th><th style="text-align:right">Seuil min.</th><th>Statut</th></tr></thead><tbody>${body}</tbody></table>
  <div class="footer">${COMPANY.name} &mdash; ${COMPANY.address}, ${COMPANY.city} &mdash; T&eacute;l.&nbsp;${COMPANY.phone}</div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 250)
}
