'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

type UserContextValue = {
  user: User | null
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

/**
 * Single Supabase auth subscription for the whole app.
 * Avoids concurrent getUser() calls (e.g. one per ProductCard) which trigger
 * "Lock ... was released because another request stole it" in the browser client.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let loadSeq = 0

    async function applySession(session: Session | null) {
      const seq = ++loadSeq
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (!cancelled && seq === loadSeq) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single()

      if (cancelled || seq !== loadSeq) return
      if (error) {
        setUser(null)
        setLoading(false)
        return
      }
      setUser(data)
      setLoading(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ user, loading }), [user, loading])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (ctx === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return ctx
}
