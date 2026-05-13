'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Product, StockMovement } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Layers, ArrowUpRight, ArrowDownLeft, Plus, AlertTriangle, Search,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatAr } from '@/lib/utils'

const sourceLabel: Record<string, string> = {
  purchase:   'Achat',
  sale:       'Vente',
  delivery:   'Livraison',
  adjustment: 'Ajustement',
}

export default function AdminStockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function fetchData() {
    const supabase = createClient()
    const [{ data: prods }, { data: mvts }] = await Promise.all([
      supabase.from('products').select('*, category:categories(name), subcategory:subcategories(name)').order('name'),
      supabase.from('stock_movements').select('*, product:products(id,name)').order('created_at', { ascending: false }).limit(300),
    ])
    setProducts(prods ?? [])
    setMovements(mvts ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const outOfStock = products.filter(p => p.stock_quantity === 0).length
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length
  const totalValue = products.reduce((s, p) => s + (p.purchase_price || 0) * p.stock_quantity, 0)

  return (
    <div className="space-y-3">
      <div className="saas-surface p-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gestion du stock</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Les entrées se font via les <Link href="/admin/purchases" className="text-orange-600 hover:underline">achats fournisseurs</Link>.
            Les sorties sont automatiques à la livraison.
          </p>
        </div>
        <Link href="/admin/purchases">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-8 text-sm">
            <Plus className="w-4 h-4" />
            Nouvelle entrée stock
          </Button>
        </Link>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Total produits',    value: products.length,     color: 'text-slate-700' },
          { label: 'Rupture de stock',  value: outOfStock,          color: 'text-red-600'   },
          { label: 'Stock faible (≤5)', value: lowStock,            color: 'text-amber-600' },
          { label: 'Valeur du stock',   value: formatAr(totalValue), color: 'text-green-700' },
        ].map(item => (
          <div key={item.label} className="saas-surface px-3.5 py-2.5">
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-white border border-slate-200 rounded-xl p-1 h-auto gap-1">
          <TabsTrigger value="overview"
            className="rounded-lg px-4 py-1.5 text-sm data-active:bg-orange-500 data-active:text-white">
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="movements"
            className="rounded-lg px-4 py-1.5 text-sm data-active:bg-orange-500 data-active:text-white">
            Historique des mouvements
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="mt-3">
          <div className="saas-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200 text-sm h-8"
                />
              </div>
            </div>
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-14 text-center">
                <Layers className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Aucun produit disponible</p>
                <p className="text-slate-400 text-xs mt-1">Ajoutez des produits via l&apos;onglet Produits</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Prix d&apos;achat</TableHead>
                    <TableHead className="text-right">Prix de vente</TableHead>
                    <TableHead className="text-right">Valeur stock</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map(p => {
                    const isOut = p.stock_quantity === 0
                    const isLow = !isOut && p.stock_quantity <= 5
                    const margin = p.price > 0 && p.purchase_price > 0
                      ? Math.round(((p.price - p.purchase_price) / p.price) * 100)
                      : null
                    return (
                      <TableRow key={p.id} className={isOut ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''}>
                        <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{p.category?.name}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {p.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-slate-600">{formatAr(p.purchase_price || 0)}</TableCell>
                        <TableCell className="text-right text-slate-600">
                          {formatAr(p.price || 0)}
                          {margin !== null && (
                            <span className={`ml-1.5 text-xs ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {margin}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatAr((p.purchase_price || 0) * p.stock_quantity)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isOut ? (
                            <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">Rupture</Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-xs gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />Faible
                            </Badge>
                          ) : (
                            <Badge className="bg-green-50 text-green-600 border-green-200 text-xs">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Movements tab ── */}
        <TabsContent value="movements" className="mt-3">
          <div className="saas-surface overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : movements.length === 0 ? (
              <div className="py-14 text-center">
                <Layers className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Aucun mouvement de stock</p>
                <p className="text-slate-400 text-xs mt-1">Les mouvements apparaissent après les achats et livraisons</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Quantité</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-slate-500">
                        {format(parseISO(m.created_at), 'd MMM yyyy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 text-sm">
                        {m.product?.name ?? m.product_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {m.type === 'IN' ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Entrée
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <ArrowDownLeft className="w-3.5 h-3.5" /> Sortie
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold text-sm ${m.type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
                          {m.type === 'IN' ? '+' : '−'}{m.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {sourceLabel[m.source] ?? m.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{m.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
