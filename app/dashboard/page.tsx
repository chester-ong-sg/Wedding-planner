"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useWeddingData } from "@/contexts/wedding-data"
import { Checkbox } from "@/components/ui/checkbox"
import { JUST_ONBOARDED_KEY } from "@/lib/wedding-plan/save-plan"
import { placeholderGuestCount } from "@/lib/wedding-plan/placeholder-guests"
import { Flag, ListChecks, Wallet, LayoutGrid, ArrowRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

function weddingTypeLabel(t: string | null) {
  if (t === "rom_only") return "ROM Only"
  if (t === "banquet_only") return "Banquet Only"
  if (t === "rom_and_banquet") return "ROM + Banquet"
  return ""
}

export default function DashboardPage() {
  const { loading, profile, checklist, budget, milestones, toggleChecklist } = useWeddingData()

  // One-time welcome, set by onboarding just before it redirects here.
  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    try {
      if (sessionStorage.getItem(JUST_ONBOARDED_KEY)) {
        sessionStorage.removeItem(JUST_ONBOARDED_KEY)
        setShowWelcome(true)
      }
    } catch { /* storage blocked — the welcome is optional */ }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const weddingDate = profile?.wedding_date
  const daysLeft = weddingDate
    ? Math.round((new Date(weddingDate).getTime() - Date.now()) / 86400000)
    : null

  // Milestones summary
  const upcomingMilestone = [...milestones]
    .filter(m => !m.is_completed && m.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0]
  const milestonesCompleted = milestones.filter(m => m.is_completed).length

  // Checklist summary
  const checklistDone = checklist.filter(i => i.is_completed).length
  const checklistPct = checklist.length ? Math.round((checklistDone / checklist.length) * 100) : 0

  // Budget summary
  const totalEstimated = budget.reduce((s, i) => s + (i.estimated_amount ?? 0), 0)
  const totalActual = budget.reduce((s, i) => s + (i.actual_amount ?? 0), 0)
  const fmt = (n: number) => `$${n.toLocaleString("en-SG")}`

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })

  const daysUntil = (d: string) => {
    const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000)
    if (diff < 0) return "Overdue"
    if (diff === 0) return "Today"
    return `${diff}d away`
  }

  // Onboarding seeds one placeholder guest per expected guest (capped).
  const seededGuests = placeholderGuestCount(profile?.guest_count ?? 0)

  // First few tasks still to do, in plan order — so the plan is visible on landing.
  const upNext = [...checklist]
    .filter(i => !i.is_completed)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* First-arrival welcome */}
      {showWelcome && (
        <div className="mb-8 flex items-start gap-4 rounded-2xl border border-[hsl(38,40%,84%)] bg-brand-gold-muted p-5">
          <span className="text-3xl leading-none text-brand-rose select-none" aria-hidden="true">囍</span>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Your plan is ready.</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {checklist.length} tasks, {milestones.length} milestones and a {fmt(totalEstimated)} budget, all built around
              your date. Start with the tasks below. Everything is editable.
              {seededGuests > 0 && (
                <> We&apos;ve also put {seededGuests} placeholder guests in your <Link href="/planner" className="underline underline-offset-2 hover:text-foreground">Seating planner</Link> — rename them as your list firms up.</>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss welcome message"
            onClick={() => setShowWelcome(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero strip */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-foreground">Your Wedding Plan</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
          {weddingDate && (
            <span>{new Date(weddingDate).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</span>
          )}
          {profile?.guest_count && <span>· {profile.guest_count} guests</span>}
          {profile?.wedding_type && <span>· {weddingTypeLabel(profile.wedding_type)}</span>}
          {daysLeft !== null && (
            <span
              className={cn(
                "font-semibold",
                daysLeft <= 30 ? "text-brand-rose" : "text-primary"
              )}
            >
              · {daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? "Today! 🎉" : "The big day has passed 🎊"}
            </span>
          )}
        </div>
      </div>

      {/* Countdown strip — amber gold */}
      {daysLeft !== null && daysLeft > 0 && weddingDate && (
        <div className="mb-10 p-6 rounded-2xl bg-brand-gold-muted border border-[hsl(38,40%,84%)]">
          <div className="flex items-end justify-between mb-3">
            <span className="text-sm font-medium text-primary/80">Time until your wedding</span>
            <span className="text-3xl font-bold text-primary">{daysLeft} days</span>
          </div>
          <div className="h-2 bg-[hsl(38,40%,86%)] rounded-full overflow-hidden">
            {(() => {
              const totalDays = 365
              const pct = Math.max(0, Math.min(100, 100 - (daysLeft / totalDays) * 100))
              return <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            })()}
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-primary/60">
            <span>Today</span>
            <span>{formatDate(weddingDate)}</span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Milestones */}
        <Link href="/dashboard/milestones" className="group block p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-brand-rose-muted rounded-xl">
              <Flag className="h-5 w-5 text-brand-rose" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Key Milestones</p>
          <p className="text-xs text-muted-foreground mb-3">
            {milestonesCompleted} of {milestones.length} completed
          </p>
          {upcomingMilestone ? (
            <div className="text-xs bg-secondary rounded-lg px-3 py-2">
              <p className="text-muted-foreground truncate">{upcomingMilestone.title}</p>
              <p className={cn(
                "font-medium mt-0.5",
                upcomingMilestone.due_date && daysUntil(upcomingMilestone.due_date) === "Overdue"
                  ? "text-destructive"
                  : "text-brand-rose"
              )}>
                {upcomingMilestone.due_date ? daysUntil(upcomingMilestone.due_date) : ""}
              </p>
            </div>
          ) : (
            <p className="text-xs text-green-600 font-medium">All done!</p>
          )}
        </Link>

        {/* Checklist */}
        <Link href="/dashboard/checklist" className="group block p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <ListChecks className="h-5 w-5 text-blue-500" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Wedding Checklist</p>
          <p className="text-xs text-muted-foreground mb-3">
            {checklistDone} of {checklist.length} tasks done
          </p>
          <div className="space-y-1.5">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${checklistPct}%` }}
              />
            </div>
            <p className="text-xs text-blue-500 font-medium">{checklistPct}% complete</p>
          </div>
        </Link>

        {/* Budget */}
        <Link href="/dashboard/budget" className="group block p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-green-50 rounded-xl">
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Budget</p>
          <p className="text-xs text-muted-foreground mb-3">Estimated total</p>
          <p className="text-lg font-bold text-foreground">{fmt(totalEstimated)}</p>
          {totalActual > 0 && (
            <p className={cn("text-xs font-medium mt-0.5", totalActual > totalEstimated ? "text-destructive" : "text-green-600")}>
              {fmt(totalActual)} actual
            </p>
          )}
        </Link>

        {/* Seating */}
        <Link href="/planner" className="group block p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded-xl">
              <LayoutGrid className="h-5 w-5 text-purple-500" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Seating Planner</p>
          <p className="text-xs text-muted-foreground">
            Arrange guests across tables
          </p>
        </Link>
      </div>

      {/* Up next */}
      {upNext.length > 0 && (
        <section className="mt-10" aria-labelledby="up-next-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="up-next-heading" className="text-lg font-semibold text-foreground">Up next</h2>
            <Link href="/dashboard/checklist" className="text-sm text-primary hover:underline underline-offset-4">
              See the full checklist
            </Link>
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {upNext.map(item => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                <Checkbox
                  id={`next-${item.id}`}
                  className="mt-0.5"
                  checked={item.is_completed}
                  onCheckedChange={checked => toggleChecklist(item.id, !!checked)}
                />
                <label htmlFor={`next-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm text-foreground">{item.task}</span>
                  {item.notes && <span className="mt-0.5 block text-xs text-muted-foreground">{item.notes}</span>}
                </label>
                <span className="shrink-0 text-xs text-muted-foreground">{item.month_label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
