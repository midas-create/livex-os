'use client'

/**
 * FormSelect — Reliable select dropdown for use inside Dialogs.
 *
 * @base-ui/react Dialog's modal mode adds `inert` to everything outside its
 * DOM node, AND its CSS transform creates a new containing block that breaks
 * `position: fixed` children (like Select.Portal). This component avoids both
 * problems by using plain React state + an inline `position: absolute` dropdown.
 *
 * Visually identical to the custom Select component.
 */

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormSelectOption {
  value: string
  label: string
}

interface FormSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: FormSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Choisir...',
  disabled = false,
  className,
  id,
}: FormSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoId = useId()
  const buttonId = id ?? autoId

  const selectedLabel = options.find(o => o.value === value)?.label

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-left transition-colors select-none',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-slate-400 ring-2 ring-slate-300/50' : 'hover:border-slate-300',
          selectedLabel ? 'text-slate-900' : 'text-slate-400'
        )}
      >
        <span className="flex-1 truncate">{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown — renders inline (no Portal), safe inside @base-ui Dialog */}
      {open && !disabled && (
        <ul
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[9999] max-h-56 overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400 select-none">
              Aucune option disponible
            </li>
          ) : (
            options.map(opt => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onPointerDown={e => {
                  e.preventDefault() // prevent blur on trigger before value update
                  onValueChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors select-none',
                  'hover:bg-slate-100 hover:text-slate-900',
                  opt.value === value
                    ? 'bg-slate-50 font-semibold text-slate-900'
                    : 'text-slate-700'
                )}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.value === value && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
