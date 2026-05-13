import { Suspense } from 'react'
import { AdminFournisseursContent } from '@/components/admin/AdminFournisseursContent'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Fournisseurs — LiveX Supply' }

export default function AdminFournisseursPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    }>
      <AdminFournisseursContent />
    </Suspense>
  )
}
