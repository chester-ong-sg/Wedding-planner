import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession()

  // If accessing /planner and not authenticated, redirect to login
  if (request.nextUrl.pathname.startsWith('/planner')) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If accessing /login or /register while authenticated, redirect to planner
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register') && session) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/planner'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/', '/login', '/register', '/planner', '/planner/:path*'],
} 