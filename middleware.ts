import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request)

  if (supabase) {
    // Refresh session if expired — keep cookies in sync
    await supabase.auth.getSession()
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/', '/login', '/register', '/planner', '/planner/:path*'],
}
