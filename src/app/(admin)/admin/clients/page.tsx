'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Loader2, Pencil, Check, Eye, AlertCircle, MapPin } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type ClientRow = {
  id: string
  user_id: string
  company_name: string
  phone: string
  email: string
  address?: string | null
  payment_terms_days: number | null
  profile_completed?: boolean
}

export default function AdminClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDays, setEditDays] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_profiles')
      .select('id, user_id, company_name, phone, email, address, payment_terms_days, profile_completed')
      .order('company_name')

    if (error) {
      toast.error(error.message)
      setRows([])
    } else {
      setRows((data ?? []) as unknown as ClientRow[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveTerms(row: ClientRow) {
    const n = parseInt(editDays, 10)
    if (Number.isNaN(n) || n < 0 || n > 365) {
      toast.error('Délai invalide (0 à 365 jours)')
      return
    }
    setSavingId(row.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('client_profiles')
      .update({ payment_terms_days: n })
      .eq('id', row.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Délais de paiement mis à jour')
      setEditingId(null)
      load()
    }
    setSavingId(null)
  }

  return (
    <div className="space-y-3">
      <div className="saas-surface p-3">
        <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Fiches société et délais de paiement (jours après commande pour l&apos;échéance)
        </p>
      </div>

      <div className="saas-surface overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-sm">Aucun profil client</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-orange-50">
                <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5">Société</th>
                <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Téléphone</th>
                <th className="text-left text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Adresse</th>
                <th className="text-center text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Profil</th>
                <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-3 py-2.5">Délai (j)</th>
                <th className="text-right text-[11px] font-semibold text-orange-700 uppercase tracking-wide px-4 py-2.5 w-48"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isEdit = editingId === row.id
                return (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900 truncate max-w-[200px] block">{row.company_name}</span>
                          {row.email?.trim() && (
                            <span className="text-xs text-slate-400 truncate max-w-[200px] block">{row.email}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 tabular-nums text-sm">{row.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[180px]">
                      {row.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{row.address}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.profile_completed
                        ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Profil complet" />
                        : <span title="Profil incomplet"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mx-auto" /></span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-semibold text-slate-900 tabular-nums">{row.payment_terms_days ?? 30}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEdit ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            className="h-8 w-20 text-right"
                            value={editDays}
                            onChange={e => setEditDays(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveTerms(row) }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setEditingId(null)}
                            disabled={savingId === row.id}
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 gap-1 bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => saveTerms(row)}
                            disabled={savingId === row.id}
                          >
                            {savingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            OK
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/clients/${row.id}`}>
                            <Button size="sm" variant="outline" className="h-8 gap-1 border-orange-200 text-orange-700 hover:bg-orange-50">
                              <Eye className="w-3 h-3" /> Voir
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => {
                              setEditingId(row.id)
                              setEditDays(String(row.payment_terms_days ?? 30))
                            }}
                          >
                            <Pencil className="w-3 h-3" /> Modifier
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
