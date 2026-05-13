'use server'

import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { paymentMethodLabelFr } from '@/lib/payment-labels'
import { COMPANY } from '@/lib/company-info'

function fmt(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} Ar`
}

function buildInvoiceHtml(opts: {
  ref: string
  company: string
  orderDate: string
  deliveryDate: string | null
  dueDate: string | null
  items: { name: string; color?: string; qty: number; unitPrice: number }[]
  subtotal: number
  deliveryFee: number
  total: number
  totalPaid: number
  remaining: number
  payments: { date: string; method: string; reference?: string | null; amount: number }[]
  isPaid: boolean
  payOnDelivery?: boolean
}) {
  const { ref, company, orderDate, deliveryDate, dueDate, items, subtotal, deliveryFee, total, totalPaid, remaining, payments, isPaid, payOnDelivery } = opts

  const paymentStatusColor = isPaid ? '#065f46' : totalPaid > 0 ? '#92400e' : payOnDelivery ? '#1e40af' : '#991b1b'
  const paymentStatusBg    = isPaid ? '#d1fae5' : totalPaid > 0 ? '#fef3c7' : payOnDelivery ? '#dbeafe' : '#fee2e2'
  const paymentStatusLabel = isPaid
    ? '✓ PAYÉE INTÉGRALEMENT'
    : totalPaid > 0
    ? `PAIEMENT PARTIEL — RESTE ${fmt(remaining)}`
    : payOnDelivery
    ? 'PAIEMENT À LA LIVRAISON'
    : 'NON PAYÉE'

  const itemRows = items.map((item, i) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 12px;color:#94a3b8;font-size:12px;">${i + 1}</td>
      <td style="padding:8px 12px;font-weight:600;color:#0f172a;font-size:12px;">
        ${item.name}${item.color ? ` — ${item.color}` : ''}
      </td>
      <td style="padding:8px 12px;text-align:center;font-size:12px;">${item.qty}</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px;">${fmt(item.unitPrice)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:#0f172a;font-size:12px;">${fmt(item.unitPrice * item.qty)}</td>
    </tr>`).join('')

  const paymentRows = payments.length > 0
    ? payments.map(p => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:7px 12px;font-size:12px;">${p.date}</td>
        <td style="padding:7px 12px;font-size:12px;">${p.method}</td>
        <td style="padding:7px 12px;font-size:11px;color:#64748b;">${p.reference?.trim() || '—'}</td>
        <td style="padding:7px 12px;text-align:right;font-weight:600;font-size:12px;">${fmt(p.amount)}</td>
      </tr>`).join('')
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Facture ${ref}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#7c3aed;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h1 style="margin:0;font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.4px;">${COMPANY.name}</h1>
        <div style="margin-top:6px;font-size:10px;color:#ddd6fe;line-height:1.8;">
          NIF&nbsp;: ${COMPANY.nif}&nbsp;&nbsp;&middot;&nbsp;&nbsp;STAT&nbsp;: ${COMPANY.stat}&nbsp;&nbsp;&middot;&nbsp;&nbsp;RCS&nbsp;: ${COMPANY.rcs}<br/>
          T&eacute;l.&nbsp;${COMPANY.phone}&nbsp;&nbsp;&middot;&nbsp;&nbsp;${COMPANY.address}, ${COMPANY.city}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:26px;font-weight:900;color:#fff;">FA</div>
        <div style="font-size:12px;font-weight:700;color:#ddd6fe;margin-top:2px;">${ref}</div>
      </div>
    </div>

    <div style="padding:28px 32px;">

      <!-- Client + dates -->
      <div style="display:flex;gap:20px;margin-bottom:24px;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 6px;">Client</p>
          <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0;">${company}</p>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 8px;">Dates</p>
          <p style="font-size:11px;color:#64748b;margin:0 0 4px;">Commande : <strong style="color:#0f172a;">${orderDate}</strong></p>
          ${deliveryDate ? `<p style="font-size:11px;color:#64748b;margin:0 0 4px;">Livraison : <strong style="color:#0f172a;">${deliveryDate}</strong></p>` : ''}
          ${dueDate ? `<p style="font-size:11px;color:#64748b;margin:0;">Échéance : <strong style="color:${remaining > 0 ? '#dc2626' : '#0f172a'};">${dueDate}</strong></p>` : ''}
        </div>
      </div>

      <!-- Statut paiement -->
      <div style="margin-bottom:24px;">
        <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;background:${paymentStatusBg};color:${paymentStatusColor};">
          ${paymentStatusLabel}
        </span>
      </div>

      <!-- Articles -->
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 8px;">Détail des articles</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#7c3aed18;border-bottom:2px solid #7c3aed35;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#7c3aed;width:32px;">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#7c3aed;">Désignation</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#7c3aed;width:50px;">Qté</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#7c3aed;width:120px;">P.U.</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#7c3aed;width:120px;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totaux -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
        <div style="width:240px;">
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">
            <span>Sous-total</span><span>${fmt(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;">
            <span>Livraison</span><span>${fmt(deliveryFee)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0 5px;font-size:16px;font-weight:800;color:#0f172a;border-top:2px solid #e2e8f0;">
            <span>Total TTC</span><span>${fmt(total)}</span>
          </div>
          ${totalPaid > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#059669;font-weight:600;">
            <span>Déjà réglé</span><span>${fmt(totalPaid)}</span>
          </div>` : ''}
          ${remaining > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;font-weight:700;color:#dc2626;">
            <span>Reste à payer</span><span>${fmt(remaining)}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- Historique paiements -->
      ${paymentRows ? `
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin:0 0 8px;">Historique des paiements</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th style="padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Date</th>
            <th style="padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Mode</th>
            <th style="padding:7px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Réf.</th>
            <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Montant</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>` : ''}

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0 0 3px;">Merci pour votre confiance &mdash; ${COMPANY.name}</p>
      <p style="font-size:10px;color:#b0bec5;margin:0;">
        NIF&nbsp;: ${COMPANY.nif} &middot; STAT&nbsp;: ${COMPANY.stat} &middot; RCS&nbsp;: ${COMPANY.rcs}<br/>
        T&eacute;l.&nbsp;${COMPANY.phone} &middot; ${COMPANY.address}, ${COMPANY.city}
      </p>
    </div>

  </div>
</body>
</html>`
}

export async function sendInvoiceEmail(
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendInvoiceEmail] RESEND_API_KEY non configuré — email ignoré')
    return { ok: true }
  }

  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('orders')
    .select(`
      id, invoice_number, status, total_amount, delivery_fee, is_paid, paid_amount,
      created_at, delivery_date, due_date,
      user:users(email, company_name, client_profiles(company_name, email, payment_terms_days)),
      order_items(quantity, unit_price, product:products(name), variant:product_variants(color)),
      payments(amount, payment_method, payment_date, reference)
    `)
    .eq('id', orderId)
    .single()

  if (!raw) return { ok: false, error: 'Commande introuvable' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = raw as any
  const cp = order.user?.client_profiles?.[0]
  const toEmail: string = cp?.email || order.user?.email
  if (!toEmail) return { ok: false, error: 'Email client introuvable' }

  const subtotal   = Number(order.total_amount || 0)
  const deliveryFee = Number(order.delivery_fee || 0)
  const total      = subtotal + deliveryFee
  const sumPay     = (order.payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0)
  const totalPaid  = Math.max(Number(order.paid_amount ?? 0), sumPay)
  const remaining  = Math.max(0, total - totalPaid)
  const ref        = order.invoice_number ?? `FA-${order.id.slice(0, 8).toUpperCase()}`
  const company    = cp?.company_name || order.user?.company_name || toEmail

  const ptDays = cp?.payment_terms_days
  const html = buildInvoiceHtml({
    ref,
    company,
    orderDate:    format(parseISO(order.created_at),   'd MMMM yyyy', { locale: fr }),
    deliveryDate: order.delivery_date ? format(parseISO(order.delivery_date), 'd MMMM yyyy', { locale: fr }) : null,
    dueDate:      order.due_date      ? format(parseISO(order.due_date),      'd MMMM yyyy', { locale: fr }) : null,
    items: (order.order_items ?? []).map((i: { quantity: number; unit_price: number; product?: { name: string }; variant?: { color: string } }) => ({
      name:      i.product?.name ?? '—',
      color:     i.variant?.color,
      qty:       i.quantity,
      unitPrice: Number(i.unit_price),
    })),
    subtotal,
    deliveryFee,
    total,
    totalPaid,
    remaining,
    payments: (order.payments ?? []).map((p: { payment_date: string; payment_method: string; reference?: string | null; amount: number }) => ({
      date:      format(parseISO(p.payment_date), 'd MMM yyyy', { locale: fr }),
      method:    paymentMethodLabelFr(p.payment_method),
      reference: p.reference,
      amount:    Number(p.amount),
    })),
    isPaid:        order.is_paid ?? false,
    payOnDelivery: ptDays === 0 || ptDays == null,
  })

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Livex Office Supplies <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    fromEmail,
      to:      [toEmail],
      subject: `Facture ${ref} — Livex Office Supplies`,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[sendInvoiceEmail] Resend error:', body)
    return { ok: false, error: body }
  }

  return { ok: true }
}
