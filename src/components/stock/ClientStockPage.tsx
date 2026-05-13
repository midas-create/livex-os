'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import type { ClientStock } from '@/lib/types'
import { openClientStockPrintReport } from '@/lib/client-stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, ArrowDownRight, FileDown, Loader2, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { normalizeDepartmentsInput } from '@/components/client/DepartmentsEditor'

/** Libellé affiché pour une ligne de stock : "Produit — Couleur" si variante, sinon "Produit" */
function stockLabel(row: ClientStock): string {
  const variantColor = (row as unknown as { variant?: { color?: string } }).variant?.color
  return variantColor ? `${row.product?.name ?? '—'} — ${variantColor}` : (row.product?.name ?? '—')
}

export function ClientStockPage() {
  const { user, loading: userLoading } = useUser()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [departmentList, setDepartmentList] = useState<string[]>([])
  const [rows, setRows] = useState<ClientStock[]>([])
  const [loading, setLoading] = useState(true)
  const [sortieOpen, setSortieOpen] = useState(false)
  const [sortieStockId, setSortieStockId] = useState<string>('')
  const [sortieDepartment, setSortieDepartment] = useState<string>('')
  const [sortieQty, setSortieQty] = useState('1')
  const [sortieSignedBy, setSortieSignedBy] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user || user.role === 'admin') {
      setRows([])
      setCompanyId(null)
      setDepartmentList([])
      setLoading(false)
      return
    }
    const supabase = createClient()
    const { data: cp, error: cpErr } = await supabase
      .from('client_profiles')
      .select('id, departments')
      .eq('user_id', user.id)
      .maybeSingle()
    if (cpErr || !cp) {
      setCompanyId(null)
      setDepartmentList([])
      setRows([])
      setLoading(false)
      return
    }
    setCompanyId(cp.id)
    const depts = normalizeDepartmentsInput((cp.departments as string[] | null | undefined) ?? [])
    setDepartmentList(depts)

    // Inclure la variante (couleur) dans la sélection
    const { data, error } = await supabase
      .from('client_stocks')
      .select('*, product:products(id, name), variant:product_variants(id, color)')
      .eq('company_id', cp.id)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Impossible de charger le stock')
      setRows([])
    } else {
      const list = ((data ?? []) as ClientStock[]).slice().sort((a, b) =>
        stockLabel(a).localeCompare(stockLabel(b), 'fr')
      )
      setRows(list)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (userLoading) return
    setLoading(true)
    void load()
  }, [userLoading, load])

  async function saveThreshold(id: string, raw: string) {
    const v = Math.max(0, Math.floor(Number(raw) || 0))
    const supabase = createClient()
    const { error } = await supabase.from('client_stocks').update({ min_threshold: v }).eq('id', id)
    if (error) {
      toast.error('Enregistrement impossible')
      return
    }
    toast.success('Seuil mis à jour')
    void load()
  }

  function openSortieModal() {
    if (departmentList.length === 0) {
      toast.error('Ajoutez des départements dans Mon compte avant une sortie.')
      return
    }
    setSortieDepartment(departmentList[0] ?? '')
    setSortieStockId('')
    setSortieQty('1')
    setSortieSignedBy('')
    setSortieOpen(true)
  }

  async function submitSortie() {
    if (!sortieDepartment) {
      toast.error('Choisissez un département')
      return
    }
    if (!sortieStockId) {
      toast.error('Choisissez un produit')
      return
    }
    if (!sortieSignedBy.trim()) {
      toast.error('Indiquez le signataire')
      return
    }
    const qty = Math.floor(Number(sortieQty) || 0)
    if (qty <= 0) {
      toast.error('Quantité invalide')
      return
    }
    const row = rows.find(r => r.id === sortieStockId)
    if (!row || !companyId) return
    if (qty > row.current_stock) {
      toast.error('Stock insuffisant')
      return
    }
    setSaving(true)
    const supabase = createClient()

    // Fetch current HT price to store on the movement (historical accuracy)
    const { data: prod } = await supabase
      .from('products')
      .select('price')
      .eq('id', row.product_id)
      .maybeSingle()
    const unitPriceHt = prod?.price ?? 0

    const next = row.current_stock - qty

    const { error: uErr } = await supabase
      .from('client_stocks')
      .update({ current_stock: next })
      .eq('id', row.id)
    if (uErr) {
      toast.error(uErr.message)
      setSaving(false)
      return
    }

    const { error: mErr } = await supabase.from('client_stock_movements').insert({
      company_id: companyId,
      product_id: row.product_id,
      variant_id: row.variant_id ?? null,
      type: 'OUT',
      quantity: qty,
      source: 'MANUAL',
      order_id: null,
      department: sortieDepartment,
      signed_by: sortieSignedBy.trim(),
      unit_price_ht: unitPriceHt,
    })
    if (mErr) {
      toast.error(mErr.message)
      // Rollback du décrément
      await supabase.from('client_stocks').update({ current_stock: row.current_stock }).eq('id', row.id)
      setSaving(false)
      return
    }
    toast.success('Sortie enregistrée')
    setSortieOpen(false)
    setSortieQty('1')
    setSortieStockId('')
    setSortieDepartment('')
    setSortieSignedBy('')
    setSaving(false)
    void load()
  }

  function exportPdf() {
    const data = rows.map(r => {
      const low = r.current_stock <= r.min_threshold
      const variantColor = (r as unknown as { variant?: { color?: string } }).variant?.color
      return {
        productName: r.product?.name ?? '—',
        variantColor: variantColor ?? null,
        current: r.current_stock,
        threshold: r.min_threshold,
        status: low ? 'Sous le seuil' : 'OK',
      }
    })
    openClientStockPrintReport(data)
  }

  if (userLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!user || user.role === 'admin') {
    return <p className="text-sm text-slate-600">Cette page est réservée aux comptes client.</p>
  }

  if (!companyId) {
    return <p className="text-sm text-slate-600">Complétez votre profil entreprise pour gérer le stock.</p>
  }

  const lowRows = rows.filter(r => r.current_stock <= r.min_threshold)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock entreprise</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Consommation manuelle et seuils — les entrées se font à la livraison des commandes. Les départements sont
            définis à l&apos;inscription ou dans <strong>Mon compte</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/stock/stats"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Statistiques
          </Link>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportPdf} disabled={rows.length === 0}>
            <FileDown className="w-4 h-4" />
            Export PDF
          </Button>
          <Button type="button" size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white" onClick={openSortieModal}>
            <ArrowDownRight className="w-4 h-4" />
            Quick sortie
          </Button>
        </div>
      </div>

      {lowRows.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-red-900 flex items-center gap-2">
            <Package className="w-4 h-4 shrink-0" />
            Stock bas ({lowRows.length} ligne{lowRows.length > 1 ? 's' : ''})
          </p>
          <ul className="mt-2 text-sm text-red-800 list-disc list-inside space-y-0.5">
            {lowRows.map(r => (
              <li key={r.id}>
                {stockLabel(r)} — {r.current_stock} / seuil {r.min_threshold}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-700">Produit</th>
                <th className="px-4 py-2.5 font-semibold text-slate-700 w-28">Stock</th>
                <th className="px-4 py-2.5 font-semibold text-slate-700 w-36">Seuil min.</th>
                <th className="px-4 py-2.5 font-semibold text-slate-700 w-32">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Aucune ligne de stock. Les produits apparaîtront après une première livraison validée.
                  </td>
                </tr>
              ) : (
                rows.map(r => {
                  const low = r.current_stock <= r.min_threshold
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{stockLabel(r)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.current_stock}</td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          defaultValue={r.min_threshold}
                          className="h-8 w-24 text-sm"
                          onBlur={e => {
                            const v = e.target.value
                            if (Number(v) !== r.min_threshold) void saveThreshold(r.id, v)
                          }}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            low
                              ? 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800'
                              : 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800'
                          }
                        >
                          {low ? 'Alerte' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Quick sortie */}
      <Dialog
        open={sortieOpen}
        onOpenChange={open => {
          setSortieOpen(open)
          if (!open) {
            setSortieStockId('')
            setSortieQty('1')
            setSortieDepartment('')
            setSortieSignedBy('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Quick sortie</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Département</Label>
              <Select value={sortieDepartment} onValueChange={v => setSortieDepartment(v ?? '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir un département…" />
                </SelectTrigger>
                <SelectContent>
                  {departmentList.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Produit</Label>
              <Select value={sortieStockId} onValueChange={v => setSortieStockId(v ?? '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map(r => (
                    <SelectItem key={r.id} value={r.id} disabled={r.current_stock <= 0}>
                      {stockLabel(r)} (stock {r.current_stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Quantité</Label>
              <Input
                type="number"
                min={1}
                className="h-9"
                value={sortieQty}
                onChange={e => setSortieQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Signataire</Label>
              <Input
                type="text"
                className="h-9"
                placeholder="Nom de l'agent ou employé…"
                value={sortieSignedBy}
                onChange={e => setSortieSignedBy(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSortieOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => void submitSortie()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
