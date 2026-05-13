'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { DepartmentsEditor, normalizeDepartmentsInput } from '@/components/client/DepartmentsEditor'
import { ClipboardList, Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AccountPage() {
  const { user, loading } = useUser()
  const [profileLoading, setProfileLoading] = useState(true)
  const [departments, setDepartments] = useState<string[]>([''])
  const [hasProfile, setHasProfile] = useState(false)
  const [savingDepts, setSavingDepts] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfileLoading(false)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase.from('client_profiles').select('id, departments').eq('user_id', user.id).maybeSingle()
    if (error || !data) {
      setHasProfile(false)
      setDepartments([''])
    } else {
      setHasProfile(true)
      const d = (data.departments as string[] | null | undefined) ?? []
      setDepartments(d.length > 0 ? d : [''])
    }
    setProfileLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (loading) return
    void loadProfile()
  }, [loading, loadProfile])

  async function saveDepartments() {
    if (!user?.id) return
    const norm = normalizeDepartmentsInput(departments)
    if (norm.length === 0) {
      toast.error('Ajoutez au moins un département.')
      return
    }
    setSavingDepts(true)
    const supabase = createClient()
    const { error } = await supabase.from('client_profiles').update({ departments: norm }).eq('user_id', user.id)
    setSavingDepts(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Départements enregistrés.')
    void loadProfile()
  }

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement…
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon compte</h1>
        <p className="text-slate-500 text-sm mt-1">Informations de votre entreprise</p>
      </div>

      <div className="saas-surface p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Entreprise</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{user.company_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">E-mail</p>
          <p className="text-slate-800 mt-0.5">{user.email}</p>
        </div>
      </div>

      {hasProfile && (
        <div className="saas-surface p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Départements (stock)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Modifiez la liste utilisée dans <strong>Quick sortie</strong> sur la page Stock.
            </p>
          </div>
          <DepartmentsEditor value={departments} onChange={setDepartments} disabled={savingDepts} />
          <Button type="button" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => void saveDepartments()} disabled={savingDepts}>
            {savingDepts ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer les départements'}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/orders"
          className={cn(buttonVariants({ variant: 'outline' }), 'border-slate-200 inline-flex items-center')}
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          Mes commandes
        </Link>
        <Link href="/products" className={cn(buttonVariants(), 'bg-slate-900 hover:bg-slate-800 inline-flex items-center')}>
          <Package className="w-4 h-4 mr-2" />
          Catalogue
        </Link>
      </div>
    </div>
  )
}
