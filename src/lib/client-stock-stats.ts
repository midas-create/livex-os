import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Period ───────────────────────────────────────────────────────────────────

export type StatsPeriod = '1m' | '3m' | '6m' | '12m' | 'all'

export const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: '1m', label: 'Ce mois' },
  { value: '3m', label: '3 derniers mois' },
  { value: '6m', label: '6 derniers mois' },
  { value: '12m', label: '12 derniers mois' },
  { value: 'all', label: 'Tout' },
]

export function periodStartISO(period: StatsPeriod): string | null {
  if (period === 'all') return null
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[period]
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Raw shapes returned by Supabase ─────────────────────────────────────────

type RawMov = {
  id: string
  product_id: string
  variant_id: string | null
  quantity: number
  department: string | null
  signed_by: string | null
  created_at: string
  unit_price_ht: number
  product: { id: string; name: string } | null
  variant: { id: string; color: string } | null
}

type RawStock = {
  product_id: string
  variant_id: string | null
  current_stock: number
  min_threshold: number
  product: { id: string; name: string } | null
  variant: { id: string; color: string } | null
}

// ─── Normalised data shapes ───────────────────────────────────────────────────

export interface StatsMovement {
  id: string
  product_id: string
  variant_id: string | null
  quantity: number
  department: string | null
  signed_by: string | null
  created_at: string
  /** "Produit — Couleur" or "Produit" */
  label: string
  /** unit_price_ht stored on the movement row at creation time (HT) */
  unit_price: number
}

export interface LowStockRow {
  product_id: string
  variant_id: string | null
  label: string
  current_stock: number
  min_threshold: number
}

// ─── Computed stat shapes ─────────────────────────────────────────────────────

export interface DeptStat {
  department: string
  total_amount: number
  total_quantity: number
}

export interface ProductStat {
  product_id: string
  variant_id: string | null
  label: string
  total_amount: number
  total_quantity: number
}

export interface MonthStat {
  month: string  // "YYYY-MM"
  label: string  // "jan. 25"
  total_amount: number
}

export interface SignerStat {
  signed_by: string
  movement_count: number
  total_quantity: number
}

export interface ComputedStats {
  currentMonthAmount: number
  prevMonthAmount: number
  topDepartments: DeptStat[]
  topExpensiveProducts: ProductStat[]
  mostConsumedProducts: ProductStat[]
  monthlyEvolution: MonthStat[]
  frequentSigners: SignerStat[]
  totalOutAmount: number
  totalOutQuantity: number
}

// ─── Supabase fetch ───────────────────────────────────────────────────────────

export async function fetchClientStockStats(
  supabase: SupabaseClient,
  companyId: string,
  period: StatsPeriod
): Promise<{
  movements: StatsMovement[]
  lowStockAlerts: LowStockRow[]
  error: string | null
}> {
  let movQ = supabase
    .from('client_stock_movements')
    .select(
      'id, product_id, variant_id, quantity, unit_price_ht, department, signed_by, created_at,' +
      'product:products(id, name),' +
      'variant:product_variants(id, color)'
    )
    .eq('company_id', companyId)
    .eq('type', 'OUT')
    .order('created_at', { ascending: false })

  const startISO = periodStartISO(period)
  if (startISO) movQ = movQ.gte('created_at', startISO)

  const { data: rawMovs, error: mErr } = await movQ
  if (mErr) return { movements: [], lowStockAlerts: [], error: mErr.message }

  const movements: StatsMovement[] = ((rawMovs ?? []) as unknown as RawMov[]).map(m => {
    const color = m.variant?.color ?? null
    const name = m.product?.name ?? '—'
    return {
      id: m.id,
      product_id: m.product_id,
      variant_id: m.variant_id,
      quantity: m.quantity,
      department: m.department,
      signed_by: m.signed_by,
      created_at: m.created_at,
      label: color ? `${name} — ${color}` : name,
      unit_price: m.unit_price_ht,
    }
  })

  const { data: rawStocks, error: sErr } = await supabase
    .from('client_stocks')
    .select(
      'product_id, variant_id, current_stock, min_threshold,' +
      'product:products(id, name),' +
      'variant:product_variants(id, color)'
    )
    .eq('company_id', companyId)

  if (sErr) return { movements, lowStockAlerts: [], error: sErr.message }

  const lowStockAlerts: LowStockRow[] = ((rawStocks ?? []) as unknown as RawStock[])
    .filter(s => s.current_stock <= s.min_threshold)
    .map(s => {
      const color = s.variant?.color ?? null
      const name = s.product?.name ?? '—'
      return {
        product_id: s.product_id,
        variant_id: s.variant_id,
        label: color ? `${name} — ${color}` : name,
        current_stock: s.current_stock,
        min_threshold: s.min_threshold,
      }
    })

  return { movements, lowStockAlerts, error: null }
}

// ─── Pure computation (no I/O — easy to extend with site_id later) ────────────

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/**
 * Derive all dashboard statistics from a flat list of OUT movements.
 * Extending for a future site_id dimension means grouping movements by
 * site_id before calling this function per site, or adding site_id
 * as an extra dimension in the grouping maps below.
 */
export function computeStats(movements: StatsMovement[], period: StatsPeriod): ComputedStats {
  const now = new Date()
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  let currentMonthAmount = 0
  let prevMonthAmount = 0
  let totalOutAmount = 0
  let totalOutQuantity = 0

  const deptMap = new Map<string, { total_amount: number; total_quantity: number }>()
  const prodMap = new Map<string, { label: string; product_id: string; variant_id: string | null; total_amount: number; total_quantity: number }>()
  const signerMap = new Map<string, { movement_count: number; total_quantity: number }>()

  for (const m of movements) {
    const amount = m.quantity * m.unit_price
    const mk = monthKey(m.created_at)

    totalOutAmount += amount
    totalOutQuantity += m.quantity

    if (mk === curKey) currentMonthAmount += amount
    if (mk === prevKey) prevMonthAmount += amount

    // Department aggregation
    const dept = m.department?.trim() || 'Non précisé'
    const d = deptMap.get(dept) ?? { total_amount: 0, total_quantity: 0 }
    d.total_amount += amount
    d.total_quantity += m.quantity
    deptMap.set(dept, d)

    // Product aggregation (product_id + variant_id as composite key)
    const pk = `${m.product_id}::${m.variant_id ?? 'null'}`
    const p = prodMap.get(pk) ?? { label: m.label, product_id: m.product_id, variant_id: m.variant_id, total_amount: 0, total_quantity: 0 }
    p.total_amount += amount
    p.total_quantity += m.quantity
    prodMap.set(pk, p)

    // Signer aggregation
    const signer = m.signed_by?.trim() || 'Non renseigné'
    const s = signerMap.get(signer) ?? { movement_count: 0, total_quantity: 0 }
    s.movement_count += 1
    s.total_quantity += m.quantity
    signerMap.set(signer, s)
  }

  const topDepartments: DeptStat[] = Array.from(deptMap.entries())
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.total_amount - a.total_amount)

  const allProducts: ProductStat[] = Array.from(prodMap.values())
  const topExpensiveProducts = [...allProducts].sort((a, b) => b.total_amount - a.total_amount).slice(0, 10)
  const mostConsumedProducts = [...allProducts].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, 10)

  const frequentSigners: SignerStat[] = Array.from(signerMap.entries())
    .map(([signed_by, v]) => ({ signed_by, ...v }))
    .sort((a, b) => b.total_quantity - a.total_quantity)

  // Monthly evolution: show a window of months (min 3, up to 12)
  const chartMonths = period === '12m' || period === 'all' ? 12 : period === '6m' ? 6 : 3
  const monthlyEvolution: MonthStat[] = []
  for (let i = chartMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const total_amount = movements
      .filter(m => monthKey(m.created_at) === key)
      .reduce((sum, m) => sum + m.quantity * m.unit_price, 0)
    monthlyEvolution.push({ month: key, label, total_amount })
  }

  return {
    currentMonthAmount,
    prevMonthAmount,
    topDepartments,
    topExpensiveProducts,
    mostConsumedProducts,
    monthlyEvolution,
    frequentSigners,
    totalOutAmount,
    totalOutQuantity,
  }
}
