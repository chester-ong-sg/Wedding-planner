"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        router.push('/login')
        return
      }
    }

    checkAuth()

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  if (!isClient) {
    return null
  }

  return <>{children}</>
} 