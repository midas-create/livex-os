'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Package } from 'lucide-react'
import { postLoginDestination } from '@/lib/auth-routes'

function LoginForm() {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  const registered = searchParams.get('registered') === '1'
  const pendingEmail = searchParams.get('pending') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    window.location.href = postLoginDestination(nextParam)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[600px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0F172A] to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">LiveX Supply</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">B2B Office Supplies</p>
          </div>
        </div>

        {/* Card */}
        <div className="saas-surface rounded-2xl p-6 sm:p-8 max-w-[600px] mx-auto">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="text-slate-500 text-sm mt-1">Access your company ordering account</p>
          </div>

          {registered && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            >
              {pendingEmail
                ? 'Inscription enregistrée. Vérifiez votre boîte mail et cliquez sur le lien de confirmation avant de vous connecter.'
                : 'Compte créé. Connectez-vous avec votre e-mail et votre mot de passe.'}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium text-sm">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-slate-50 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 font-medium text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-slate-50 placeholder:text-slate-400"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md transition-all duration-200 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Pas de compte ?{' '}
          <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[600px] rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/60">
        <p className="text-center text-sm text-slate-500">Chargement…</p>
      </div>
    </div>
  )
}
