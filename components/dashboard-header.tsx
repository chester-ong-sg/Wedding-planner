"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { CalendarHeart, LogOut, LayoutGrid, Flag, ListChecks, Wallet } from "lucide-react"
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

  const navLink = (href: string, label: string, icon?: React.ReactNode) => {
    const isActive = pathname === href
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors",
          isActive
            ? "bg-brand-gold-muted text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        {icon}{label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 px-6 h-14 flex items-center border-b bg-white gap-4">
      <Link className="flex items-center gap-2 mr-2 shrink-0" href="/dashboard">
        <CalendarHeart className="h-5 w-5 text-brand-rose" />
        <span className="font-semibold text-foreground hidden sm:block">Wedding Planner</span>
      </Link>
      <nav className="flex items-center gap-0.5 overflow-x-auto">
        {navLink("/dashboard", "Overview")}
        {navLink("/dashboard/milestones", "Milestones", <Flag className="h-3.5 w-3.5" />)}
        {navLink("/dashboard/checklist", "Checklist", <ListChecks className="h-3.5 w-3.5" />)}
        {navLink("/dashboard/budget", "Budget", <Wallet className="h-3.5 w-3.5" />)}
        {navLink("/planner", "Seating", <LayoutGrid className="h-3.5 w-3.5" />)}
      </nav>
      <div className="ml-auto shrink-0">
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:block">Sign Out</span>
        </Button>
      </div>
    </header>
  )
}
