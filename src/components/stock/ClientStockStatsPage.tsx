'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import {
  fetchClientStockStats,
  computeStats,
  PERIOD_OPTIONS,
  type StatsPeriod,
  type StatsMovement,
  type LowStockRow,
  type ComputedStats,
} from '@/lib/client-stock-stats'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAr } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** HT suffix for all monetary amounts on this page */
function fmtHT(n: number): string {
  return `${formatAr(n)} HT`
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="inline-flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
      {rank}
    </span>
  )
}

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) {
    return <span className="text-xs text-slate-400">Pas de données mois préc.</span>
  }
  const diff = current - prev
  const pct = (diff / prev) * 100
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Minus className="w-3 h-3" />
        Stable vs mois préc.
      </span>
    )
  }
  const up = diff > 0
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        up ? 'text-amber-600' : 'text-emerald-600'
      )}
    >
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}
      {pct.toFixed(1)}% vs mois préc.
    </span>
  )
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function RankedTable({
  rows,
  columns,
}: {
  rows: { key: string; label: string; col1: string; col2: string }[]
  columns: [string, string, string]
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">Aucune donnée sur la période</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-slate-100">
            <th className="pb-2 font-medium text-slate-500 w-7">#</th>
            <th className="pb-2 font-medium text-slate-500">{columns[0]}</th>
            <th className="pb-2 font-medium text-slate-500 text-right">{columns[1]}</th>
            <th className="pb-2 font-medium text-slate-500 text-right">{columns[2]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-2">
                <RankBadge rank={i + 1} />
              </td>
              <td className="py-2 font-medium text-slate-800 truncate max-w-[160px]">{row.label}</td>
              <td className="py-2 text-right tabular-nums text-slate-700">{row.col1}</td>
              <td className="py-2 text-right tabular-nums text-slate-500">{row.col2}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientStockStatsPage() {
  const { user, loading: userLoading } = useUser()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [period, setPeriod] = useState<StatsPeriod>('1m')
  const [movements, setMovements] = useState<StatsMovement[]>([])
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadCompany = useCallback(async () => {
    if (!user || user.role === 'admin') {
      setCompanyId(null)
      setLoading(false)
      return
    }
    const supabase = createClient()
    const { data: cp, error } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !cp) {
      setCompanyId(null)
      setLoading(false)
      return
    }
    setCompanyId(cp.id)
  }, [user])

  const loadStats = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError(null)
    const supabase = createClient()
    const { movements: mvs, lowStockAlerts: alerts, error } = await fetchClientStockStats(
      supabase,
      companyId,
      period
    )
    if (error) {
      setFetchError(error)
    } else {
      setMovements(mvs)
      setLowStockAlerts(alerts)
    }
    setLoading(false)
  }, [companyId, period])

  useEffect(() => {
    if (userLoading) return
    void loadCompany()
  }, [userLoading, loadCompany])

  useEffect(() => {
    if (companyId) void loadStats()
  }, [companyId, loadStats])

  const stats: ComputedStats | null = useMemo(
    () => (movements.length > 0 ? computeStats(movements, period) : null),
    [movements, period]
  )

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (userLoading || (loading && !stats)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (!user || user.role === 'admin') {
    return <p className="text-sm text-slate-600">Cette page est réservée aux comptes client.</p>
  }

  if (!companyId) {
    return (
      <p className="text-sm text-slate-600">
        Complétez votre profil entreprise pour accéder aux statistiques.
      </p>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasMovements = movements.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/stock"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Stock
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-slate-900">Statistiques de consommation</h1>
          </div>
        </div>

        <Select value={period} onValueChange={v => setPeriod(v as StatsPeriod)}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Erreur de chargement : {fetchError}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Monthly total */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Consommation — mois en cours
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats ? fmtHT(stats.currentMonthAmount) : '— Ar HT'}
          </p>
          {stats && (
            <TrendBadge current={stats.currentMonthAmount} prev={stats.prevMonthAmount} />
          )}
        </div>

        {/* Total for period */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Total sur la période
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {stats ? fmtHT(stats.totalOutAmount) : '— Ar HT'}
          </p>
          <p className="text-xs text-slate-400">
            {stats ? `${stats.totalOutQuantity} unité${stats.totalOutQuantity > 1 ? 's' : ''} sorties` : '—'}
          </p>
        </div>

        {/* Low stock alerts */}
        <div
          className={cn(
            'rounded-xl border p-4 space-y-1',
            lowStockAlerts.length > 0
              ? 'bg-red-50/80 border-red-200'
              : 'bg-white border-slate-200'
          )}
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Alertes stock bas
          </p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums',
              lowStockAlerts.length > 0 ? 'text-red-700' : 'text-slate-900'
            )}
          >
            {lowStockAlerts.length}
          </p>
          <p className="text-xs text-slate-400">
            {lowStockAlerts.length === 0
              ? 'Aucune alerte'
              : `article${lowStockAlerts.length > 1 ? 's' : ''} sous le seuil`}
          </p>
        </div>
      </div>

      {/* Monthly evolution chart */}
      <SectionCard title="Évolution mensuelle des consommations">
        {!hasMovements ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Aucune sortie de stock enregistrée sur la période.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={stats?.monthlyEvolution ?? []}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}k`
                    : `${v}`
                }
                width={48}
              />
              <Tooltip
                formatter={(value) => [fmtHT(Number(value ?? 0)), 'Consommation']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
                }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="total_amount" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Top departments & Top expensive products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Top départements consommateurs">
          <RankedTable
            rows={(stats?.topDepartments ?? []).slice(0, 8).map(d => ({
              key: d.department,
              label: d.department,
              col1: fmtHT(d.total_amount),
              col2: `${d.total_quantity} unité${d.total_quantity > 1 ? 's' : ''}`,
            }))}
            columns={['Département', 'Montant HT', 'Qté']}
          />
        </SectionCard>

        <SectionCard title="Fournitures les plus coûteuses">
          <RankedTable
            rows={(stats?.topExpensiveProducts ?? []).map(p => ({
              key: `${p.product_id}::${p.variant_id ?? 'null'}`,
              label: p.label,
              col1: fmtHT(p.total_amount),
              col2: `${p.total_quantity} unité${p.total_quantity > 1 ? 's' : ''}`,
            }))}
            columns={['Article', 'Coût total HT', 'Qté']}
          />
        </SectionCard>
      </div>

      {/* Most consumed by qty & Frequent signers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Articles les plus sortis (quantité)">
          <RankedTable
            rows={(stats?.mostConsumedProducts ?? []).map(p => ({
              key: `${p.product_id}::${p.variant_id ?? 'null'}`,
              label: p.label,
              col1: `${p.total_quantity} unité${p.total_quantity > 1 ? 's' : ''}`,
              col2: fmtHT(p.total_amount),
            }))}
            columns={['Article', 'Qté sortie', 'Montant HT']}
          />
        </SectionCard>

        <SectionCard title="Signataires fréquents">
          <RankedTable
            rows={(stats?.frequentSigners ?? []).slice(0, 8).map(s => ({
              key: s.signed_by,
              label: s.signed_by,
              col1: `${s.total_quantity} unité${s.total_quantity > 1 ? 's' : ''}`,
              col2: `${s.movement_count} sortie${s.movement_count > 1 ? 's' : ''}`,
            }))}
            columns={['Signataire', 'Qté retirée', 'Nb sorties']}
          />
        </SectionCard>
      </div>

      {/* Low stock alerts table */}
      {lowStockAlerts.length > 0 && (
        <SectionCard title={`Alertes stock bas (${lowStockAlerts.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100">
                  <th className="pb-2 font-medium text-slate-500">Article</th>
                  <th className="pb-2 font-medium text-slate-500 text-right">Stock actuel</th>
                  <th className="pb-2 font-medium text-slate-500 text-right">Seuil min.</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map(row => (
                  <tr
                    key={`${row.product_id}::${row.variant_id ?? 'null'}`}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2 font-medium text-slate-800">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold text-red-700">
                      {row.current_stock}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {row.min_threshold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <p className="text-xs text-slate-400 text-center pb-2">
        Montants en Ariary HT — basés sur le prix catalogue au moment de la consultation.
      </p>
    </div>
  )
}
