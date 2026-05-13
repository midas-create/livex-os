'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CashflowOutflow, Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { addDays, eachDayOfInterval, format, parseISO, startOfDay, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatAr } from '@/lib/utils'
import { Landmark, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type OrderRow = Pick<Order, 'id' | 'status' | 'total_amount' | 'delivery_fee' | 'paid_amount' | 'due_date' | 'invoice_number'>

function orderRemaining(o: OrderRow) {
  const t = (o.total_amount || 0) + (o.delivery_fee || 0)
  const p = Number(o.paid_amount ?? 0)
  return Math.max(0, Math.round((t - p) * 100) / 100)
}

export default function AdminTresoreriePage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [outflows, setOutflows] = useState<CashflowOutflow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [outLabel, setOutLabel] = useState('')
  const [outAmount, setOutAmount] = useState('')
  const [outDue, setOutDue] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'))

  const start = startOfDay(new Date())
  const horizonEnd = addDays(start, 6)
  const days = eachDayOfInterval({ start, end: horizonEnd })

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(horizonEnd, 'yyyy-MM-dd')

    const [{ data: ord }, { data: out }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, total_amount, delivery_fee, paid_amount, due_date, invoice_number')
        .not('status', 'eq', 'pending'),
      supabase
        .from('cashflow_outflows')
        .select('*')
        .gte('due_date', startStr)
        .lte('due_date', endStr)
        .order('due_date'),
    ])

    setOrders((ord ?? []) as OrderRow[])
    setOutflows((out ?? []) as CashflowOutflow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function incomingOnDay(dayKey: string) {
    return orders.reduce((sum, o) => {
      if (!o.due_date || o.due_date !== dayKey) return sum
      const rem = orderRemaining(o)
      return sum + rem
    }, 0)
  }

  function outgoingOnDay(dayKey: string) {
    return outflows.filter(o => o.due_date === dayKey).reduce((s, o) => s + Number(o.amount), 0)
  }

  const overdueIncoming = orders.reduce((sum, o) => {
    if (!o.due_date || o.status === 'pending') return sum
    const d = parseISO(o.due_date)
    if (!isBefore(d, start)) return sum
    return sum + orderRemaining(o)
  }, 0)

  let totalIn = 0
  let totalOut = 0
  for (const d of days) {
    const key = format(d, 'yyyy-MM-dd')
    totalIn += incomingOnDay(key)
    totalOut += outgoingOnDay(key)
  }

  async function addOutflow(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(outAmount.replace(',', '.'))
    if (!outLabel.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error('Libellé et montant valides requis')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('cashflow_outflows').insert({
      label: outLabel.trim(),
      amount,
      due_date: outDue,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Sortie enregistrée')
      setOutLabel('')
      setOutAmount('')
      setOutDue(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
      load()
    }
    setSaving(false)
  }

  async function removeOutflow(id: string) {
    if (!confirm('Supprimer cette sortie ?')) return
    const supabase = createClient()
    const { error } = await supabase.from('cashflow_outflows').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Supprimé')
      load()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Landmark className="w-6 h-6 text-slate-700" />
          Prévision de trésorerie
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Encaissements attendus (reste dû par date d&apos;échéance) et sorties fournisseurs sur 7 jours — contrôle simple, sans comptabilité.
        </p>
      </div>

      {overdueIncoming > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Retard :</strong> {formatAr(overdueIncoming)} de commandes avec échéance déjà passée et solde restant.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">7 prochains jours</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Entrées = reste dû des commandes (hors &quot;en attente&quot;) à la date d&apos;échéance
            </p>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Entrées</th>
                  <th className="px-3 py-2 text-right">Sorties</th>
                  <th className="px-4 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {days.map(d => {
                  const key = format(d, 'yyyy-MM-dd')
                  const inc = incomingOnDay(key)
                  const out = outgoingOnDay(key)
                  const net = inc - out
                  return (
                    <tr key={key} className="border-b border-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {format(d, 'EEE d MMM', { locale: fr })}
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-700 tabular-nums">{formatAr(inc)}</td>
                      <td className="px-3 py-2.5 text-right text-red-600 tabular-nums">{formatAr(out)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${net >= 0 ? 'text-slate-900' : 'text-red-700'}`}>
                        {formatAr(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td className="px-4 py-3">Totaux période</td>
                  <td className="px-3 py-3 text-right text-emerald-700">{formatAr(totalIn)}</td>
                  <td className="px-3 py-3 text-right text-red-600">{formatAr(totalOut)}</td>
                  <td className={`px-4 py-3 text-right ${totalIn - totalOut >= 0 ? '' : 'text-red-700'}`}>
                    {formatAr(totalIn - totalOut)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-900">Sortie (fournisseur / charge)</p>
          <form onSubmit={addOutflow} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Libellé</Label>
              <Input value={outLabel} onChange={e => setOutLabel(e.target.value)} placeholder="Ex. Fournisseur X" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>Montant (Ar)</Label>
              <Input value={outAmount} onChange={e => setOutAmount(e.target.value)} placeholder="0" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>Date d&apos;échéance</Label>
              <Input type="date" value={outDue} onChange={e => setOutDue(e.target.value)} className="h-9" />
            </div>
            <Button type="submit" disabled={saving} className="w-full gap-1 bg-slate-900 text-white h-9">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </Button>
          </form>

          {!loading && outflows.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sorties sur la période</p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                {outflows.map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
                    <span className="truncate text-slate-700">{o.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-red-600 font-medium tabular-nums">{formatAr(Number(o.amount))}</span>
                      <button
                        type="button"
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeOutflow(o.id)}
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
