'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Package } from 'lucide-react'

const MIN_PASSWORD = 8

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  function validate(): boolean {
    const next: typeof fieldErrors = {}
    const trimmed = email.trim()

    if (!trimmed) {
      next.email = 'L’adresse e-mail est requise.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      next.email = 'Entrez une adresse e-mail valide.'
    }

    if (password.length < MIN_PASSWORD) {
      next.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`
    }

    if (password !== confirmPassword) {
      next.confirmPassword = 'Les mots de passe ne correspondent pas.'
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const supabase = createClient()
    const trimmedEmail = email.trim()

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      toast.success('Compte créé. Complétez votre profil entreprise.')
      window.location.href = '/complete-profile'
      return
    }

    toast.success('Inscription enregistrée.')
    router.push('/login?registered=1&pending=1')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-[600px]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0F172A] to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">LiveX Supply</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">B2B Office Supplies</p>
          </div>
        </div>

        <div className="saas-surface rounded-2xl p-6 sm:p-8 max-w-[600px] mx-auto">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-900">Créer un compte</h2>
            <p className="text-slate-500 text-sm mt-1">Compte client — commandez vos fournitures en ligne</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-slate-700 font-medium text-sm">
                E-mail
              </Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="vous@entreprise.mg"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: undefined }))
                }}
                className="bg-slate-50 placeholder:text-slate-400"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="signup-email-error" className="text-sm text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-slate-700 font-medium text-sm">
                Mot de passe
              </Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined }))
                }}
                className="bg-slate-50 placeholder:text-slate-400"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
              />
              {fieldErrors.password ? (
                <p id="signup-password-error" className="text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Au moins {MIN_PASSWORD} caractères</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm" className="text-slate-700 font-medium text-sm">
                Confirmer le mot de passe
              </Label>
              <Input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value)
                  if (fieldErrors.confirmPassword) setFieldErrors(f => ({ ...f, confirmPassword: undefined }))
                }}
                className="bg-slate-50 placeholder:text-slate-400"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'signup-confirm-error' : undefined}
              />
              {fieldErrors.confirmPassword && (
                <p id="signup-confirm-error" className="text-sm text-red-600">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md transition-all duration-200 shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Inscription…
                </>
              ) : (
                'Créer mon compte'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
