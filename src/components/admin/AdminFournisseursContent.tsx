'use client'

/**
 * Fournisseurs — structured supplier entity management.
 * Requires SQL migration schema-v16-suppliers.sql to be executed first.
 * Once migration is applied, this component becomes fully functional.
 */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Supplier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Building2, Plus, Phone, Mail, MapPin, FileText,
  Pencil, Loader2, AlertCircle, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

type SupplierForm = {
  name: string
  phone: string
  email: string
  address: string
  nif: string
  contact: string
  payment_terms_days: number
  notes: string
}

const emptyForm = (): SupplierForm => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  nif: '',
  contact: '',
  payment_terms_days: 0,
  notes: '',
})

export function AdminFournisseursContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationReady, setMigrationReady] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) {
      // Migration not yet applied
      if (error.code === '42P01') {
        setMigrationReady(false)
      } else {
        toast.error('Erreur de chargement des fournisseurs')
      }
      setLoading(false)
      return
    }

    setMigrationReady(true)
    setSuppliers((data ?? []) as Supplier[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier)
    setForm({
      name:               supplier.name,
      phone:              supplier.phone    ?? '',
      email:              supplier.email    ?? '',
      address:            supplier.address  ?? '',
      nif:                supplier.nif      ?? '',
      contact:            supplier.contact  ?? '',
      payment_terms_days: supplier.payment_terms_days ?? 0,
      notes:              supplier.notes    ?? '',
    })
    setFormOpen(true)
  }

  async function saveSupplier() {
    if (!form.name.trim()) { toast.error('Le nom du fournisseur est requis'); return }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      nif: form.nif.trim() || null,
      contact: form.contact.trim() || null,
      payment_terms_days: Number(form.payment_terms_days) || 0,
      notes: form.notes.trim() || null,
    }

    if (editing) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erreur mise à jour : ' + error.message); setSaving(false); return }
      toast.success('Fournisseur mis à jour')
    } else {
      const { error } = await supabase.from('suppliers').insert(payload)
      if (error) { toast.error('Erreur création : ' + error.message); setSaving(false); return }
      toast.success('Fournisseur créé')
    }

    setSaving(false)
    setFormOpen(false)
    fetchSuppliers()
  }

  function field(key: keyof SupplierForm, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!migrationReady) {
    return (
      <div className="space-y-3">
        <div className="saas-surface p-3">
          <h1 className="text-xl font-semibold text-slate-900">Fournisseurs</h1>
          <p className="text-sm text-slate-600 mt-0.5">Gestion des fournisseurs structurés</p>
        </div>
        <div className="saas-surface p-8 text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-2">Migration SQL requise</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            La table <code className="bg-slate-100 px-1 rounded font-mono text-xs">suppliers</code> n&apos;existe pas encore.
            Veuillez exécuter le fichier <strong>supabase/schema-v16-suppliers.sql</strong> dans votre projet Supabase, puis rechargez la page.
          </p>
          <Button className="mt-5 bg-orange-500 hover:bg-orange-600 text-white" onClick={fetchSuppliers}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header */}
        <div className="saas-surface p-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Fournisseurs</h1>
            <p className="text-sm text-slate-600 mt-0.5">{suppliers.length} fournisseur{suppliers.length !== 1 ? 's' : ''} enregistré{suppliers.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau fournisseur
          </Button>
        </div>

        {/* Grid */}
        {suppliers.length === 0 ? (
          <div className="saas-surface py-16 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
              <Building2 className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Aucun fournisseur enregistré</p>
            <p className="text-xs text-slate-400 mt-1">Ajoutez vos fournisseurs pour les associer aux achats.</p>
            <Button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 text-sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Créer le premier fournisseur
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map(s => (
              <div key={s.id} className="saas-surface p-4 group hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center shrink-0 border border-orange-100">
                      <Building2 className="w-4.5 h-4.5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                      {s.nif && <p className="text-[10px] text-slate-400 font-mono">NIF : {s.nif}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(s)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-orange-500 hover:bg-orange-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {s.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      {s.phone}
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </div>
                  )}
                  {s.contact && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      Contact : {s.contact}
                    </div>
                  )}
                  {(s.payment_terms_days ?? 0) > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <Clock className="w-3 h-3 shrink-0" />
                      Délai paiement : {s.payment_terms_days} jours
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <Dialog open={formOpen} onOpenChange={open => { if (!open) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              {editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nom du fournisseur *</Label>
                <Input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Ex : Bureau Pro SARL" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => field('phone', e.target.value)} placeholder="+261 XX XXX XXX" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="contact@fournisseur.mg" className="h-8" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={e => field('address', e.target.value)} placeholder="Adresse complète" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>NIF</Label>
                <Input value={form.nif} onChange={e => field('nif', e.target.value)} placeholder="NIF fournisseur" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact principal</Label>
                <Input value={form.contact} onChange={e => field('contact', e.target.value)} placeholder="Nom du responsable" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Délai de paiement (jours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.payment_terms_days}
                  onChange={e => field('payment_terms_days', Number(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observations</Label>
                <Input value={form.notes} onChange={e => field('notes', e.target.value)} placeholder="Notes internes, conditions particulières..." className="h-8" />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Annuler</Button>
            <Button
              onClick={saveSupplier}
              disabled={saving || !form.name.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : editing ? 'Mettre à jour' : 'Créer le fournisseur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
