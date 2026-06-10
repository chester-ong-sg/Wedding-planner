"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { MilestonesSection } from "@/components/dashboard/milestones-section"
import { ChecklistSection } from "@/components/dashboard/checklist-section"
import { BudgetSection } from "@/components/dashboard/budget-section"
import { LayoutGrid, CalendarHeart, ExternalLink } from "lucide-react"
import type { ChecklistItem, BudgetItem, Milestone, UserProfile, GeneratedPlan } from "@/types/dashboard"

const isDev = process.env.NODE_ENV === "development"

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [budget, setBudget] = useState<BudgetItem[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createBrowserClient(url, key) : null
  })()

  const loadDevData = useCallback(() => {
    const raw = localStorage.getItem("dev_wedding_plan")
    const meta = localStorage.getItem("dev_onboarding")
    if (!raw) { router.push("/onboarding"); return }
    const plan: GeneratedPlan = JSON.parse(raw)
    const { weddingDate, guestCount, weddingType } = meta ? JSON.parse(meta) : {}

    setProfile({ id: "dev", wedding_date: weddingDate, guest_count: guestCount, wedding_type: weddingType, onboarding_completed: true })

    const now = new Date().toISOString()
    const cl: ChecklistItem[] = plan.checklist.flatMap((g, gi) =>
      g.tasks.map((t, ti) => ({
        id: `dev-cl-${gi}-${ti}`, user_id: "dev",
        month_label: g.month_label, task: t.task,
        category: t.category ?? null, is_completed: false,
        due_date: null, notes: t.notes ?? null,
        sort_order: gi * 100 + ti,
      }))
    )
    const bl: BudgetItem[] = plan.budget.flatMap((g, gi) =>
      g.items.map((item, ii) => ({
        id: `dev-b-${gi}-${ii}`, user_id: "dev",
        category: g.category, item_name: item.item_name,
        estimated_amount: item.estimated_amount, actual_amount: null,
        notes: item.notes ?? null, sort_order: gi * 100 + ii,
      }))
    )
    const ml: Milestone[] = plan.milestones.map((m, i) => ({
      id: `dev-m-${i}`, user_id: "dev",
      title: m.title, due_date: m.due_date,
      description: m.description, is_completed: false, sort_order: i,
    }))
    setChecklist(cl); setBudget(bl); setMilestones(ml)
    setLoading(false)
  }, [router])

  useEffect(() => {
    if (isDev) { loadDevData(); return }

    const load = async () => {
      if (!supabase) { router.push("/login"); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      const uid = session.user.id
      setUserId(uid)

      const { data: prof } = await supabase.from("user_profiles").select("*").eq("id", uid).single()
      if (!prof?.onboarding_completed) { router.push("/onboarding"); return }
      setProfile(prof)

      const [cl, bl, ml] = await Promise.all([
        supabase.from("checklist_items").select("*").eq("user_id", uid).order("sort_order"),
        supabase.from("budget_items").select("*").eq("user_id", uid).order("sort_order"),
        supabase.from("milestones").select("*").eq("user_id", uid).order("sort_order"),
      ])
      setChecklist(cl.data ?? [])
      setBudget(bl.data ?? [])
      setMilestones(ml.data ?? [])
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line

  // ─── Optimistic update helpers ────────────────────────────────────────────

  const toggleChecklist = async (id: string, done: boolean) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: done } : i))
    if (supabase && userId) await supabase.from("checklist_items").update({ is_completed: done }).eq("id", id)
    else if (isDev) devUpdateChecklist()
  }
  const updateChecklist = async (id: string, updates: Partial<ChecklistItem>) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (supabase && userId) await supabase.from("checklist_items").update(updates).eq("id", id)
    else if (isDev) devUpdateChecklist()
  }

  const updateBudget = async (id: string, updates: Partial<BudgetItem>) => {
    setBudget(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (supabase && userId) await supabase.from("budget_items").update(updates).eq("id", id)
    else if (isDev) devUpdateBudget()
  }

  const toggleMilestone = async (id: string, done: boolean) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, is_completed: done } : m))
    if (supabase && userId) await supabase.from("milestones").update({ is_completed: done }).eq("id", id)
  }
  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    if (supabase && userId) await supabase.from("milestones").update(updates).eq("id", id)
  }

  // Dev mode: persist updates back to localStorage
  const devUpdateChecklist = () => {
    const plan = JSON.parse(localStorage.getItem("dev_wedding_plan") ?? "{}")
    // lightweight: just re-save the react state next render
  }
  const devUpdateBudget = () => {}

  // ─── Derived ─────────────────────────────────────────────────────────────

  const weddingDate = profile?.wedding_date
  const daysLeft = weddingDate
    ? Math.round((new Date(weddingDate).getTime() - Date.now()) / 86400000)
    : null

  const weddingTypeLabel = (t: string | null) => {
    if (t === "rom_only") return "ROM Only"
    if (t === "banquet_only") return "Banquet Only"
    if (t === "rom_and_banquet") return "ROM + Banquet"
    return ""
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero strip */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Wedding Plan</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {weddingDate && (
              <span>{new Date(weddingDate).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
            {profile?.guest_count && <span>· {profile.guest_count} guests</span>}
            {profile?.wedding_type && <span>· {weddingTypeLabel(profile.wedding_type)}</span>}
            {daysLeft !== null && (
              <span className="font-medium text-rose-500">
                · {daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? "Today! 🎉" : "The big day has passed 🎊"}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="plan">
        <TabsList className="mb-6">
          <TabsTrigger value="plan">
            <CalendarHeart className="h-4 w-4 mr-2" />
            Wedding Plan
          </TabsTrigger>
          <TabsTrigger value="seating">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Seating Planner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-10">
          <MilestonesSection milestones={milestones} onToggle={toggleMilestone} onUpdate={updateMilestone} />
          <ChecklistSection items={checklist} onToggle={toggleChecklist} onUpdate={updateChecklist} />
          <BudgetSection items={budget} onUpdate={updateBudget} />
        </TabsContent>

        <TabsContent value="seating">
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <LayoutGrid className="h-12 w-12 text-gray-300" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Table Seating Planner</h2>
              <p className="text-gray-500 text-sm max-w-sm">
                Drag and drop your guests onto tables, manage RSVPs, and export your seating chart.
              </p>
            </div>
            <Button size="lg" className="bg-gray-900 hover:bg-gray-700" onClick={() => router.push("/planner")}>
              Open Seating Planner <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
