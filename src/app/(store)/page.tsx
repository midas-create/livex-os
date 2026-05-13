import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StoreHome } from '@/components/store/StoreHome'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()

    if (profile?.role === 'admin') {
      redirect('/admin')
    }

    const { data: clientProfile } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!clientProfile) {
      redirect('/complete-profile')
    }
  }

  return <StoreHome />
}
