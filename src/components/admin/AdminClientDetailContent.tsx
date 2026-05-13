'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Phone, Mail, Clock, ClipboardList, Receipt,
  CheckCircle2, AlertTriangle, Building2, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Profile = {
  id: string
  user_id: string
  company_name: string
  phone: string
  email: string
  payment_terms_days: number | null
  address?: string | null
  region?: string | null
}

type Payment = {
  id: string
  amount: number
  payment_method: string
  payment_date: string
  reference?: string | null
}

type Order = {
  id: string
  status: string
  total_amount: number
  delivery_fee: number
  is_paid: boolean
  paid_amount: number
  due_date: string | null
  bc_number: string | null
  fa_number: string | null
  invoice_number: string | null
  created_at: string
  payments: Payment[]
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  validated: 'Validee',
  to_deliver: 'A livrer',
  partially_delivered: 'Partiel',
  delivered: 'Livree',
  cancelled: 'Annulee',
}

const ORDER_STATUS_CLASS: Record<string, string> = {
  pending:              'bg-slate-100 text-slate-600',
  validated:            'bg-blue-100 text-blue-700',
  to_deliver:           'bg-indigo-100 text-indigo-700',
  partially_delivered:  'bg-amber-100 text-amber-700',
  delivered:            'bg-emerald-100 text-emerald-700',
  cancelled:            'bg-red-100 text-red-500 line-through',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:         'Especes',
  transfer:     'Virement',
  cheque:       'Cheque',
  mobile_money: 'Mobile Money',
  bank:         'Banque',
}

function fmtAr(n: number) {
  return n.toLocaleString('fr-FR') + ' Ar'
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

function orderRef(o: Order) {
  return o.fa_number ?? o.invoice_number ?? o.bc_number ?? `#${o.id.slice(0, 8).toUpperCase()}`
}

function paymentBadge(o: Order) {
  if (o.status === 'cancelled') return null
  const invoiceable = ['delivered', 'partially_delivered'].includes(o.status)
  if (!invoiceable) return null
  if (o.is_paid) return { label: 'Paye', cls: 'bg-emerald-100 text-emerald-700' }
  if ((o.paid_amount ?? 0) > 0) return { label: 'Partiel', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Impaye', cls: 'bg-red-100 text-red-700' }
}

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent?: 'emerald' | 'red' | 'blue' | 'slate'
}) {
  const iconBg = {
    emerald: 'bg-emerald-50 text-emerald-500',
    red:     'bg-red-50 text-red-500',
    blue:    'bg-blue-50 text-blue-500',
    slate:   'bg-slate-100 text-slate-500',
  }[accent ?? 'slate']

  const valueCls = {
    emerald: 'text-emerald-700',
    red:     'text-red-700',
    blue:    'text-blue-700',
    slate:   'text-slate-900',
  }[accent ?? 'slate']

  return (
    <div className={cn('saas-surface p-4', accent === 'red' && 'border-l-4 border-l-red-400')}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', valueCls)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function AdminClientDetailContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void load()
  }, [id])

  async function load() {
    setLoading(true)
    const supabase = createClient()

    const { data: prof, error: pErr } = await supabase
      .from('client_profiles')
      .select('id, user_id, company_name, phone, email, payment_terms_days, address, region')
      .eq('id', id)
      .single()

    if (pErr || !prof) {
      toast.error('Client introuvable')
      router.push('/admin/clients')
      return
    }
    setProfile(prof as Profile)

    const { data: ords, error: oErr } = await supabase
      .from('orders')
      .select('id, status, total_amount, delivery_fee, is_paid, paid_amount, due_date, bc_number, fa_number, invoice_number, created_at, payments(id, amount, payment_method, payment_date, reference)')
      .eq('user_id', prof.user_id)
      .order('created_at', { ascending: false })

    if (oErr) {
      toast.error('Erreur chargement commandes')
    } else {
      setOrders((ords ?? []) as unknown as Order[])
    }
    setLoading(false)
  }

  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'cancelled')
    const invoiceable = orders.filter(o => ['delivered', 'partially_delivered'].includes(o.status))
    const totalBilled = invoiceable.reduce((s, o) => s + Math.round((o.total_amount ?? 0) * 1.2) + (o.delivery_fee ?? 0), 0)
    const totalPaid = invoiceable.reduce((s, o) => s + (o.paid_amount ?? 0), 0)
    return {
      orderCount: active.length,
      totalBilled,
      totalPaid,
      balance: totalBilled - totalPaid,
    }
  }, [orders])

  const allPayments = useMemo(() => {
    return orders
      .flatMap(o => (o.payments ?? []).map(p => ({ ...p, orderRef: orderRef(o) })))
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
  }, [orders])

  const initials = profile?.company_name
    ? profile.company_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="space-y-4">

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #f97316 0%, transparent 60%)' }} />
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux clients
        </Link>

        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-orange-900/30 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight truncate">{profile.company_name}</h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
              {profile.phone && (
                <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {profile.phone}
                </span>
              )}
              {profile.email && (
                <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {profile.email}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Delai paiement : <strong className="text-white">{profile.payment_terms_days ?? 30} jours</strong>
              </span>
            </div>
            {profile.region && (
              <p className="text-slate-500 text-xs mt-1.5">{profile.region}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Commandes"
          value={stats.orderCount}
          icon={ClipboardList}
          accent="slate"
        />
        <StatCard
          label="Total facture"
          value={fmtAr(stats.totalBilled)}
          sub="livraisons comprises"
          icon={Receipt}
          accent="blue"
        />
        <StatCard
          label="Encaisse"
          value={fmtAr(stats.totalPaid)}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Solde du"
          value={fmtAr(stats.balance)}
          icon={stats.balance > 0 ? AlertTriangle : CheckCircle2}
          accent={stats.balance > 0 ? 'red' : 'emerald'}
        />
      </div>

      {/* Orders */}
      <div className="saas-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-800 text-sm">Historique des commandes</h2>
          <span className="ml-auto text-xs text-slate-400 font-medium">{orders.length} commande{orders.length !== 1 ? 's' : ''}</span>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">Aucune commande</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Reference</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Statut</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Montant</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Encaisse</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Reste</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Echeance</th>
                  <th className="text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const grandTotal = Math.round((o.total_amount ?? 0) * 1.2) + (o.delivery_fee ?? 0)
                  const paid = o.paid_amount ?? 0
                  const balance = grandTotal - paid
                  const pBadge = paymentBadge(o)
                  const cancelled = o.status === 'cancelled'
                  return (
                    <tr key={o.id} className={cn('border-b border-slate-100 hover:bg-slate-50/60 transition-colors', cancelled && 'opacity-50')}>
                      <td className="px-4 py-2.5 text-slate-500 text-xs tabular-nums">{fmtDate(o.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {orderRef(o)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', ORDER_STATUS_CLASS[o.status] ?? 'bg-slate-100 text-slate-600')}>
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 font-medium">{fmtAr(grandTotal)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                        {paid > 0 ? fmtAr(paid) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {!cancelled && balance > 0
                          ? <span className="font-bold text-red-700">{fmtAr(balance)}</span>
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-xs text-slate-500">
                        {o.due_date ? fmtDate(o.due_date) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {pBadge
                          ? <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', pBadge.cls)}>{pBadge.label}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments */}
      {allPayments.length > 0 && (
        <div className="saas-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800 text-sm">Paiements recus</h2>
            <span className="ml-auto text-xs text-slate-400 font-medium">{allPayments.length} paiement{allPayments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Commande</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Montant</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Mode</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Reference</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 text-xs tabular-nums">{fmtDate(p.payment_date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p.orderRef}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">{fmtAr(p.amount)}</td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">
                      {PAYMENT_METHOD_LABEL[p.payment_method] ?? p.payment_method}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{p.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-slate-600 text-right">Total encaisse</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                    {fmtAr(allPayments.reduce((s, p) => s + p.amount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {allPayments.length === 0 && orders.length > 0 && (
        <div className="saas-surface p-6 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun paiement enregistre pour ce client.</p>
        </div>
      )}

    </div>
  )
}
