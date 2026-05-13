'use client'

import type { ClientProfile } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Building2, MapPin, Phone, Mail, User, Hash } from 'lucide-react'

function Row({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 text-right font-medium">{value}</span>
    </div>
  )
}

export function ClientProfileModal({
  open,
  onOpenChange,
  companyTitle,
  profile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyTitle: string
  profile: ClientProfile | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <span>Fiche client — {companyTitle}</span>
          </DialogTitle>
        </DialogHeader>

        {!profile ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Aucun profil société enregistré pour ce client. Les informations légales complètes apparaîtront après
            complétion du profil.
          </p>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-0">
              <Row label="Société" value={profile.company_name} />
              <Row label="NIF" value={profile.nif} />
              <Row label="STAT" value={profile.stat} />
              <Row label="RCS" value={profile.rcs} />
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3 h-3" /> Contact
              </p>
              <Row label="Responsable" value={profile.manager_name} />
              <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500 flex items-center gap-1 shrink-0">
                  <Phone className="w-3.5 h-3.5" /> Tél.
                </span>
                <span className="text-slate-900 text-right font-medium">{profile.phone}</span>
              </div>
              <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500 flex items-center gap-1 shrink-0">
                  <Mail className="w-3.5 h-3.5" /> E-mail
                </span>
                <span className="text-slate-900 text-right font-medium break-all">{profile.email}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> Adresse
              </p>
              <Row label="Adresse" value={profile.address} />
              <Row label="Région / Province" value={profile.region} />
              {(profile.gps_lat != null && profile.gps_lng != null) && (
                <div className="flex items-start justify-between gap-4 py-2 text-sm">
                  <span className="text-slate-500 flex items-center gap-1 shrink-0">
                    <Hash className="w-3.5 h-3.5" /> GPS
                  </span>
                  <span className="text-slate-900 text-right font-mono text-xs">
                    {String(profile.gps_lat)}, {String(profile.gps_lng)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
