'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Category, Subcategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { FormSelect } from '@/components/ui/form-select'
import {
  Search, Plus, Pencil, AlertTriangle, Package, TrendingUp, Upload, X, ImageIcon, Loader2,
} from 'lucide-react'
import { formatAr } from '@/lib/utils'
import { toast } from 'sonner'

interface ProductForm {
  name: string
  category_id: string
  subcategory_id: string
  brand: string
  purchase_price: string
  price: string
  stock_quantity: string
  image_url: string
}

const emptyForm: ProductForm = {
  name: '', category_id: '', subcategory_id: '',
  brand: '', purchase_price: '', price: '', stock_quantity: '', image_url: '',
}

interface VariantDraft {
  tempKey: string
  color: string
  stock_quantity: string
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [filteredSubs, setFilteredSubs] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null)
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([])

  async function fetchData() {
    const supabase = createClient()
    const [{ data: prods }, { data: cats }, { data: subs }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), subcategory:subcategories(*), variants:product_variants(*)').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*').order('name'),
    ])
    setProducts(prods ?? [])
    setCategories(cats ?? [])
    setSubcategories(subs ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (form.category_id) {
      setFilteredSubs(subcategories.filter(s => s.category_id === form.category_id))
    } else {
      setFilteredSubs(subcategories)
    }
  }, [form.category_id, subcategories])

  function openCreate() {
    setEditingProduct(null)
    setForm(emptyForm)
    setVariantRows([])
    setImageFile(null)
    setImagePreview('')
    setModalOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setForm({
      name: product.name,
      category_id: product.category_id,
      subcategory_id: product.subcategory_id ?? '',
      brand: product.brand ?? '',
      purchase_price: product.purchase_price?.toString() ?? '0',
      price: product.price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      image_url: product.image_url ?? '',
    })
    setImageFile(null)
    setImagePreview(product.image_url ?? '')
    const vars = product.variants ?? []
    setVariantRows(
      vars.map(v => ({
        tempKey: v.id,
        color: v.color,
        stock_quantity: String(v.stock_quantity),
      }))
    )
    setModalOpen(true)
  }

  function addVariantRow() {
    setVariantRows(rows => [...rows, { tempKey: `new-${Date.now()}`, color: '', stock_quantity: '0' }])
  }

  function updateVariantRow(tempKey: string, field: 'color' | 'stock_quantity', value: string) {
    setVariantRows(rows => rows.map(r => (r.tempKey === tempKey ? { ...r, [field]: value } : r)))
  }

  function removeVariantRow(tempKey: string) {
    setVariantRows(rows => rows.filter(r => r.tempKey !== tempKey))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 Mo)'); return }
    if (!file.type.startsWith('image/')) { toast.error('Fichier non valide — image uniquement'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    console.log('[IMAGE] File selected:', file.name, file.type, file.size, 'bytes')
  }

  // Standalone upload test — isolates storage issues from form submission
  async function testUpload() {
    if (!imageFile) { toast.error('Sélectionnez d\'abord une image'); return }
    setUploadingImage(true)

    try {
      const supabase = createClient()
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `products/${fileName}`

      console.log('UPLOAD PATH:', filePath)

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile, { contentType: imageFile.type })

      if (error) {
        console.error('[TEST UPLOAD] Failed:', error.message, error)
        toast.error(`Test upload échoué: ${error.message}`)
        return
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath)
      console.log('PUBLIC URL:', data.publicUrl)
      toast.success(`Test OK ! ${data.publicUrl}`)
    } catch (e: unknown) {
      console.error('[TEST UPLOAD] Exception:', e)
      toast.error('Exception: ' + String(e))
    } finally {
      setUploadingImage(false)
    }
  }

  // Upload a file to Supabase Storage and return the public URL
  // Takes the file as an explicit parameter to avoid stale-closure issues
  async function uploadToStorage(file: File): Promise<string | null> {
    const supabase = createClient()

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `products/${fileName}`

    console.log('UPLOAD PATH:', filePath)
    console.log('[UPLOAD] type:', file.type, '| size:', file.size, 'bytes')

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { contentType: file.type })

    if (uploadError) {
      console.error('[UPLOAD] Failed:', uploadError.message, uploadError)
      toast.error(`Erreur upload: ${uploadError.message}`)
      return null
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    console.log('PUBLIC URL:', data.publicUrl)
    return data.publicUrl
  }

  async function handleSave() {
    if (!form.name || !form.category_id || !form.price) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    setSaving(true)

    // Capture the file reference NOW (avoid stale state in async chain)
    const fileToUpload = imageFile

    console.log('[SAVE] Starting. Has image file:', !!fileToUpload, fileToUpload?.name)

    const supabase = createClient()

    const basePayload = {
      name: form.name.trim(),
      category_id: form.category_id,
      subcategory_id: form.subcategory_id || null,
      brand: form.brand.trim() || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      price: parseFloat(form.price),
      stock_quantity: parseInt(form.stock_quantity) || 0,
    }

    let productId = editingProduct?.id

    if (editingProduct) {
      const { error } = await supabase.from('products').update(basePayload).eq('id', editingProduct.id)
      if (error) {
        console.error('[SAVE] Product update error:', error)
        toast.error('Erreur lors de la sauvegarde: ' + error.message)
        setSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase.from('products').insert(basePayload).select().single()
      if (error || !data) {
        console.error('[SAVE] Product insert error:', error)
        toast.error('Erreur lors de la création: ' + (error?.message ?? 'données manquantes'))
        setSaving(false)
        return
      }
      productId = data.id
      console.log('[SAVE] Product created with id:', productId)
    }

    // Upload image and update image_url
    if (productId && fileToUpload) {
      console.log('[SAVE] Uploading image for product:', productId)
      setUploadingImage(true)
      const imageUrl = await uploadToStorage(fileToUpload)
      setUploadingImage(false)

      if (!imageUrl) {
        // Upload failed — product was saved but without image
        toast.error('Produit créé mais l\'image n\'a pas pu être uploadée. Vérifiez la console.')
        setSaving(false)
        fetchData()
        return
      }

      const { error: imgErr } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', productId)

      if (imgErr) {
        console.error('[SAVE] image_url update error:', imgErr)
        toast.error('Image uploadée mais non sauvegardée en base: ' + imgErr.message)
      } else {
        console.log('[SAVE] image_url saved successfully:', imageUrl)
      }
    }

    // Sync color variants (optional). Aggregate stock on product when variants exist.
    if (productId) {
      const cleaned = variantRows.filter(r => r.color.trim() !== '')
      await supabase.from('product_variants').delete().eq('product_id', productId)
      if (cleaned.length > 0) {
        const seen = new Set<string>()
        const deduped = cleaned.filter(r => {
          const k = r.color.trim().toLowerCase()
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        const inserts = deduped.map(r => ({
          product_id: productId,
          color: r.color.trim(),
          stock_quantity: Math.max(0, parseInt(r.stock_quantity, 10) || 0),
        }))
        const { error: vErr } = await supabase.from('product_variants').insert(inserts)
        if (vErr) {
          console.error('[SAVE] variants error:', vErr)
          toast.error('Variantes : ' + vErr.message)
        } else {
          const sumStock = inserts.reduce((s, r) => s + r.stock_quantity, 0)
          await supabase.from('products').update({ stock_quantity: sumStock }).eq('id', productId)
        }
      }
    }

    toast.success(editingProduct ? 'Produit mis à jour' : 'Produit créé')
    setModalOpen(false)
    fetchData()
    setSaving(false)
  }

  async function updateStock(productId: string, newStock: number) {
    const supabase = createClient()
    await supabase.from('products').update({ stock_quantity: newStock }).eq('id', productId)
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p))
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const marginCalc = (p: Product) => {
    if (!p.purchase_price || p.purchase_price === 0) return null
    return ((p.price - p.purchase_price) / p.price) * 100
  }

  const liveMargin = form.purchase_price && form.price && parseFloat(form.purchase_price) > 0
    ? ((parseFloat(form.price) - parseFloat(form.purchase_price)) / parseFloat(form.price)) * 100
    : null

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Produits</h1>
            <p className="text-slate-500 text-sm mt-0.5">Gérer le catalogue, les prix, les marges et les images</p>
          </div>
          <Button onClick={openCreate} className="bg-slate-900 hover:bg-slate-800 text-white gap-2 h-9 text-sm">
            <Plus className="w-4 h-4" />
            Nouveau produit
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher un produit ou une marque..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Aucun produit trouvé</p>
              <p className="text-slate-400 text-xs mt-1">Ajoutez votre premier produit pour commencer</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Px achat</TableHead>
                  <TableHead className="text-right">Px vente</TableHead>
                  <TableHead className="text-center">Marge</TableHead>
                  <TableHead className="text-center">Variantes</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-right w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(product => {
                  const margin = marginCalc(product)
                  const vCount = product.variants?.length ?? 0
                  const totalStock = vCount > 0
                    ? (product.variants ?? []).reduce((s, v) => s + v.stock_quantity, 0)
                    : product.stock_quantity
                  const isLow = totalStock > 0 && totalStock <= 5
                  const isOut = totalStock === 0
                  return (
                    <TableRow key={product.id}>
                      {/* Thumbnail — clickable to zoom */}
                      <TableCell className="w-16 py-2">
                        <div
                          className={`w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200 ${product.image_url?.startsWith('https://') ? 'cursor-zoom-in hover:ring-2 hover:ring-blue-400 transition-all' : ''}`}
                          onClick={() => {
                            if (product.image_url?.startsWith('https://')) {
                              setZoomImage({ url: product.image_url, name: product.name })
                            }
                          }}
                        >
                          {product.image_url?.startsWith('https://') ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900 text-sm">{product.name}</p>
                        {product.brand && (
                          <p className="text-xs text-slate-400">{product.brand}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-700">{product.category?.name}</p>
                        {product.subcategory && (
                          <p className="text-xs text-slate-400">{product.subcategory.name}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {formatAr(product.purchase_price || 0)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900 text-sm">
                        {formatAr(product.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {margin !== null ? (
                          <span className={`text-xs font-semibold flex items-center justify-center gap-0.5 ${
                            margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            <TrendingUp className="w-3 h-3" />
                            {margin.toFixed(1)}%
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600">
                        {vCount > 0 ? (
                          <span>{vCount} couleur{vCount > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <Input
                              type="number" min={0}
                              value={vCount > 0 ? totalStock : product.stock_quantity}
                              onChange={e => !vCount && updateStock(product.id, parseInt(e.target.value, 10) || 0)}
                              disabled={vCount > 0}
                              title={vCount > 0 ? 'Stock agrégé des couleurs — modifier via Éditer' : undefined}
                              className="w-16 h-7 text-sm border-slate-200 text-center disabled:bg-slate-50 disabled:text-slate-600"
                            />
                            {isOut && <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">Épuisé</Badge>}
                            {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          {vCount > 0 && (
                            <span className="text-[10px] text-slate-400">Σ {totalStock}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(product)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Modal produit ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 pb-3 pt-6 pr-14">
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-4">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Image du produit</Label>
              <div className="flex gap-3 items-start">
                <div className={`w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors ${
                  imagePreview ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}>
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-300">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-[10px]">Aperçu</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm text-slate-700 font-medium">
                      <Upload className="w-4 h-4" />
                      {imageFile ? imageFile.name : 'Choisir une image'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>
                  <p className="text-xs text-slate-400">JPG, PNG, WebP — max 5 Mo</p>
                  {(imagePreview || form.image_url) && (
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(''); setForm(f => ({ ...f, image_url: '' })) }}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" /> Supprimer l&apos;image
                    </button>
                  )}
                  {/* Standalone test button — helps isolate storage vs form issues */}
                  {imageFile && (
                    <button
                      type="button"
                      onClick={testUpload}
                      disabled={uploadingImage}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Tester l&apos;upload seul
                    </button>
                  )}
                  {form.image_url && !imageFile && (
                    <p className="text-xs text-slate-400 truncate">Existante: {form.image_url.split('/').pop()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Name + Brand */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom du produit *</Label>
                <Input
                  placeholder="ex. Ramette A4 80g — 500 feuilles"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Marque *</Label>
                <Input
                  placeholder="ex. Hammermill, HP, Pilot..."
                  value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stock initial</Label>
                <Input
                  type="number" min={0} placeholder="0"
                  value={form.stock_quantity}
                  onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                />
              </div>
            </div>

            {/* Category + Subcategory — uses FormSelect (works inside @base-ui Dialog) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Catégorie *</Label>
                <FormSelect
                  value={form.category_id}
                  onValueChange={v => setForm(f => ({ ...f, category_id: v, subcategory_id: '' }))}
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Choisir une catégorie..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sous-catégorie</Label>
                <FormSelect
                  value={form.subcategory_id}
                  onValueChange={v => setForm(f => ({ ...f, subcategory_id: v }))}
                  options={filteredSubs.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Choisir..."
                  disabled={!form.category_id || filteredSubs.length === 0}
                />
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prix d&apos;achat (Ar)</Label>
                <div className="relative">
                  <Input
                    type="number" min={0} placeholder="0" step={100}
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Ar</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Prix de vente (Ar) *</Label>
                <div className="relative">
                  <Input
                    type="number" min={0} placeholder="0" step={100}
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Ar</span>
                </div>
              </div>
            </div>

            {/* Couleurs / variantes */}
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/80">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-slate-700">Couleurs disponibles</Label>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={addVariantRow}>
                  <Plus className="w-3 h-3 mr-1" /> Ajouter
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Avec des couleurs, le stock total produit = somme des stocks par couleur (le champ « Stock initial » ci-dessus est alors ignoré à l&apos;enregistrement).
              </p>
              {variantRows.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune variante — stock géré au niveau produit uniquement.</p>
              ) : (
                <div className="space-y-2">
                  {variantRows.map(row => (
                    <div key={row.tempKey} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-medium">Couleur</span>
                        <Input
                          value={row.color}
                          placeholder="ex. Bleu"
                          onChange={e => updateVariantRow(row.tempKey, 'color', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-medium">Stock</span>
                        <Input
                          type="number"
                          min={0}
                          value={row.stock_quantity}
                          onChange={e => updateVariantRow(row.tempKey, 'stock_quantity', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
                        onClick={() => removeVariantRow(row.tempKey)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live margin */}
            {liveMargin !== null && (
              <div className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between ${
                liveMargin >= 20 ? 'bg-green-50' : liveMargin >= 10 ? 'bg-amber-50' : 'bg-red-50'
              }`}>
                <span className="text-slate-600">Marge calculée</span>
                <strong className={liveMargin >= 20 ? 'text-green-700' : liveMargin >= 10 ? 'text-amber-700' : 'text-red-700'}>
                  {liveMargin.toFixed(1)}%
                </strong>
              </div>
            )}
          </div>

          <DialogFooter className="!mx-0 !mb-0 mt-0 shrink-0">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving || uploadingImage}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploadingImage}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {(saving || uploadingImage)
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploadingImage ? 'Upload...' : 'Sauvegarde...'}</>
                : editingProduct ? 'Mettre à jour' : 'Créer le produit'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Zoom Modal ── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center bg-slate-50 p-8 min-h-[50vh]">
              <img
                src={zoomImage.url}
                alt={zoomImage.name}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="font-semibold text-slate-900 text-sm">{zoomImage.name}</p>
              <button
                onClick={() => setZoomImage(null)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
