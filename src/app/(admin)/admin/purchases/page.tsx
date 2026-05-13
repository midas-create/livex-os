'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Purchase } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FormSelect } from '@/components/ui/form-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ShoppingCart, Plus, Trash2, Loader2, Package, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertCircle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatAr } from '@/lib/utils'
import { toast } from 'sonner'

interface PurchaseLine {
  id: string
  product_id: string
  variant_id: string
  quantity: string
  unit_price: string
}

const emptyLine = (): PurchaseLine => ({
  id: Math.random().toString(36).slice(2),
  product_id: '',
  variant_id: '',
  quantity: '1',
  unit_price: '',
})

const paymentStatusConfig: Record<string, { label: string; class: string }> = {
  unpaid:  { label: 'Impayé',        class: 'bg-red-50 text-red-700 border-red-200' },
  partial: { label: 'Partiel',       class: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid:    { label: 'Payé',          class: 'bg-green-50 text-green-700 border-green-200' },
}

export default function AdminPurchasesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedPurchase, setExpandedPurchase] = useState<string | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────
  const [supplierName, setSupplierName]     = useState('')
  const [purchaseDate, setPurchaseDate]     = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate]               = useState('')
  const [paymentStatus, setPaymentStatus]   = useState<'unpaid' | 'partial' | 'paid'>('unpaid')
  const [notes, setNotes]                   = useState('')
  const [lines, setLines]                   = useState<PurchaseLine[]>([emptyLine()])
  const [formOpen, setFormOpen]             = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: prods }, { data: purchs }] = await Promise.all([
      supabase.from('products').select('*, category:categories(name), variants:product_variants(*)').order('name'),
      supabase.from('purchases').select('*, purchase_items(*, product:products(id,name), variant:product_variants(color))').order('created_at', { ascending: false }),
    ])
    setProducts(prods ?? [])
    setPurchases((purchs ?? []) as Purchase[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-fill purchase_price when product selected
  function onLineProductChange(lineId: string, productId: string) {
    const product = products.find(p => p.id === productId)
    setLines(prev => prev.map(l =>
      l.id === lineId
        ? {
          ...l,
          product_id: productId,
          variant_id: '',
          unit_price: product ? String(product.purchase_price || '') : '',
        }
        : l
    ))
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine()])
  }

  function removeLine(lineId: string) {
    setLines(prev => prev.filter(l => l.id !== lineId))
  }

  function updateLine(lineId: string, field: keyof PurchaseLine, value: string) {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l))
  }

  const totalAmount = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0
    const price = parseFloat(l.unit_price) || 0
    return sum + qty * price
  }, 0)

  function resetForm() {
    setSupplierName('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setPaymentStatus('unpaid')
    setNotes('')
    setLines([emptyLine()])
  }

  async function submitPurchase() {
    if (!supplierName.trim()) { toast.error('Nom du fournisseur requis'); return }
    const validLines = lines.filter(l => l.product_id && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) { toast.error('Ajoutez au moins une ligne valide'); return }

    for (const l of validLines) {
      const p = products.find(x => x.id === l.product_id)
      if (p && (p.variants?.length ?? 0) > 0 && !l.variant_id) {
        toast.error(`Choisissez une couleur pour : ${p.name}`)
        return
      }
    }

    setSaving(true)
    const supabase = createClient()

    try {
      // 1. Create purchase header
      const { data: purchase, error: purchErr } = await supabase
        .from('purchases')
        .insert({
          supplier_name: supplierName.trim(),
          purchase_date: purchaseDate,
          due_date: dueDate || null,
          payment_status: paymentStatus,
          total_amount: totalAmount,
          notes: notes || null,
        })
        .select()
        .single()

      if (purchErr || !purchase) throw new Error('Erreur création achat: ' + purchErr?.message)

      // 2. Insert purchase lines
      const itemsToInsert = validLines.map(l => ({
        purchase_id: purchase.id,
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        quantity: parseInt(l.quantity, 10),
        unit_price: parseFloat(l.unit_price) || 0,
      }))
      const { error: itemsErr } = await supabase.from('purchase_items').insert(itemsToInsert)
      if (itemsErr) throw new Error('Erreur lignes achat: ' + itemsErr.message)

      // 3. Stock movements (IN)
      const movements = validLines.map(l => ({
        product_id: l.product_id,
        type: 'IN' as const,
        quantity: parseInt(l.quantity, 10),
        source: 'purchase' as const,
        purchase_id: purchase.id,
        notes: `Achat ${supplierName.trim()}`,
      }))
      const { error: mvtErr } = await supabase.from('stock_movements').insert(movements)
      if (mvtErr) throw new Error('Erreur mouvements stock: ' + mvtErr.message)

      // 4. Update stock: variant + aggregate product, or legacy product only
      for (const l of validLines) {
        const qty = parseInt(l.quantity, 10)
        const newPrice = parseFloat(l.unit_price)
        if (l.variant_id) {
          const { data: v } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', l.variant_id)
            .single()
          if (v) {
            await supabase
              .from('product_variants')
              .update({ stock_quantity: v.stock_quantity + qty })
              .eq('id', l.variant_id)
          }
          const { data: vars } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('product_id', l.product_id)
          const sum = (vars ?? []).reduce((s, x) => s + x.stock_quantity, 0)
          const updates: Record<string, unknown> = { stock_quantity: sum }
          if (newPrice > 0) updates.purchase_price = newPrice
          await supabase.from('products').update(updates).eq('id', l.product_id)
        } else {
          const { data: prod } = await supabase
            .from('products').select('stock_quantity').eq('id', l.product_id).single()
          if (prod) {
            const updates: Record<string, unknown> = { stock_quantity: prod.stock_quantity + qty }
            if (newPrice > 0) updates.purchase_price = newPrice
            await supabase.from('products').update(updates).eq('id', l.product_id)
          }
        }
      }

      toast.success(`Achat enregistré — ${validLines.length} produit(s) en stock`)
      resetForm()
      fetchData()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
    setSaving(false)
  }

  const totalPurchases = purchases.reduce((s, p) => s + p.total_amount, 0)
  const unpaidPurchases = purchases.filter(p => p.payment_status !== 'paid').reduce((s, p) => s + p.total_amount, 0)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="saas-surface p-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Achats fournisseurs</h1>
          <p className="text-sm text-slate-600 mt-0.5">Entrées de stock — les prix d&apos;achat sont mis à jour automatiquement</p>
        </div>
        <Button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nouvelle entrée
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="saas-surface px-3.5 py-2.5">
          <p className="text-xl font-bold text-slate-900">{purchases.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total achats</p>
        </div>
        <div className="saas-surface px-3.5 py-2.5">
          <p className="text-xl font-bold text-slate-700">{formatAr(totalPurchases)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Volume total</p>
        </div>
        <div className="saas-surface px-3.5 py-2.5">
          <p className="text-xl font-bold text-red-600">{formatAr(unpaidPurchases)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Dettes fournisseurs</p>
        </div>
      </div>

      {/* ── Formulaire saisie multi-lignes ── */}
      {formOpen && (
        <div className="saas-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Nouvelle entrée de stock</p>
              <p className="text-xs text-slate-500">Saisir l&apos;achat fournisseur ligne par ligne</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2 space-y-1.5">
                <Label>Fournisseur *</Label>
                <Input
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder="Nom du fournisseur"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date d&apos;achat</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date d&apos;échéance</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Statut paiement</Label>
                <Select value={paymentStatus} onValueChange={v => setPaymentStatus(v as typeof paymentStatus)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Impayé</SelectItem>
                    <SelectItem value="partial">Partiellement payé</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-3 space-y-1.5">
                <Label>Notes (optionnel)</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Référence bon de commande, remarques..."
                  className="h-8"
                />
              </div>
            </div>

            {/* Lines table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">Lignes d&apos;achat</p>
                <span className="text-xs text-slate-400">{lines.length} ligne(s)</span>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_80px_140px_120px_36px] gap-0 bg-orange-50 border-b border-slate-200 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">Produit</span>
                  <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide text-center">Qté</span>
                  <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide text-right">Prix unitaire</span>
                  <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide text-right">Total</span>
                  <span />
                </div>

                {/* Lines */}
                {lines.map((line, idx) => {
                  const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0)
                  const selectedProduct = products.find(p => p.id === line.product_id)
                  return (
                    <div key={line.id}
                    className={`grid grid-cols-[1fr_80px_140px_120px_36px] gap-0 px-3 py-2.5 items-center hover:bg-slate-50 ${
                        idx < lines.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      {/* Product + optional color */}
                      <div className="pr-2 space-y-1.5">
                        <Select
                          value={line.product_id}
                          onValueChange={v => onLineProductChange(line.id, v ?? '')}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Choisir un produit..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="font-medium">{p.name}</span>
                                <span className="text-slate-400 ml-2 text-xs">({p.category?.name})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedProduct && (selectedProduct.variants?.length ?? 0) > 0 && (
                          <FormSelect
                            value={line.variant_id}
                            onValueChange={v => updateLine(line.id, 'variant_id', v)}
                            options={(selectedProduct.variants ?? []).map(v => ({
                              value: v.id,
                              label: `${v.color} (stock ${v.stock_quantity})`,
                            }))}
                            placeholder="Couleur *"
                            className="text-sm"
                          />
                        )}
                        {selectedProduct && (
                          <p className="text-[10px] text-slate-400 pl-1">
                            Stock produit (total){(selectedProduct.variants?.length ?? 0) > 0 ? ' Σ' : ''} : {selectedProduct.stock_quantity}
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="px-1">
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                          className="h-8 text-center text-sm"
                        />
                      </div>

                      {/* Unit price */}
                      <div className="px-1">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={line.unit_price}
                            onChange={e => updateLine(line.id, 'unit_price', e.target.value)}
                            placeholder="0"
                            className="h-8 text-right text-sm pr-8"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Ar</span>
                        </div>
                      </div>

                      {/* Line total */}
                      <div className="px-1 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {lineTotal > 0 ? formatAr(lineTotal) : '—'}
                        </span>
                      </div>

                      {/* Delete */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length === 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Add line + total */}
                <div className="px-3 py-2.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une ligne
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">Total :</span>
                    <span className="text-lg font-bold text-slate-900">{formatAr(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-100">
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Réinitialiser
              </Button>
              <Button
                onClick={submitPurchase}
                disabled={saving || !supplierName.trim() || lines.every(l => !l.product_id)}
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2 px-6 h-8"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Valider l&apos;entrée de stock</>
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Liste des achats ── */}
      <div className="saas-surface overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="font-semibold text-slate-900 text-sm">Historique des achats</p>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : purchases.length === 0 ? (
          <div className="py-14 text-center">
            <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Aucun achat enregistré</p>
            <p className="text-slate-400 text-xs mt-1">Créez votre première entrée de stock ci-dessus</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-center">Lignes</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map(p => (
                <>
                  <TableRow key={p.id} className="cursor-pointer"
                    onClick={() => setExpandedPurchase(expandedPurchase === p.id ? null : p.id)}>
                    <TableCell className="font-semibold text-slate-900">{p.supplier_name}</TableCell>
                    <TableCell className="text-slate-600">
                      {format(parseISO(p.purchase_date), 'd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.due_date
                        ? <span className="flex items-center gap-1 text-xs">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(p.due_date), 'd MMM yyyy', { locale: fr })}
                          </span>
                        : <span className="text-slate-300">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-center text-slate-600">
                      {p.purchase_items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">{formatAr(p.total_amount)}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs border ${paymentStatusConfig[p.payment_status]?.class ?? ''}`}>
                        {paymentStatusConfig[p.payment_status]?.label ?? p.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {expandedPurchase === p.id
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </TableCell>
                  </TableRow>

                  {/* Expanded lines */}
                  {expandedPurchase === p.id && (
                    <TableRow key={`${p.id}-detail`}>
                      <TableCell colSpan={7} className="p-0 bg-slate-50">
                        <div className="px-6 py-3">
                          {p.notes && (
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {p.notes}
                            </p>
                          )}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-1.5 pr-4 text-xs font-semibold text-slate-400 uppercase">Produit</th>
                                <th className="text-center py-1.5 px-3 text-xs font-semibold text-slate-400 uppercase">Qté</th>
                                <th className="text-right py-1.5 px-3 text-xs font-semibold text-slate-400 uppercase">P.U.</th>
                                <th className="text-right py-1.5 text-xs font-semibold text-slate-400 uppercase">Total ligne</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.purchase_items?.map(item => (
                                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                  <td className="py-2 pr-4 font-medium text-slate-800">
                                    {item.product?.name ?? item.product_id.slice(0, 8)}
                                    {(item as { variant?: { color?: string } }).variant?.color && (
                                      <span className="text-slate-500 font-normal"> — {(item as { variant?: { color?: string } }).variant?.color}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-600">{item.quantity}</td>
                                  <td className="py-2 px-3 text-right text-slate-600">{formatAr(item.unit_price)}</td>
                                  <td className="py-2 text-right font-semibold text-slate-900">
                                    {formatAr((item.total_price ?? item.quantity * item.unit_price))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
