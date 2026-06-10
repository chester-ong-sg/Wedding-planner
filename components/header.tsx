"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/lib/supabase-provider"
import { Button } from "@/components/ui/button"
import { CalendarHeart, LogOut, ArrowLeft } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function Header() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()

  const handleSignOut = async () => {
    if (!supabase) { router.push("/"); return }
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast({ variant: "destructive", title: "Sign Out Error", description: "Error signing out" })
    } else {
      toast({ title: "Success", description: "Signed out successfully" })
      router.push("/")
    }
  }

  return (
    <header className="sticky top-0 z-50 px-4 lg:px-6 h-14 flex items-center border-b bg-background gap-4">
      <Link className="flex items-center gap-2" href="/dashboard">
        <CalendarHeart className="h-5 w-5 text-rose-400" />
        <span className="font-semibold">Wedding Planner</span>
      </Link>
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-gray-500">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </nav>
    </header>
  )
}

