import { StorefrontHeader } from '@/components/store/StorefrontHeader'
import { ReassuranceStrip } from '@/components/store/ReassuranceStrip'
import { StorefrontFooter } from '@/components/store/StorefrontFooter'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="livex-store min-h-screen flex flex-col">
      <StorefrontHeader />
      <ReassuranceStrip />
      <main className="flex-1 max-w-[1440px] mx-auto w-full px-3 sm:px-5 lg:px-6 py-3 lg:py-4">
        {children}
      </main>
      <StorefrontFooter />
    </div>
  )
}
