import { Suspense } from 'react'
import { AdminLivraisonsContent } from '@/components/admin/AdminLivraisonsContent'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Livraisons — LiveX Supply' }

export default function AdminLivraisonsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    }>
      <AdminLivraisonsContent />
    </Suspense>
  )
}
