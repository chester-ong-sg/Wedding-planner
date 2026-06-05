"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/lib/supabase-provider"
import { Button } from "@/components/ui/button"
import { CalendarHeart, LogOut } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function Header() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: "Error signing out",
      })
    } else {
      toast({
        title: "Success",
        description: "Signed out successfully",
      })
      router.push("/")
    }
  }

  return (
    <header className="sticky top-0 z-50 px-4 lg:px-6 h-16 flex items-center border-b bg-background">
      <Link className="flex items-center justify-center" href="/">
        <CalendarHeart className="h-6 w-6 mr-2" />
        <span className="font-bold">Wedding Planner</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </nav>
    </header>
  )
}

