import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { paymentMethodLabelFr } from '@/lib/payment-labels'
import { COMPANY } from '@/lib/company-info'
import { format, parseISO, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import logoLivex from '@/public/branding/logo-livex.png'

function formatAr(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} Ar`
}

type DocType = 'bc' | 'bl' | 'facture'

const docConfig: Record<DocType, { title: string; color: string; badge: string }> = {
  bc:      { title: 'BON DE COMMANDE',  color: '#1e40af', badge: 'BC' },
  bl:      { title: 'BON DE LIVRAISON', color: '#059669', badge: 'BL' },
  facture: { title: 'FACTURE',          color: '#7c3aed', badge: 'FA' },
}

type OrderItem = {
  id: string
  product_id: string
  variant_id?: string | null
  quantity: number
  delivered_quantity?: number
  unit_price: number
  total_price?: number
  product: { name: string; purchase_price: number } | null
  variant: { color: string } | null
}

type DeliveryRow = {
  id: string
  bl_number: string | null
  status: string
  delivery_date: string | null
  delivery_items: {
    quantity: number
    product: { name: string } | null
    variant: { color: string } | null
  }[]
}

type ClientProfileRow = {
  company_name: string
  nif: string
  stat: string
  rcs: string
  manager_name: string
  phone: string
  whatsapp?: string | null
  email: string
  address: string
  region: string
  delivery_address?: string | null
  payment_terms_days?: number | null
}

type OrderData = {
  id: string
  bc_number: string | null
  fa_number: string | null
  invoice_number: string | null
  status: string
  total_amount: number
  delivery_fee: number
  is_paid: boolean
  paid_amount?: number
  created_at: string
  validated_at: string | null
  delivery_date: string | null
  due_date: string | null
  delivery_address: string | null
  expected_delivery_date: string | null
  user: {
    email: string
    company_name: string
    client_profiles: ClientProfileRow[] | null
  } | null
  order_items: OrderItem[]
  payments: { amount: number; payment_method: string; payment_date: string; reference?: string | null }[]
  deliveries: DeliveryRow[]
}

export default async function PrintDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/products')

  const { id } = await params
  const { type } = await searchParams
  const docType = (type as DocType) ?? 'bc'

  if (!['bc', 'bl', 'facture'].includes(docType)) notFound()

  const { data: raw } = await supabase
    .from('orders')
    .select(`
      id, bc_number, fa_number, invoice_number, status, total_amount, delivery_fee, is_paid, paid_amount,
      created_at, validated_at, delivery_date, delivery_address, expected_delivery_date, due_date,
      user:users(email, company_name, client_profiles(company_name, nif, stat, rcs, manager_name, phone, whatsapp, email, address, region, delivery_address, payment_terms_days)),
      order_items(id, product_id, variant_id, quantity, delivered_quantity, unit_price, total_price, product:products(name, purchase_price), variant:product_variants(color)),
      payments(amount, payment_method, payment_date, reference),
      deliveries(id, bl_number, status, delivery_date, delivery_items(quantity, product:products(name), variant:product_variants(color)))
    `)
    .eq('id', id)
    .single()

  if (!raw) notFound()
  const order = raw as unknown as OrderData

  const cp = order.user?.client_profiles?.[0]
  const displayCompany = cp?.company_name?.trim() || order.user?.company_name?.trim() || '—'

  const doc = docConfig[docType]
  const subtotalHt = order.total_amount || 0
  const tvaAmount = Math.round(subtotalHt * 0.2)
  const deliveryFee = order.delivery_fee || 0
  const totalTtc = subtotalHt + tvaAmount + deliveryFee
  const sumPayments = order.payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0
  const totalPaid = Math.max(Number(order.paid_amount ?? 0), sumPayments)
  const remaining = Math.max(0, totalTtc - totalPaid)

  // Livraison la plus récente (validée) pour BL
  const validatedDeliveries = (order.deliveries ?? []).filter(d => d.status === 'validated')
  const latestDelivery = validatedDeliveries.at(-1) ?? null

  // Références document avec vraies séquences, fallback sur UUID pour rétrocompat
  const docRef =
    docType === 'facture'
      ? (order.fa_number ?? order.invoice_number ?? `FA-${order.id.slice(0, 8).toUpperCase()}`)
      : docType === 'bl'
      ? (latestDelivery?.bl_number ?? `BL-${order.id.slice(0, 8).toUpperCase()}`)
      : (order.bc_number ?? order.invoice_number ?? `BC-${order.id.slice(0, 8).toUpperCase()}`)

  const expectedDelivery =
    order.expected_delivery_date ??
    format(addDays(parseISO(order.created_at), 1), 'yyyy-MM-dd')

  // Pour BL : date de livraison de la livraison affichée
  const blDate = latestDelivery?.delivery_date ?? order.delivery_date

  // Pour BL : articles de la livraison affichée (ou tous les articles si pas de livraison partielle)
  const blItems = latestDelivery
    ? latestDelivery.delivery_items
    : null

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print {
      body { background: #fff; }
      .page { padding: 24px; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; size: A4; }
      .logo-block img { height: 11mm; width: auto; max-width: 47mm; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; gap: 16px; }
    .logo-block { display: flex; flex-direction: column; }
    .logo-block img { height: 36px; width: auto; max-width: 140px; display: block; margin-bottom: 6px; image-rendering: high-quality; }
    .logo-block .co-name { font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; margin: 0; }
    .logo-block .co-meta { font-size: 9.5px; color: #64748b; margin-top: 3px; line-height: 1.7; }
    .doc-badge { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .doc-badge .badge { font-size: 28px; font-weight: 900; color: ${doc.color}; letter-spacing: 1px; }
    .doc-badge .doc-title { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-badge .doc-ref { font-size: 13px; font-weight: 700; color: #0f172a; }
    .divider { border: none; border-top: 2px solid #e2e8f0; margin: 0 0 24px 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
    .meta-box h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
    .meta-box .value { font-size: 13px; font-weight: 600; color: #0f172a; }
    .meta-box .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .info-label { font-size: 10px; color: #94a3b8; }
    .info-value { font-size: 12px; font-weight: 600; color: #0f172a; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: ${doc.color}18; border-bottom: 2px solid ${doc.color}35; }
    thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${doc.color}; }
    thead th.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 9px 12px; font-size: 12px; color: #334155; }
    tbody td.right { text-align: right; }
    tbody td.strong { font-weight: 600; color: #0f172a; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-box { width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #475569; border-bottom: 1px solid #f1f5f9; }
    .total-row.grand { border-top: 2px solid #e2e8f0; border-bottom: none; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: 800; color: #0f172a; }
    .total-row.paid { color: #059669; font-weight: 600; }
    .total-row.remaining { color: #dc2626; font-weight: 700; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer p { font-size: 10px; color: #94a3b8; }
    .signature-box { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 20px; text-align: center; min-width: 160px; min-height: 70px; }
    .signature-box p { font-size: 10px; color: #94a3b8; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: ${doc.color}; color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; }
    .print-btn:hover { opacity: 0.9; }
  `

  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="page">
        {/* En-tête */}
        <div className="header">
          <div className="logo-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoLivex.src} alt="LIVEX Office Supplies" />
            <p className="co-name">{COMPANY.name}</p>
            <p className="co-meta">
              NIF&nbsp;: {COMPANY.nif}&nbsp;&nbsp;·&nbsp;&nbsp;STAT&nbsp;: {COMPANY.stat}&nbsp;&nbsp;·&nbsp;&nbsp;RCS&nbsp;: {COMPANY.rcs}
            </p>
            <p className="co-meta">
              Tél.&nbsp;{COMPANY.phone}&nbsp;&nbsp;·&nbsp;&nbsp;{COMPANY.address}, {COMPANY.city}
            </p>
          </div>
          <div className="doc-badge">
            <span className="badge">{doc.badge}</span>
            <span className="doc-title">{doc.title}</span>
            <span className="doc-ref">{docRef}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {format(parseISO(order.created_at), 'd MMMM yyyy', { locale: fr })}
            </span>
          </div>
        </div>
        <hr className="divider" />

        {/* Blocs méta */}
        <div className="meta">
          {/* Client */}
          <div className="meta-box">
            <h3>Client</h3>
            <p className="value">{displayCompany}</p>

            {/* Contact principal */}
            {cp?.manager_name && (
              <p className="sub" style={{ marginTop: 4 }}>
                Contact : {cp.manager_name}
              </p>
            )}

            {/* Adresse de livraison (BL) ou adresse société (BC/Facture) */}
            {docType === 'bl' && (cp?.delivery_address || cp?.address) ? (
              <p className="sub" style={{ marginTop: 4 }}>
                {cp?.delivery_address ?? cp?.address}
                {cp?.region ? ` — ${cp.region}` : ''}
              </p>
            ) : cp?.address ? (
              <p className="sub" style={{ marginTop: 4 }}>
                {cp.address}{cp.region ? ` — ${cp.region}` : ''}
              </p>
            ) : order.delivery_address ? (
              <p className="sub" style={{ marginTop: 4 }}>📍 {order.delivery_address}</p>
            ) : null}

            {/* Téléphone + WhatsApp */}
            {cp?.phone && (
              <p className="sub" style={{ marginTop: 4 }}>
                Tél. {cp.phone}
                {cp?.whatsapp && cp.whatsapp !== cp.phone
                  ? ` · WA ${cp.whatsapp}`
                  : ''}
              </p>
            )}

            {/* E-mail */}
            {(cp?.email || order.user?.email) && (
              <p className="sub" style={{ marginTop: 2 }}>{cp?.email ?? order.user?.email}</p>
            )}

            {/* Fiscal */}
            {(cp?.nif || cp?.stat || cp?.rcs) && (
              <p className="sub" style={{ marginTop: 6, fontSize: 10, lineHeight: 1.6 }}>
                {cp?.nif && <span>NIF : {cp.nif}</span>}
                {cp?.nif && (cp?.stat || cp?.rcs) && <span> · </span>}
                {cp?.stat && <span>STAT : {cp.stat}</span>}
                {cp?.stat && cp?.rcs && <span> · </span>}
                {cp?.rcs && <span>RCS : {cp.rcs}</span>}
              </p>
            )}
          </div>

          {/* Informations */}
          <div className="meta-box">
            <h3>Informations</h3>
            <div className="info-grid">
              <div>
                <p className="info-label">Date commande</p>
                <p className="info-value">
                  {format(parseISO(order.created_at), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>

              {docType === 'bc' && (
                <div>
                  <p className="info-label">Livraison prévue</p>
                  <p className="info-value">
                    {format(parseISO(expectedDelivery), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}

              {docType === 'bl' && (
                <>
                  <div>
                    <p className="info-label">Date livraison</p>
                    <p className="info-value">
                      {blDate
                        ? format(parseISO(blDate), 'd MMM yyyy', { locale: fr })
                        : format(new Date(), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  {validatedDeliveries.length > 1 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p className="info-label">Livraison</p>
                      <p className="info-value">
                        {validatedDeliveries.length > 1 ? `Partielle (${validatedDeliveries.length} livraisons au total)` : 'Complète'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {docType === 'facture' && (
                <div>
                  <p className="info-label">Date facture</p>
                  <p className="info-value">
                    {order.delivery_date
                      ? format(parseISO(order.delivery_date), 'd MMM yyyy', { locale: fr })
                      : format(new Date(), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}

              {docType === 'facture' && order.due_date && (
                <div>
                  <p className="info-label">Échéance</p>
                  <p className="info-value" style={{ color: remaining > 0 ? '#dc2626' : '#0f172a' }}>
                    {format(parseISO(order.due_date), 'd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}

              {docType === 'facture' && cp?.payment_terms_days != null && !order.due_date && (
                <div>
                  <p className="info-label">Délai paiement</p>
                  <p className="info-value">{cp.payment_terms_days} jours</p>
                </div>
              )}

              {docType === 'facture' && (
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <p className="info-label" style={{ marginBottom: 4 }}>Statut paiement</p>
                  {(() => {
                    const ptDays = cp?.payment_terms_days
                    const payOnDelivery = ptDays === 0 || ptDays == null
                    const bg = order.is_paid ? '#d1fae5' : totalPaid > 0 ? '#fef3c7' : payOnDelivery ? '#dbeafe' : '#fee2e2'
                    const fg = order.is_paid ? '#065f46' : totalPaid > 0 ? '#92400e' : payOnDelivery ? '#1e40af' : '#991b1b'
                    const label = order.is_paid
                      ? '✓ PAYÉE INTÉGRALEMENT'
                      : totalPaid > 0
                      ? `PAIEMENT PARTIEL — RESTE ${formatAr(remaining)}`
                      : payOnDelivery
                      ? 'PAIEMENT À LA LIVRAISON'
                      : 'NON PAYÉE'
                    return (
                      <span className="status-badge" style={{ background: bg, color: fg }}>
                        {label}
                      </span>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Articles */}
        <p className="section-title">
          {docType === 'bl' && blItems
            ? 'Articles de cette livraison'
            : 'Détail des articles'}
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Désignation</th>
              <th className="right" style={{ width: 60 }}>Qté</th>
              {docType !== 'bl' && <th className="right" style={{ width: 130 }}>P.U. HT</th>}
              {docType !== 'bl' && <th className="right" style={{ width: 130 }}>Total HT</th>}
            </tr>
          </thead>
          <tbody>
            {docType === 'bl' && blItems
              ? blItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                    <td className="strong">
                      {item.product?.name ?? '—'}
                      {item.variant?.color ? ` — ${item.variant.color}` : ''}
                    </td>
                    <td className="right">{item.quantity}</td>
                  </tr>
                ))
              : order.order_items?.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                    <td className="strong">
                      {item.product?.name ?? '—'}
                      {item.variant?.color ? ` — ${item.variant.color}` : ''}
                    </td>
                    <td className="right">{docType === 'bl' ? item.delivered_quantity ?? item.quantity : item.quantity}</td>
                    {docType !== 'bl' && <td className="right">{formatAr(item.unit_price)}</td>}
                    {docType !== 'bl' && <td className="right strong">{formatAr(item.unit_price * item.quantity)}</td>}
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Totaux (BC et Facture seulement) */}
        {docType !== 'bl' && (
          <div className="totals">
            <div className="totals-box">
              <div className="total-row">
                <span>Sous-total HT</span>
                <span>{formatAr(subtotalHt)}</span>
              </div>
              <div className="total-row">
                <span>TVA 20%</span>
                <span>{formatAr(tvaAmount)}</span>
              </div>
              <div className="total-row">
                <span>Livraison (hors TVA)</span>
                <span>{deliveryFee === 0 ? 'Gratuite' : formatAr(deliveryFee)}</span>
              </div>
              <div className="total-row grand">
                <span>Total TTC</span>
                <span>{formatAr(totalTtc)}</span>
              </div>
              {docType === 'facture' && (
                <>
                  {totalPaid > 0 && (
                    <div className="total-row paid" style={{ marginTop: 8 }}>
                      <span>Déjà réglé</span>
                      <span>{formatAr(totalPaid)}</span>
                    </div>
                  )}
                  {remaining > 0 && (
                    <div className="total-row remaining">
                      <span>Reste à payer</span>
                      <span>{formatAr(remaining)}</span>
                    </div>
                  )}
                  {remaining === 0 && totalPaid > 0 && (
                    <div className="total-row paid">
                      <span>Solde</span>
                      <span>Réglé ✓</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Historique paiements (facture uniquement) */}
        {docType === 'facture' && order.payments && order.payments.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p className="section-title">Historique des paiements</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Référence</th>
                  <th className="right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.map((p, i) => (
                  <tr key={i}>
                    <td>{format(parseISO(p.payment_date), 'd MMM yyyy', { locale: fr })}</td>
                    <td>{paymentMethodLabelFr(p.payment_method)}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{p.reference?.trim() || '—'}</td>
                    <td className="right strong">{formatAr(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Récapitulatif livraisons (BL avec plusieurs livraisons) */}
        {docType === 'bl' && validatedDeliveries.length > 1 && (
          <div style={{ marginTop: 24 }}>
            <p className="section-title">Récapitulatif des livraisons</p>
            <table>
              <thead>
                <tr>
                  <th>N° BL</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {validatedDeliveries.map(d => (
                  <tr key={d.id}>
                    <td className="strong">{d.bl_number ?? '—'}</td>
                    <td>{d.delivery_date ? format(parseISO(d.delivery_date), 'd MMM yyyy', { locale: fr }) : '—'}</td>
                    <td>{d.status === 'validated' ? 'Validée' : 'En cours'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pied de page */}
        <div className="footer">
          <div>
            <p>Merci pour votre confiance.</p>
            <p style={{ marginTop: 4 }}>
              Document généré le {format(new Date(), 'd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          {docType !== 'bc' && (
            <div className="signature-box">
              <p>Signature &amp; cachet</p>
              <p style={{ marginTop: 30 }}>________________________</p>
            </div>
          )}
        </div>
      </div>

      <button className="print-btn no-print" id="printBtn">
        🖨 Imprimer
      </button>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('printBtn').addEventListener('click', function(){ window.print(); });`,
        }}
      />
    </>
  )
}
