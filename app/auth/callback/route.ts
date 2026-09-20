import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  // Where a signed-in user should land. New users see onboarding first; anyone
  // who has already completed it goes straight to the dashboard.
  let destination = "/login"

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      destination = "/onboarding"
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("id", data.session.user.id)
        .maybeSingle()
      if (profile?.onboarding_completed) destination = "/dashboard"
    }
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
