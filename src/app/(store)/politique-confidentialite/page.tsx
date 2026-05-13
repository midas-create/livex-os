import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Livex Office Supplies',
  description:
    'Comment Livex Office Supplies collecte, utilise et protège vos données personnelles.',
}

const sections = [
  {
    title: '1. Introduction',
    content: (
      <>
        <p>
          La présente politique de confidentialité explique comment Livex Office Supplies collecte,
          utilise et protège les informations de ses utilisateurs lors de l&apos;utilisation de la
          plateforme Livex OS.
        </p>
        <p>
          En utilisant notre site et nos services, vous acceptez les pratiques décrites dans cette
          politique.
        </p>
      </>
    ),
  },
  {
    title: '2. Informations collectées',
    content: (
      <>
        <p>Nous pouvons collecter les informations suivantes :</p>
        <ul>
          <li>Nom et prénom</li>
          <li>Nom de l&apos;entreprise</li>
          <li>Adresse email</li>
          <li>Numéro de téléphone</li>
          <li>Adresse de livraison</li>
          <li>Informations de connexion</li>
          <li>Historique des commandes</li>
          <li>
            Informations liées à la gestion de stock et aux mouvements internes
          </li>
        </ul>
        <p>
          Certaines informations techniques peuvent également être collectées automatiquement afin
          d&apos;améliorer l&apos;expérience utilisateur et la sécurité de la plateforme.
        </p>
      </>
    ),
  },
  {
    title: '3. Utilisation des données',
    content: (
      <>
        <p>Les informations collectées sont utilisées notamment pour :</p>
        <ul>
          <li>Traiter les commandes</li>
          <li>Assurer les livraisons</li>
          <li>Gérer les comptes clients</li>
          <li>Fournir les fonctionnalités de gestion de stock</li>
          <li>Améliorer la qualité des services</li>
          <li>
            Envoyer des informations importantes concernant les commandes ou le compte utilisateur
          </li>
          <li>Assurer la sécurité de la plateforme</li>
        </ul>
      </>
    ),
  },
  {
    title: '4. Confidentialité des données',
    content: (
      <p>
        Livex Office Supplies s&apos;engage à ne pas vendre ni divulguer les données personnelles de
        ses utilisateurs à des tiers sans autorisation, sauf obligation légale ou nécessité liée au
        fonctionnement du service.
      </p>
    ),
  },
  {
    title: '5. Sécurité',
    content: (
      <>
        <p>
          Nous mettons en œuvre des mesures raisonnables de sécurité afin de protéger les
          informations contre les accès non autorisés, les pertes, les modifications ou les
          divulgations.
        </p>
        <p>Cependant, aucun système informatique ne peut garantir une sécurité absolue.</p>
      </>
    ),
  },
  {
    title: '6. Cookies et technologies similaires',
    content: (
      <>
        <p>La plateforme peut utiliser des cookies ou technologies similaires afin :</p>
        <ul>
          <li>d&apos;améliorer la navigation ;</li>
          <li>de mémoriser certaines préférences ;</li>
          <li>d&apos;analyser l&apos;utilisation du site.</li>
        </ul>
        <p>
          L&apos;utilisateur peut limiter ou désactiver les cookies via les paramètres de son
          navigateur.
        </p>
      </>
    ),
  },
  {
    title: '7. Conservation des données',
    content: (
      <p>
        Les données sont conservées aussi longtemps que nécessaire pour le bon fonctionnement des
        services, le suivi commercial, la gestion des commandes et les obligations administratives ou
        légales.
      </p>
    ),
  },
  {
    title: '8. Responsabilités des utilisateurs',
    content: (
      <p>
        Les utilisateurs sont responsables de la confidentialité de leurs identifiants de connexion
        et des activités effectuées depuis leur compte.
      </p>
    ),
  },
  {
    title: '9. Modifications de la politique',
    content: (
      <p>
        Livex Office Supplies peut modifier la présente politique de confidentialité à tout moment
        afin de l&apos;adapter aux évolutions du service ou de la réglementation.
      </p>
    ),
  },
  {
    title: '10. Contact',
    content: (
      <p>
        Pour toute question concernant cette politique de confidentialité, vous pouvez contacter
        Livex Office Supplies via les coordonnées disponibles sur la plateforme.
      </p>
    ),
  },
]

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="py-6 sm:py-10">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-livex-navy transition-colors mb-8"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour à l&apos;accueil
      </Link>

      <article className="max-w-2xl mx-auto">
        {/* Page header */}
        <header className="mb-10 pb-6 border-b border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 mb-2">
            Livex Office Supplies
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-livex-navy leading-tight tracking-tight">
            Politique de confidentialité
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Dernière mise à jour : mai 2025
          </p>
        </header>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-base sm:text-lg font-bold text-livex-navy mb-3 leading-snug">
                {title}
              </h2>
              <div className="space-y-3 text-sm sm:text-[15px] text-slate-700 leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-slate-600">
                {content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-400 leading-relaxed">
            Cette politique de confidentialité s&apos;applique à la plateforme Livex OS et aux
            services associés fournis par Livex Office Supplies.
          </p>
        </div>
      </article>
    </div>
  )
}
