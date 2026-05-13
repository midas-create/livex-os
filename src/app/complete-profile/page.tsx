import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompleteProfileForm } from './CompleteProfileForm'

export default async function CompleteProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).single()

  if (roleRow?.role === 'admin') {
    redirect('/admin')
  }

  const { data: existing } = await supabase.from('client_profiles').select('id').eq('user_id', user.id).maybeSingle()

  if (existing) {
    redirect('/products')
  }

  return <CompleteProfileForm defaultEmail={user.email ?? ''} />
}
