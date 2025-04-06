import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Handle authentication redirects
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register')
  const isPlannerPage = req.nextUrl.pathname.startsWith('/planner')

  if (isAuthPage && session) {
    // If user is logged in and tries to access auth pages, redirect to planner
    return NextResponse.redirect(new URL('/planner', req.url))
  }

  if (isPlannerPage && !session) {
    // If user is not logged in and tries to access planner, redirect to login
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Allow all other routes to continue
  return res
}

export const config = {
  matcher: ['/planner/:path*', '/login', '/register'],
} 