'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  error?: string
  disabled?: boolean
}

/** Liste de départements : une ligne = un département (paramétrage profil). */
export function DepartmentsEditor({ value, onChange, error, disabled }: Props) {
  function setRow(i: number, s: string) {
    const next = [...value]
    next[i] = s
    onChange(next)
  }

  function addRow() {
    onChange([...value, ''])
  }

  function removeRow(i: number) {
    if (value.length <= 1) {
      onChange([''])
      return
    }
    onChange(value.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium text-slate-800">Départements *</Label>
        <p className="text-xs text-slate-500 mt-0.5">
          Renseignez les services ou départements (ex. Comptabilité, RH). Ils apparaîtront dans les sorties de stock.
        </p>
      </div>
      <div className="space-y-2">
        {value.map((d, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={d}
              onChange={e => setRow(i, e.target.value)}
              placeholder={`Ex. Achats, IT, Accueil…`}
              disabled={disabled}
              className="h-9 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 h-9 px-2"
              onClick={() => removeRow(i)}
              disabled={disabled || value.length <= 1}
            >
              Retirer
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8" onClick={addRow} disabled={disabled}>
        Ajouter un département
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

/** Nettoie pour enregistrement DB : trim, sans doublons (insensible à la casse), non vides. */
export function normalizeDepartmentsInput(rows: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    const t = r.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}
