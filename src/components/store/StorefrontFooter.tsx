import Link from 'next/link'
import Image from 'next/image'
import { Mail, MapPin } from 'lucide-react'
import logoLivex from '@/public/branding/logo-livex.png'

const navLinks = [
  { href: '/products', label: 'Catalogue' },
  { href: '/login',    label: 'Connexion' },
  { href: '/signup',   label: 'Créer un compte' },
]

const legalLinks = [
  { href: '/cgv',                       label: 'CGV' },
  { href: '/politique-confidentialite', label: 'Politique de confidentialité' },
]

export function StorefrontFooter() {
  return (
    <footer className="bg-[#0c1a2e] text-slate-300 mt-auto">
      {/* Main grid */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">

          {/* Brand column */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex">
              <Image
                src={logoLivex}
                alt="Livex Office Supplies"
                className="h-9 w-auto brightness-0 invert opacity-90"
                sizes="180px"
              />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Plateforme B2B de fournitures de bureau professionnelles.
              Commandes, livraisons et gestion de stock centralisés.
            </p>
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
                <span>Antananarivo, Madagascar</span>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600" />
                <span>contact@livex.mg</span>
              </div>
            </div>
          </div>

          {/* Navigation column */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Navigation
            </h3>
            <ul className="space-y-2.5">
              {navLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Légal
            </h3>
            <ul className="space-y-2.5">
              {legalLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Copyright strip */}
      <div className="border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-600 text-center sm:text-left">
            &copy; {new Date().getFullYear()} Livex Office Supplies. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            {legalLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
