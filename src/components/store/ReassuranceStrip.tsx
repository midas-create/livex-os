import { Truck, Package, BadgePercent, Headphones } from 'lucide-react'

const items = [
  { icon: Truck, title: 'Livraison express', subtitle: 'Partout à Madagascar.' },
  { icon: Package, title: 'Stock disponible', subtitle: 'Produits en stock.' },
  { icon: BadgePercent, title: 'Prix compétitifs', subtitle: 'Meilleurs prix garantis.' },
  { icon: Headphones, title: 'Support client', subtitle: 'À votre écoute.' },
]

export function ReassuranceStrip() {
  return (
    <div className="border-b border-stone-200/60 bg-[#f8f7f4]/95 backdrop-blur-[2px]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 lg:gap-8">
          {items.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex items-start gap-2 min-w-0">
              <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-600 stroke-[1.75]" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-livex-navy leading-tight tracking-tight">{title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
