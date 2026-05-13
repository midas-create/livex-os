'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import type { Product, Category, Subcategory } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/products/ProductCard'
import { Search, LayoutGrid, List, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'name'
type AvailabilityFilter = 'all' | 'instock' | 'out'

// 4 columns × 3 rows = 12 per page on desktop; same value for list view
const PAGE_SIZE = 12

const filterSelect =
  'h-7 text-[11px] border border-slate-300/90 rounded-md bg-white px-1.5 shadow-sm font-medium text-slate-700 cursor-pointer focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200/60'

function productInStock(p: Product): boolean {
  const v = p.variants ?? []
  if (v.length > 0) return v.some(x => x.stock_quantity > 0)
  return p.stock_quantity > 0
}

// ─── Pagination component ─────────────────────────────────────────────────────

function CatalogPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, totalItems)

  // Generate visible page numbers with ellipsis placeholders
  function pages(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, '…', totalPages]
    if (page >= totalPages - 3)
      return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '…', page - 1, page, page + 1, '…', totalPages]
  }

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-md text-sm font-medium transition-colors border'

  return (
    <div className="flex flex-col items-center gap-2 pt-4 pb-1">
      <div className="flex items-center gap-1 flex-wrap justify-center">
        {/* Previous */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={cn(
            btnBase,
            'gap-1 sm:pr-2.5',
            page === 1
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-white'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50 bg-white'
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Précédent</span>
        </button>

        {/* Page numbers */}
        {pages().map((n, i) =>
          n === '…' ? (
            <span
              key={`ell-${i}`}
              className="inline-flex items-center justify-center h-8 w-7 text-sm text-slate-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n as number)}
              className={cn(
                btnBase,
                n === page
                  ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              {n}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={cn(
            btnBase,
            'gap-1 sm:pl-2.5',
            page === totalPages
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-white'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50 bg-white'
          )}
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Range info */}
      <p className="text-[11px] text-slate-400 font-medium">
        Produits{' '}
        <span className="text-slate-600 font-semibold tabular-nums">
          {from}–{to}
        </span>{' '}
        sur{' '}
        <span className="text-slate-600 font-semibold tabular-nums">{totalItems}</span>
      </p>
    </div>
  )
}

// ─── Main catalog ─────────────────────────────────────────────────────────────

export function ProductCatalog() {
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [clientStockByProductId, setClientStockByProductId] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [availability, setAvailability] = useState<AvailabilityFilter>('all')
  const [sort, setSort] = useState<SortKey>('relevance')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [sidebarStock, setSidebarStock] = useState(false)
  const [sidebarRupture, setSidebarRupture] = useState(false)

  // ─── Pagination state ───────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  // Ref to scroll to the top of the product grid on page change
  const gridTopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = searchParams.get('q')
    const cat = searchParams.get('category')
    if (q != null) setSearch(q)
    if (cat) setSelectedCategory(cat)
  }, [searchParams])

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setClientStockByProductId({})
      return
    }
    async function loadClientStock() {
      if (!user) return
      const supabase = createClient()
      const { data: cp } = await supabase.from('client_profiles').select('id').eq('user_id', user.id).maybeSingle()
      if (!cp) {
        setClientStockByProductId({})
        return
      }
      const { data } = await supabase.from('client_stocks').select('product_id, current_stock').eq('company_id', cp.id)
      const m: Record<string, number> = {}
      for (const r of data ?? []) m[r.product_id as string] = r.current_stock as number
      setClientStockByProductId(m)
    }
    void loadClientStock()
  }, [user])

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const [{ data: prods }, { data: cats }, { data: subs }] = await Promise.all([
        supabase
          .from('products')
          .select('*, category:categories(*), subcategory:subcategories(*), variants:product_variants(*)')
          .order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('subcategories').select('*').order('name'),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
      setSubcategories(subs ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!sidebarStock && !sidebarRupture) {
      setAvailability('all')
      return
    }
    if (sidebarStock && !sidebarRupture) setAvailability('instock')
    else if (!sidebarStock && sidebarRupture) setAvailability('out')
    else setAvailability('all')
  }, [sidebarStock, sidebarRupture])

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1)
  }, [search, selectedCategory, selectedSubcategory, brandFilter, availability, sort])

  const brands = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) {
      if (p.brand?.trim()) s.add(p.brand.trim())
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [products])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
    }
    return m
  }, [products])

  const filteredSubs = useMemo(() => {
    if (selectedCategory === 'all') return subcategories
    return subcategories.filter(s => s.category_id === selectedCategory)
  }, [selectedCategory, subcategories])

  const filtered = useMemo(() => {
    let list = [...products]

    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(p => {
        const brand = (p.brand ?? '').toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          brand.includes(q) ||
          (p.subcategory?.name?.toLowerCase().includes(q) ?? false) ||
          (p.category?.name?.toLowerCase().includes(q) ?? false)
        )
      })
    }

    if (selectedCategory !== 'all') {
      list = list.filter(p => p.category_id === selectedCategory)
    }
    if (selectedSubcategory !== 'all') {
      list = list.filter(p => p.subcategory_id === selectedSubcategory)
    }
    if (brandFilter !== 'all') {
      list = list.filter(p => (p.brand ?? '').trim() === brandFilter)
    }
    if (availability === 'instock') {
      list = list.filter(productInStock)
    } else if (availability === 'out') {
      list = list.filter(p => !productInStock(p))
    }

    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price)
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else list.sort((a, b) => a.name.localeCompare(b.name))

    return list
  }, [products, search, selectedCategory, selectedSubcategory, brandFilter, availability, sort])

  // ─── Pagination derived values ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  function goToPage(p: number) {
    const target = Math.max(1, Math.min(p, totalPages))
    setPage(target)
    // Scroll grid into view on page change
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const hasFilters =
    selectedCategory !== 'all' ||
    selectedSubcategory !== 'all' ||
    search !== '' ||
    brandFilter !== 'all' ||
    availability !== 'all'

  function clearFilters() {
    setSearch('')
    setSelectedCategory('all')
    setSelectedSubcategory('all')
    setBrandFilter('all')
    setAvailability('all')
    setSidebarStock(false)
    setSidebarRupture(false)
  }

  return (
    <div className="space-y-2">
      <div className="pb-0.5">
        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-livex-navy leading-none">
          Catalogue produits
        </h1>
        <p className="text-[11px] text-slate-600 mt-1 leading-snug max-w-xl font-medium">
          Fournitures professionnelles, tarifs TTC, livraison et support dédiés.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 items-start">
        <aside className="w-full lg:w-[196px] shrink-0 lg:sticky lg:top-20">
          <div className="livex-card-surface p-2">
            <p className="livex-catalog-sidebar-title">Catégories</p>
            <ul className="space-y-0 divide-y divide-slate-100/90">
              <li className="py-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all')
                    setSelectedSubcategory('all')
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-1.5 rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-colors',
                    selectedCategory === 'all'
                      ? 'bg-orange-500/12 text-orange-800 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 font-medium'
                  )}
                >
                  <span className="line-clamp-2 min-w-0">Toutes</span>
                  <span className="text-[10px] tabular-nums text-slate-500 shrink-0 font-bold w-7 text-right">
                    {products.length}
                  </span>
                </button>
              </li>
              {categories.map(c => {
                const count = categoryCounts.get(c.id) ?? 0
                const active = selectedCategory === c.id
                return (
                  <li key={c.id} className="py-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(c.id)
                        setSelectedSubcategory('all')
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-1.5 rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-colors',
                        active
                          ? 'bg-orange-500/12 text-orange-800 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 font-medium'
                      )}
                    >
                      <span className="line-clamp-2 min-w-0">{c.name}</span>
                      <span className="text-[10px] tabular-nums shrink-0 text-slate-500 w-7 text-right font-bold">
                        {count}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {selectedCategory !== 'all' && filteredSubs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1.5 mb-1">
                  Sous-catégories
                </p>
                <ul className="space-y-0">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedSubcategory('all')}
                      className={cn(
                        'w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight transition-colors font-medium',
                        selectedSubcategory === 'all'
                          ? 'bg-orange-500/12 text-orange-800 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      Toutes
                    </button>
                  </li>
                  {filteredSubs.map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSubcategory(s.id)}
                        className={cn(
                          'w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight transition-colors font-medium',
                          selectedSubcategory === s.id
                            ? 'bg-orange-500/12 text-orange-800 font-bold'
                            : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="livex-card-surface p-2 mt-2">
            <p className="livex-catalog-sidebar-title">Filtres</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Disponibilité</p>
            <label className="flex items-center gap-1.5 py-0.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={sidebarStock}
                onChange={e => setSidebarStock(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 focus:ring-offset-0"
              />
              <span className="text-[11px] leading-tight text-slate-600 group-hover:text-livex-navy font-medium">
                En stock
              </span>
            </label>
            <label className="flex items-center gap-1.5 py-0.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={sidebarRupture}
                onChange={e => setSidebarRupture(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30 focus:ring-offset-0"
              />
              <span className="text-[11px] leading-tight text-slate-600 group-hover:text-livex-navy font-medium">
                Rupture
              </span>
            </label>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="livex-card-surface p-1.5 sm:p-2">
            <div className="flex flex-col xl:flex-row xl:items-end gap-1.5 min-w-0">
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-7 pl-8 text-[11px] leading-tight border-slate-300/90 bg-white rounded-md font-medium placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap xl:flex-nowrap items-end gap-2 min-w-0 xl:justify-end">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-600 leading-none">Catégorie</span>
                  <select
                    value={selectedCategory}
                    onChange={e => {
                      setSelectedCategory(e.target.value)
                      setSelectedSubcategory('all')
                    }}
                    className={cn(filterSelect, 'w-[118px] sm:w-[128px]')}
                  >
                    <option value="all">Toutes catégories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {selectedCategory !== 'all' && filteredSubs.length > 0 && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <span className="text-[10px] font-semibold text-slate-600 leading-none">Sous-catégorie</span>
                    <select
                      value={selectedSubcategory}
                      onChange={e => setSelectedSubcategory(e.target.value)}
                      className={cn(filterSelect, 'w-[128px]')}
                    >
                      <option value="all">Toutes</option>
                      {filteredSubs.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-0.5 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-600 leading-none">Marque</span>
                  <select
                    value={brandFilter}
                    onChange={e => setBrandFilter(e.target.value)}
                    className={cn(filterSelect, 'w-[108px] sm:w-[118px]')}
                  >
                    <option value="all">Toutes marques</option>
                    {brands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-600 leading-none">Disponibilité</span>
                  <select
                    value={availability}
                    onChange={e => {
                      const val = e.target.value as AvailabilityFilter
                      setAvailability(val)
                      if (val === 'all') { setSidebarStock(false); setSidebarRupture(false) }
                      else if (val === 'instock') { setSidebarStock(true); setSidebarRupture(false) }
                      else if (val === 'out') { setSidebarStock(false); setSidebarRupture(true) }
                    }}
                    className={cn(filterSelect, 'w-[112px]')}
                  >
                    <option value="all">Tous</option>
                    <option value="instock">En stock</option>
                    <option value="out">Rupture</option>
                  </select>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="text-[10px] text-slate-500 font-semibold hidden lg:inline mr-0.5">Tri</span>
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortKey)}
                    className={cn(filterSelect, 'w-[108px]')}
                  >
                    <option value="relevance">Pertinence</option>
                    <option value="name">Nom A-Z</option>
                    <option value="price-asc">Prix (croissant)</option>
                    <option value="price-desc">Prix (décroissant)</option>
                  </select>
                </div>

                <div className="flex rounded border border-slate-300/90 p-px bg-slate-100/80 shrink-0 ml-auto xl:ml-0">
                  <button
                    type="button"
                    onClick={() => setView('grid')}
                    className={cn(
                      'p-1 rounded-sm transition-colors',
                      view === 'grid'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-700'
                    )}
                    aria-label="Grille"
                  >
                    <LayoutGrid className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={cn(
                      'p-1 rounded-sm transition-colors',
                      view === 'list'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-700'
                    )}
                    aria-label="Liste"
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {!loading && (
              <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                <span>
                  <span className="font-bold text-livex-navy tabular-nums">{filtered.length}</span>{' '}
                  résultat{filtered.length !== 1 ? 's' : ''}
                </span>
                {hasFilters && (
                  <button
                    type="button"
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700"
                    onClick={clearFilters}
                  >
                    Réinitialiser
                  </button>
                )}
              </p>
            )}
          </div>

          {/* Scroll anchor sits just above the grid */}
          <div ref={gridTopRef} className="scroll-mt-20" />

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="h-[280px] rounded-xl border border-slate-200/80" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="livex-card-surface py-10 text-center border-dashed border-slate-300">
              <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 flex items-center justify-center mb-2 border border-slate-200">
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-livex-navy">Aucun produit trouvé</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto leading-snug font-medium">
                {products.length === 0
                  ? 'Aucun produit disponible pour le moment.'
                  : 'Affinez filtres ou recherche.'}
              </p>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-[11px] border-slate-300 font-bold text-orange-700 hover:bg-orange-50"
                  onClick={clearFilters}
                >
                  Réinitialiser
                </Button>
              )}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  view === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 items-stretch'
                    : 'flex flex-col gap-2'
                )}
              >
                {paginated.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    layout={view}
                    clientStockQty={
                      product.id in clientStockByProductId ? clientStockByProductId[product.id] : undefined
                    }
                  />
                ))}
              </div>

              <CatalogPagination
                page={safePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
