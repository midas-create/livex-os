'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Clock, CheckCircle2, Building2 } from 'lucide-react'
import { toast } from 'sonner'

type RecRow = {
  id: string
  user_id: string
  total_amount: number
  delivery_fee: number
  paid_amount: number
  due_date: string | null
  fa_number: string | null
  bc_number: string | null
  invoice_number: string | null
  created_at: string
  company_name: string
}

type DueStatus = 'overdue' | 'today' | 'soon' | 'ok' | 'unknown'

function getDueStatus(dueDateStr: string | null): { type: DueStatus; label: string } {
  if (!dueDateStr) return { type: 'unknown', label: 'Sans echeance' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return { type: 'overdue', label: `${Math.abs(diffDays)} j de retard` }
  if (diffDays === 0) return { type: 'today', label: "Echeance aujourd'hui" }
  if (diffDays <= 7) return { type: 'soon', label: `Dans ${diffDays} j` }
  return { type: 'ok', label: `Dans ${diffDays} j` }
}

function statusClass(type: DueStatus) {
  if (type === 'overdue') return 'bg-red-100 text-red-800 border border-red-200'
  if (type === 'today')   return 'bg-orange-100 text-orange-800 border border-orange-200'
  if (type === 'soon')    return 'bg-amber-100 text-amber-800 border border-amber-200'
  if (type === 'ok')      return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

function fmtAr(n: number) {
  return n.toLocaleString('fr-FR') + ' Ar'
}

function orderRef(row: RecRow) {
  return row.fa_number ?? row.invoice_number ?? row.bc_number ?? `#${row.id.slice(0, 8).toUpperCase()}`
}

export function AdminRecouvrementContent() {
  const [rows, setRows] = useState<RecRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const supabase = createClient()

    const [{ data: orders, error: oErr }, { data: profiles, error: pErr }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, user_id, total_amount, delivery_fee, paid_amount, due_date, fa_number, bc_number, invoice_number, created_at')
        .eq('status', 'delivered')
        .eq('is_paid', false)
        .order('due_date', { ascending: true }),
      supabase
        .from('client_profiles')
        .select('user_id, company_name'),
    ])

    if (oErr || pErr) {
      toast.error('Erreur de chargement')
      setLoading(false)
      return
    }

    const profileMap = new Map<string, string>()
    for (const p of profiles ?? []) profileMap.set(p.user_id, p.company_name)

    const merged: RecRow[] = (orders ?? [])
      .map(o => ({
        ...o,
        paid_amount: o.paid_amount ?? 0,
        delivery_fee: o.delivery_fee ?? 0,
        company_name: profileMap.get(o.user_id) ?? 'Client inconnu',
      }))
      .filter(o => (Math.round(o.total_amount * 1.2) + o.delivery_fee) - o.paid_amount > 0)

    setRows(merged)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const stats = useMemo(() => {
    let totalBalance = 0
    let overdueBalance = 0
    let overdueCount = 0
    for (const row of rows) {
      const balance = (Math.round(row.total_amount * 1.2) + row.delivery_fee) - row.paid_amount
      totalBalance += balance
      if (getDueStatus(row.due_date).type === 'overdue') {
        overdueBalance += balance
        overdueCount++
      }
    }
    return { totalBalance, overdueBalance, overdueCount, total: rows.length }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="saas-surface p-3">
        <h1 className="text-xl font-semibold text-slate-900">Recouvrement</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Factures livrees non encaissees, triees par echeance la plus proche
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="saas-surface p-4">
              <p className="text-xs text-slate-500 font-medium">Total a recouvrer</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{fmtAr(stats.totalBalance)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.total} facture{stats.total !== 1 ? 's' : ''}</p>
            </div>

            <div className="saas-surface p-4 border-l-4 border-l-red-400">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                En retard
              </p>
              <p className="text-2xl font-bold text-red-700 tabular-nums mt-1">{fmtAr(stats.overdueBalance)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stats.overdueCount} facture{stats.overdueCount !== 1 ? 's' : ''}</p>
            </div>

            <div className="saas-surface p-4">
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                A venir
              </p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {fmtAr(stats.totalBalance - stats.overdueBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.total - stats.overdueCount} facture{(stats.total - stats.overdueCount) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="saas-surface overflow-hidden">
            {rows.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Aucune facture impayee</p>
                <p className="text-xs text-slate-500 mt-1">Toutes les livraisons sont encaissees.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-orange-50">
                      <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Societe</th>
                      <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Reference</th>
                      <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Montant FA</th>
                      <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Encaisse</th>
                      <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Reste du</th>
                      <th className="text-center text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Echeance</th>
                      <th className="text-center text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const grandTotal = Math.round(row.total_amount * 1.2) + row.delivery_fee
                      const balance = grandTotal - row.paid_amount
                      const status = getDueStatus(row.due_date)
                      const dueDateLabel = row.due_date
                        ? new Date(row.due_date).toLocaleDateString('fr-FR')
                        : '—'
                      return (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-medium text-slate-900 truncate max-w-[180px]">{row.company_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                              {orderRef(row)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{fmtAr(grandTotal)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                            {row.paid_amount > 0 ? fmtAr(row.paid_amount) : '—'}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-bold tabular-nums text-slate-900">{fmtAr(balance)}</span>
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums text-slate-600">{dueDateLabel}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass(status.type)}`}>
                              {status.type === 'overdue' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-slate-700 text-right">
                        Total a recouvrer
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                        {fmtAr(stats.totalBalance)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
