'use client'

import Image from 'next/image'
import Link from 'next/link'
import heroLivex from '@/public/branding/hero-livex.png'

export function StoreHome() {
  return (
    <div className="px-4 my-8 sm:my-10 lg:my-12">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10">
        <div className="relative">
          <Image
            src={heroLivex}
            alt="Livex Office Supplies"
            className="w-full h-auto"
            sizes="(max-width: 1024px) 100vw, 1024px"
            priority
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-8 text-sm font-semibold text-white shadow-lg shadow-orange-500/40 transition-colors hover:bg-orange-600 whitespace-nowrap"
            >
              Découvrir le catalogue
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
