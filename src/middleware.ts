import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function safeInternalPath(raw: string | null, fallback = '/'): string {
  if (raw == null || raw === '') return fallback
  const s = raw.trim()
  if (!s.startsWith('/') || s.startsWith('//')) return fallback
  if (s.includes('://')) return fallback
  return s
}

function postAuthRedirectTarget(raw: string | null): string {
  const s = safeInternalPath(raw, '/')
  if (s === '/login' || s === '/signup') return '/'
  return s
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/products') return true
  if (pathname.startsWith('/product/')) return true
  if (pathname === '/login' || pathname === '/signup') return true
  return false
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url)
    const nextPath = pathname + request.nextUrl.search
    loginUrl.searchParams.set('next', nextPath)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage) {
    const next = request.nextUrl.searchParams.get('next')
    const dest = postAuthRedirectTarget(next)
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
