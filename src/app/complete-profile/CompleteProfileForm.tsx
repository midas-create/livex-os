'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Package, Building2, Phone, User, MapPin, Navigation } from 'lucide-react'
import { DepartmentsEditor, normalizeDepartmentsInput } from '@/components/client/DepartmentsEditor'

type FieldErrors = Partial<Record<
  | 'company_name'
  | 'phone'
  | 'email'
  | 'manager_name'
  | 'address'
  | 'gps'
  | 'departments'
  | 'root',
  string
>>

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-6 h-6 rounded-md bg-orange-50 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-orange-500" />
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

function OptionalBadge() {
  return (
    <span className="ml-1.5 inline-block text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
      Optionnel
    </span>
  )
}

function RecommendedBadge() {
  return (
    <span className="ml-1.5 inline-block text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
      Recommandé
    </span>
  )
}

export function CompleteProfileForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // ── Section 1 — Société ──────────────────────────────────────────────────
  const [company_name, setCompanyName]   = useState('')
  const [nif, setNif]                    = useState('')
  const [stat, setStat]                  = useState('')
  const [rcs, setRcs]                    = useState('')

  // ── Section 2 — Téléphone & e-mail société ──────────────────────────────
  const [phone, setPhone]                = useState('')
  const [whatsapp, setWhatsapp]          = useState('')
  const [email, setEmail]                = useState(defaultEmail)

  // ── Section 3 — Contact principal ───────────────────────────────────────
  const [manager_name, setManagerName]   = useState('')
  const [contact_position, setContactPosition] = useState('')
  const [contact_phone, setContactPhone]       = useState('')
  const [contact_whatsapp, setContactWhatsapp] = useState('')
  const [contact_email, setContactEmail]       = useState('')

  // ── Section 4 — Adresse ─────────────────────────────────────────────────
  const [address, setAddress]                  = useState('')
  const [region, setRegion]                    = useState('')
  const [delivery_address, setDeliveryAddress] = useState('')
  const [delivery_notes, setDeliveryNotes]     = useState('')

  // ── Section 5 — Départements ────────────────────────────────────────────
  const [departments, setDepartments]    = useState<string[]>([''])

  // ── Section 6 — GPS ─────────────────────────────────────────────────────
  const [gps_lat, setGpsLat]             = useState('')
  const [gps_lng, setGpsLng]             = useState('')

  function clearField(key: keyof FieldErrors) {
    setFieldErrors(f => (f[key] ? { ...f, [key]: undefined } : f))
  }

  function validate(): boolean {
    const e: FieldErrors = {}

    if (!company_name.trim()) e.company_name = 'Le nom de la société est requis.'
    if (!phone.trim())        e.phone        = 'Le numéro de téléphone est requis.'
    if (!email.trim())        e.email        = "L'e-mail est requis."
    if (!manager_name.trim()) e.manager_name = 'Le nom du responsable est requis.'
    if (!address.trim())      e.address      = "L'adresse est requise."

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Adresse e-mail invalide.'
    }

    const latS = gps_lat.trim()
    const lngS = gps_lng.trim()
    if (latS || lngS) {
      const lat = Number(latS.replace(',', '.'))
      const lng = Number(lngS.replace(',', '.'))
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        e.gps = 'Latitude et longitude doivent être des nombres valides, ou laissez les deux champs vides.'
      }
    }

    const deptsNorm = normalizeDepartmentsInput(departments)
    if (deptsNorm.length === 0) {
      e.departments = 'Ajoutez au moins un département (ex. Comptabilité, Achats).'
    }

    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Session expirée. Reconnectez-vous.')
      setLoading(false)
      router.push('/login')
      return
    }

    const latS = gps_lat.trim()
    const lngS = gps_lng.trim()
    let gpsLat: number | null = null
    let gpsLng: number | null = null
    if (latS && lngS) {
      gpsLat = Number(latS.replace(',', '.'))
      gpsLng = Number(lngS.replace(',', '.'))
    }

    const deptsNorm = normalizeDepartmentsInput(departments)

    const row = {
      user_id:           user.id,
      company_name:      company_name.trim(),
      nif:               nif.trim(),
      stat:              stat.trim(),
      rcs:               rcs.trim(),
      phone:             phone.trim(),
      whatsapp:          whatsapp.trim() || null,
      email:             email.trim(),
      manager_name:      manager_name.trim(),
      contact_position:  contact_position.trim() || null,
      contact_phone:     contact_phone.trim() || null,
      contact_whatsapp:  contact_whatsapp.trim() || null,
      contact_email:     contact_email.trim() || null,
      address:           address.trim(),
      region:            region.trim() || null,
      delivery_address:  delivery_address.trim() || null,
      delivery_notes:    delivery_notes.trim() || null,
      gps_lat:           gpsLat,
      gps_lng:           gpsLng,
      departments:       deptsNorm,
      profile_completed: true,
    }

    const { error: upsertErr } = await supabase
      .from('client_profiles')
      .upsert(row, { onConflict: 'user_id' })

    if (upsertErr) {
      toast.error(upsertErr.message)
      setLoading(false)
      return
    }

    const { error: userErr } = await supabase
      .from('users')
      .update({ company_name: row.company_name })
      .eq('id', user.id)

    if (userErr) {
      toast.error('Profil enregistré mais mise à jour du compte impossible : ' + userErr.message)
      setLoading(false)
      return
    }

    toast.success('Profil enregistré.')
    window.location.href = '/products'
  }

  const inp =
    'h-9 rounded-md border-slate-200 bg-slate-50 placeholder:text-slate-400 focus-visible:border-orange-400 focus-visible:ring-orange-200/60'
  const errText = (msg: string | undefined) =>
    msg ? <p className="text-sm text-red-600 mt-1">{msg}</p> : null

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-[640px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0F172A] to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">LiveX Supply</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Complétez votre fiche société</p>
          </div>
        </div>

        <div className="saas-surface rounded-2xl p-5 sm:p-7">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Profil entreprise</h2>
            <p className="text-slate-500 text-sm mt-1">
              Ces informations sont utilisées pour vos commandes, bons de livraison et factures.
              Les champs marqués <span className="text-red-500 font-semibold">*</span> sont obligatoires.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* ── 1. Société ──────────────────────────────────────────────── */}
            <SectionTitle icon={Building2} label="Société" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-company">Raison sociale *</Label>
                <Input
                  id="cp-company"
                  value={company_name}
                  onChange={e => { setCompanyName(e.target.value); clearField('company_name') }}
                  placeholder="Ex : Bureau Pro SARL"
                  className={inp}
                  aria-invalid={!!fieldErrors.company_name}
                />
                {errText(fieldErrors.company_name)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-nif">NIF <RecommendedBadge /></Label>
                <Input id="cp-nif" value={nif} onChange={e => setNif(e.target.value)} placeholder="Ex : 1234567" className={inp} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-stat">STAT <RecommendedBadge /></Label>
                <Input id="cp-stat" value={stat} onChange={e => setStat(e.target.value)} placeholder="Ex : 52000 11 2019 0 00234" className={inp} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-rcs">RCS <RecommendedBadge /></Label>
                <Input id="cp-rcs" value={rcs} onChange={e => setRcs(e.target.value)} placeholder="Ex : RCS Antananarivo 2019 B 00234" className={inp} />
              </div>
            </div>

            {/* ── 2. Téléphone & e-mail société ───────────────────────────── */}
            <SectionTitle icon={Phone} label="Téléphone & e-mail société" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cp-phone">Téléphone *</Label>
                <Input
                  id="cp-phone"
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); clearField('phone') }}
                  placeholder="+261 34 00 000 00"
                  className={inp}
                  aria-invalid={!!fieldErrors.phone}
                />
                {errText(fieldErrors.phone)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-whatsapp">WhatsApp société <OptionalBadge /></Label>
                <Input
                  id="cp-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+261 34 00 000 00"
                  className={inp}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-email">E-mail société *</Label>
                <Input
                  id="cp-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearField('email') }}
                  placeholder="commandes@entreprise.mg"
                  className={inp}
                  aria-invalid={!!fieldErrors.email}
                />
                {errText(fieldErrors.email)}
              </div>
            </div>

            {/* ── 3. Contact principal ────────────────────────────────────── */}
            <SectionTitle icon={User} label="Contact principal" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cp-manager">Nom du responsable *</Label>
                <Input
                  id="cp-manager"
                  value={manager_name}
                  onChange={e => { setManagerName(e.target.value); clearField('manager_name') }}
                  placeholder="Prénom Nom"
                  className={inp}
                  aria-invalid={!!fieldErrors.manager_name}
                />
                {errText(fieldErrors.manager_name)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-position">Poste / titre <OptionalBadge /></Label>
                <Input
                  id="cp-position"
                  value={contact_position}
                  onChange={e => setContactPosition(e.target.value)}
                  placeholder="Directeur, Responsable achats…"
                  className={inp}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-cphone">Tél. direct <OptionalBadge /></Label>
                <Input
                  id="cp-cphone"
                  type="tel"
                  value={contact_phone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+261 34 00 000 00"
                  className={inp}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-cwhatsapp">WhatsApp direct <OptionalBadge /></Label>
                <Input
                  id="cp-cwhatsapp"
                  type="tel"
                  value={contact_whatsapp}
                  onChange={e => setContactWhatsapp(e.target.value)}
                  placeholder="+261 34 00 000 00"
                  className={inp}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-cemail">E-mail direct <OptionalBadge /></Label>
                <Input
                  id="cp-cemail"
                  type="email"
                  value={contact_email}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="contact@entreprise.mg"
                  className={inp}
                />
              </div>
            </div>

            {/* ── 4. Adresse ──────────────────────────────────────────────── */}
            <SectionTitle icon={MapPin} label="Adresse" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-address">Adresse complète *</Label>
                <Input
                  id="cp-address"
                  value={address}
                  onChange={e => { setAddress(e.target.value); clearField('address') }}
                  placeholder="Lot, rue, quartier, ville"
                  className={inp}
                  aria-invalid={!!fieldErrors.address}
                />
                {errText(fieldErrors.address)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-region">Région / Province <OptionalBadge /></Label>
                <Input
                  id="cp-region"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  placeholder="Analamanga, Atsinanana…"
                  className={inp}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-delnotes">Instructions livraison <OptionalBadge /></Label>
                <Input
                  id="cp-delnotes"
                  value={delivery_notes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  placeholder="Code portail, bâtiment B, 2ème étage…"
                  className={inp}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-deladdr">
                  Adresse de livraison <OptionalBadge />
                  <span className="ml-1.5 text-[11px] text-slate-400">(si différente de l&apos;adresse société)</span>
                </Label>
                <Input
                  id="cp-deladdr"
                  value={delivery_address}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Adresse complète de livraison"
                  className={inp}
                />
              </div>
            </div>

            {/* ── 5. Départements ─────────────────────────────────────────── */}
            <div className="border-t border-slate-100 pt-5">
              <DepartmentsEditor
                value={departments}
                onChange={next => { setDepartments(next); clearField('departments') }}
                error={fieldErrors.departments}
                disabled={loading}
              />
            </div>

            {/* ── 6. GPS ──────────────────────────────────────────────────── */}
            <SectionTitle icon={Navigation} label="Coordonnées GPS" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cp-lat">Latitude <OptionalBadge /></Label>
                <Input
                  id="cp-lat"
                  inputMode="decimal"
                  placeholder="-18.8792"
                  value={gps_lat}
                  onChange={e => { setGpsLat(e.target.value); clearField('gps') }}
                  className={inp}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-lng">Longitude <OptionalBadge /></Label>
                <Input
                  id="cp-lng"
                  inputMode="decimal"
                  placeholder="47.5079"
                  value={gps_lng}
                  onChange={e => { setGpsLng(e.target.value); clearField('gps') }}
                  className={inp}
                />
              </div>
            </div>
            {fieldErrors.gps && <p className="text-sm text-red-600">{fieldErrors.gps}</p>}
            <p className="text-xs text-slate-400">
              Laissez vide si vous ne connaissez pas vos coordonnées GPS.
            </p>

            {/* ── Submit ──────────────────────────────────────────────────── */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  'Enregistrer et accéder à la plateforme'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
