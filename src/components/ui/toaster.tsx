'use client'
import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: { borderRadius: '8px' },
      }}
    />
  )
}
