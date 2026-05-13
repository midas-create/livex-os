import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — Livex Office Supplies',
  description:
    'Les conditions générales de vente applicables aux commandes passées sur la plateforme Livex OS.',
}

const sections = [
  {
    title: '1. Objet',
    content: (
      <>
        <p>
          Les présentes Conditions Générales de Vente définissent les modalités de vente des
          produits et services proposés par Livex Office Supplies via la plateforme Livex OS.
        </p>
        <p>
          Toute commande effectuée sur la plateforme implique l&apos;acceptation des présentes
          conditions.
        </p>
      </>
    ),
  },
  {
    title: '2. Produits et disponibilité',
    content: (
      <>
        <p>
          Livex Office Supplies propose des fournitures de bureau et produits associés destinés
          principalement aux professionnels et entreprises.
        </p>
        <p>
          Les produits affichés sur la plateforme sont proposés dans la limite des stocks
          disponibles.
        </p>
        <p>
          Les images et descriptions des produits sont fournies à titre indicatif et peuvent
          présenter de légères différences avec les produits livrés.
        </p>
      </>
    ),
  },
  {
    title: '3. Prix',
    content: (
      <>
        <p>
          Les prix affichés sur la plateforme sont exprimés en Ariary (Ar).
        </p>
        <p>
          Sauf mention contraire, les prix affichés sont des prix Hors Taxes (HT).
        </p>
        <p>
          Livex Office Supplies se réserve le droit de modifier ses prix à tout moment. Toutefois,
          les produits sont facturés sur la base des tarifs en vigueur au moment de la validation
          de la commande.
        </p>
      </>
    ),
  },
  {
    title: '4. Commandes',
    content: (
      <>
        <p>
          Le client est responsable de l&apos;exactitude des informations fournies lors de la
          commande.
        </p>
        <p>
          Livex Office Supplies se réserve le droit de refuser ou d&apos;annuler une commande en
          cas&nbsp;:
        </p>
        <ul>
          <li>d&apos;informations incomplètes&nbsp;;</li>
          <li>de problème de paiement&nbsp;;</li>
          <li>de suspicion de fraude&nbsp;;</li>
          <li>
            ou de situation exceptionnelle empêchant l&apos;exécution normale de la commande.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: '5. Livraison',
    content: (
      <>
        <p>
          Les livraisons sont effectuées à l&apos;adresse indiquée par le client lors de la
          commande.
        </p>
        <p>
          Les délais de livraison sont donnés à titre indicatif et peuvent varier selon&nbsp;:
        </p>
        <ul>
          <li>la disponibilité des produits&nbsp;;</li>
          <li>la localisation&nbsp;;</li>
          <li>les contraintes logistiques.</li>
        </ul>
        <p>
          Livex Office Supplies ne pourra être tenu responsable des retards causés par des
          événements indépendants de sa volonté.
        </p>
      </>
    ),
  },
  {
    title: '6. Réception des produits',
    content: (
      <>
        <p>Le client est tenu de vérifier les produits lors de la réception.</p>
        <p>
          Toute anomalie ou contestation doit être signalée dans un délai raisonnable après
          livraison.
        </p>
      </>
    ),
  },
  {
    title: '7. Paiement',
    content: (
      <>
        <p>Les modalités de paiement peuvent inclure&nbsp;:</p>
        <ul>
          <li>virement bancaire&nbsp;;</li>
          <li>mobile money&nbsp;;</li>
          <li>espèces&nbsp;;</li>
          <li>chèque&nbsp;;</li>
          <li>ou toute autre méthode acceptée par Livex Office Supplies.</li>
        </ul>
        <p>
          Des conditions de paiement spécifiques peuvent être accordées à certains clients
          professionnels.
        </p>
      </>
    ),
  },
  {
    title: '8. Gestion de stock client',
    content: (
      <>
        <p>
          La plateforme Livex OS peut fournir des fonctionnalités de gestion de stock destinées à
          aider les entreprises clientes à suivre leurs consommations internes.
        </p>
        <p>
          Ces fonctionnalités sont fournies à titre d&apos;assistance de gestion et ne remplacent
          pas les procédures internes de contrôle du client.
        </p>
      </>
    ),
  },
  {
    title: '9. Responsabilité',
    content: (
      <>
        <p>
          Livex Office Supplies met en œuvre tous les moyens raisonnables pour assurer le bon
          fonctionnement de la plateforme.
        </p>
        <p>
          Cependant, la société ne saurait être tenue responsable&nbsp;:
        </p>
        <ul>
          <li>des interruptions temporaires&nbsp;;</li>
          <li>des problèmes techniques&nbsp;;</li>
          <li>des pertes indirectes&nbsp;;</li>
          <li>ou des utilisations incorrectes de la plateforme par les utilisateurs.</li>
        </ul>
      </>
    ),
  },
  {
    title: '10. Propriété intellectuelle',
    content: (
      <>
        <p>
          Les contenus, logos, éléments graphiques, textes et composants de la plateforme Livex OS
          restent la propriété exclusive de Livex Office Supplies, sauf mention contraire.
        </p>
        <p>Toute reproduction ou utilisation non autorisée est interdite.</p>
      </>
    ),
  },
  {
    title: '11. Modification des CGV',
    content: (
      <>
        <p>
          Livex Office Supplies se réserve le droit de modifier les présentes Conditions Générales
          de Vente à tout moment.
        </p>
        <p>
          Les nouvelles conditions prennent effet dès leur publication sur la plateforme.
        </p>
      </>
    ),
  },
  {
    title: '12. Droit applicable',
    content: (
      <p>
        Les présentes CGV sont soumises au droit applicable à Madagascar.
      </p>
    ),
  },
  {
    title: '13. Contact',
    content: (
      <p>
        Pour toute question concernant les présentes Conditions Générales de Vente, les
        utilisateurs peuvent contacter Livex Office Supplies via les coordonnées disponibles sur la
        plateforme.
      </p>
    ),
  },
]

export default function CGVPage() {
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
            Conditions Générales de Vente
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
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Ces conditions s&apos;appliquent à toutes les commandes passées via la plateforme
            Livex OS.
          </p>
          <Link
            href="/politique-confidentialite"
            className="text-xs text-slate-500 hover:text-livex-navy underline-offset-4 hover:underline transition-colors shrink-0"
          >
            Politique de confidentialité
          </Link>
        </div>
      </article>
    </div>
  )
}
