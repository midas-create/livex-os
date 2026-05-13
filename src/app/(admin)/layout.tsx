import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/products')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <AdminSidebar />
      {/* On mobile the sidebar is a drawer overlay, so no left margin needed.
          On desktop (lg+) the fixed sidebar is always visible → offset content. */}
      <div className="flex-1 min-w-0 lg:ml-56">
        <main className="min-h-screen px-4 py-3 lg:px-5 lg:py-4 pt-16 lg:pt-4 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  )
}
