'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminOrdersContent } from '@/components/admin/AdminOrdersContent'

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl w-full" />
          ))}
        </div>
      </div>
    }>
      <AdminOrdersContent />
    </Suspense>
  )
}
