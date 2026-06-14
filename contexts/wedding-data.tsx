"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import type { ChecklistItem, BudgetItem, Milestone, UserProfile, GeneratedPlan } from "@/types/dashboard"

const isDev = process.env.NODE_ENV === "development"

interface WeddingDataContextType {
  loading: boolean
  profile: UserProfile | null
  checklist: ChecklistItem[]
  budget: BudgetItem[]
  milestones: Milestone[]
  toggleChecklist: (id: string, done: boolean) => Promise<void>
  updateChecklist: (id: string, updates: Partial<ChecklistItem>) => Promise<void>
  updateBudget: (id: string, updates: Partial<BudgetItem>) => Promise<void>
  toggleMilestone: (id: string, done: boolean) => Promise<void>
  updateMilestone: (id: string, updates: Partial<Milestone>) => Promise<void>
}

const WeddingDataContext = createContext<WeddingDataContextType | null>(null)

export function WeddingDataProvider({ children }: { children: ReactNode }) {
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

  const toggleChecklist = async (id: string, done: boolean) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, is_completed: done } : i))
    if (supabase && userId) await supabase.from("checklist_items").update({ is_completed: done }).eq("id", id)
  }
  const updateChecklist = async (id: string, updates: Partial<ChecklistItem>) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (supabase && userId) await supabase.from("checklist_items").update(updates).eq("id", id)
  }
  const updateBudget = async (id: string, updates: Partial<BudgetItem>) => {
    setBudget(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    if (supabase && userId) await supabase.from("budget_items").update(updates).eq("id", id)
  }
  const toggleMilestone = async (id: string, done: boolean) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, is_completed: done } : m))
    if (supabase && userId) await supabase.from("milestones").update({ is_completed: done }).eq("id", id)
  }
  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    if (supabase && userId) await supabase.from("milestones").update(updates).eq("id", id)
  }

  return (
    <WeddingDataContext.Provider value={{
      loading, profile, checklist, budget, milestones,
      toggleChecklist, updateChecklist, updateBudget, toggleMilestone, updateMilestone,
    }}>
      {children}
    </WeddingDataContext.Provider>
  )
}

export function useWeddingData() {
  const ctx = useContext(WeddingDataContext)
  if (!ctx) throw new Error("useWeddingData must be used within WeddingDataProvider")
  return ctx
}
