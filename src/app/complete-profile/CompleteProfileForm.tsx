'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Package } from 'lucide-react'
import { DepartmentsEditor, normalizeDepartmentsInput } from '@/components/client/DepartmentsEditor'

type FieldErrors = Partial<Record<
  | 'company_name'
  | 'nif'
  | 'stat'
  | 'rcs'
  | 'manager_name'
  | 'phone'
  | 'email'
  | 'address'
  | 'region'
  | 'gps'
  | 'departments'
  | 'root',
  string
>>

export function CompleteProfileForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [company_name, setCompanyName] = useState('')
  const [nif, setNif] = useState('')
  const [stat, setStat] = useState('')
  const [rcs, setRcs] = useState('')
  const [manager_name, setManagerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [address, setAddress] = useState('')
  const [region, setRegion] = useState('')
  const [gps_lat, setGpsLat] = useState('')
  const [gps_lng, setGpsLng] = useState('')
  const [departments, setDepartments] = useState<string[]>([''])

  function clearField(key: keyof FieldErrors) {
    setFieldErrors(f => (f[key] ? { ...f, [key]: undefined } : f))
  }

  function validate(): boolean {
    const e: FieldErrors = {}
    const req = (val: string, key: keyof FieldErrors, label: string) => {
      if (!val.trim()) e[key] = `${label} est requis.`
    }

    req(company_name, 'company_name', 'Le nom de la société')
    req(nif, 'nif', 'Le NIF')
    req(stat, 'stat', 'Le STAT')
    req(rcs, 'rcs', 'Le RCS')
    req(manager_name, 'manager_name', 'Le nom du responsable')
    req(phone, 'phone', 'Le téléphone')
    req(email, 'email', "L'e-mail")
    req(address, 'address', "L'adresse")
    req(region, 'region', 'La région / province')

    const em = email.trim()
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      e.email = 'Adresse e-mail invalide.'
    }

    const latS = gps_lat.trim()
    const lngS = gps_lng.trim()
    if (latS || lngS) {
      const lat = Number(latS.replace(',', '.'))
      const lng = Number(lngS.replace(',', '.'))
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        e.gps = 'Latitude et longitude GPS doivent être des nombres valides (ou laissez les deux vides).'
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      user_id: user.id,
      company_name: company_name.trim(),
      nif: nif.trim(),
      stat: stat.trim(),
      rcs: rcs.trim(),
      manager_name: manager_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      region: region.trim(),
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      departments: deptsNorm,
    }

    const { error: upsertErr } = await supabase.from('client_profiles').upsert(row, { onConflict: 'user_id' })
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

  const inputClass =
    'h-9 rounded-md border-slate-200 bg-slate-50 placeholder:text-slate-400 focus-visible:border-orange-400 focus-visible:ring-orange-200/60'

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[600px]">
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
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Profil entreprise</h2>
            <p className="text-slate-500 text-sm mt-1">
              Ces informations sont utilisées pour vos commandes, factures et bons de livraison.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cp-company">Nom de la société *</Label>
                <Input
                  id="cp-company"
                  value={company_name}
                  onChange={e => {
                    setCompanyName(e.target.value)
                    clearField('company_name')
                  }}
                  className={inputClass}
                  aria-invalid={!!fieldErrors.company_name}
                />
                {fieldErrors.company_name && <p className="text-sm text-red-600">{fieldErrors.company_name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-nif">NIF *</Label>
                <Input id="cp-nif" value={nif} onChange={e => { setNif(e.target.value); clearField('nif') }} className={inputClass} />
                {fieldErrors.nif && <p className="text-sm text-red-600">{fieldErrors.nif}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-stat">STAT *</Label>
                <Input id="cp-stat" value={stat} onChange={e => { setStat(e.target.value); clearField('stat') }} className={inputClass} />
                {fieldErrors.stat && <p className="text-sm text-red-600">{fieldErrors.stat}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cp-rcs">RCS *</Label>
                <Input id="cp-rcs" value={rcs} onChange={e => { setRcs(e.target.value); clearField('rcs') }} className={inputClass} />
                {fieldErrors.rcs && <p className="text-sm text-red-600">{fieldErrors.rcs}</p>}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contact</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="cp-manager">Nom du responsable *</Label>
                  <Input
                    id="cp-manager"
                    value={manager_name}
                    onChange={e => {
                      setManagerName(e.target.value)
                      clearField('manager_name')
                    }}
                    className={inputClass}
                  />
                  {fieldErrors.manager_name && <p className="text-sm text-red-600">{fieldErrors.manager_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-phone">Téléphone *</Label>
                  <Input id="cp-phone" type="tel" value={phone} onChange={e => { setPhone(e.target.value); clearField('phone') }} className={inputClass} />
                  {fieldErrors.phone && <p className="text-sm text-red-600">{fieldErrors.phone}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-email">E-mail *</Label>
                  <Input
                    id="cp-email"
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      clearField('email')
                    }}
                    className={inputClass}
                  />
                  {fieldErrors.email && <p className="text-sm text-red-600">{fieldErrors.email}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-3">
              <DepartmentsEditor
                value={departments}
                onChange={next => {
                  setDepartments(next)
                  clearField('departments')
                }}
                error={fieldErrors.departments}
                disabled={loading}
              />
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Adresse</p>
              <div className="space-y-1.5">
                <Label htmlFor="cp-address">Adresse *</Label>
                <Input id="cp-address" value={address} onChange={e => { setAddress(e.target.value); clearField('address') }} className={inputClass} />
                {fieldErrors.address && <p className="text-sm text-red-600">{fieldErrors.address}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-region">Région / Province *</Label>
                <Input id="cp-region" value={region} onChange={e => { setRegion(e.target.value); clearField('region') }} className={inputClass} />
                {fieldErrors.region && <p className="text-sm text-red-600">{fieldErrors.region}</p>}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">GPS (optionnel)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-lat">Latitude</Label>
                  <Input
                    id="cp-lat"
                    inputMode="decimal"
                    placeholder="-18.8792"
                    value={gps_lat}
                    onChange={e => {
                      setGpsLat(e.target.value)
                      clearField('gps')
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-lng">Longitude</Label>
                  <Input
                    id="cp-lng"
                    inputMode="decimal"
                    placeholder="47.5079"
                    value={gps_lng}
                    onChange={e => {
                      setGpsLng(e.target.value)
                      clearField('gps')
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              {fieldErrors.gps && <p className="text-sm text-red-600">{fieldErrors.gps}</p>}
              <p className="text-xs text-slate-500">Laissez vide si vous ne souhaitez pas renseigner de coordonnées.</p>
            </div>

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
                'Enregistrer et continuer'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
