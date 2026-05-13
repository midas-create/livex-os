import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProductDetailView } from '@/components/products/ProductDetailView'

interface PageProps {
  params: { id: string }
}

export default async function ProductPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: product, error } = await supabase
    .from('products')
    .select('*, category:categories(*), subcategory:subcategories(*), variants:product_variants(*)')
    .eq('id', params.id)
    .single()

  if (error || !product) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Chargement…</div>}>
      <ProductDetailView product={product} />
    </Suspense>
  )
}
