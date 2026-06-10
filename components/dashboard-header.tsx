"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { CalendarHeart, LogOut, LayoutGrid } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const supabase = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createBrowserClient(url, key) : null
  })()

  const handleSignOut = async () => {
    if (!supabase) { router.push("/"); return }
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast({ variant: "destructive", title: "Sign Out Error", description: "Error signing out" })
    } else {
      toast({ title: "Signed out" })
      router.push("/")
    }
  }

  const navLink = (href: string, label: string, icon?: React.ReactNode) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors",
        pathname === href
          ? "bg-gray-100 text-gray-900 font-medium"
          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      {icon}{label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-50 px-6 h-14 flex items-center border-b bg-white gap-6">
      <Link className="flex items-center gap-2 mr-2" href="/dashboard">
        <CalendarHeart className="h-5 w-5 text-rose-400" />
        <span className="font-semibold text-gray-900">Wedding Planner</span>
      </Link>
      <nav className="flex items-center gap-1">
        {navLink("/dashboard", "Wedding Plan")}
        {navLink("/planner", "Seating Planner", <LayoutGrid className="h-3.5 w-3.5" />)}
      </nav>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-gray-500">
          <LogOut className="h-4 w-4 mr-1.5" />
          Sign Out
        </Button>
      </div>
    </header>
  )
}
