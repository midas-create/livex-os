import { Suspense } from 'react'
import { ProductCatalog } from '@/components/products/ProductCatalog'
import { Skeleton } from '@/components/ui/skeleton'

function CatalogFallback() {
  return (
    <div className="space-y-2">
      <div className="livex-card-surface p-2">
        <Skeleton className="h-5 w-48 mb-1" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[280px] rounded-xl border border-slate-200/80" />
        ))}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <ProductCatalog />
    </Suspense>
  )
}
