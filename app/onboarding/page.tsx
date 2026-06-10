"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarHeart, ChevronRight, Calendar as CalendarIcon, Heart, Check, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"

type Step = "date" | "guests" | "type" | "loading" | "done"

// Themed steps shown one-by-one with a tick as the plan generates.
const GEN_STEPS = [
  "Checking auspicious dates (择日)",
  "Planning your tea ceremony (敬茶)",
  "Building your month-by-month checklist",
  "Working out your SGD budget",
  "Adding gate-crash games (闯门)",
  "Listing what to bring on the day",
  "Finalising your key milestones",
]

// How long each step "takes" before ticking over. The last step holds in
// progress until the real API response actually arrives.
const STEP_INTERVAL_MS = 7000

const isDev = process.env.NODE_ENV === "development"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("date")
  const [weddingDate, setWeddingDate] = useState("")
  const [guestCount, setGuestCount] = useState(120)
  const [weddingType, setWeddingType] = useState<WeddingType | "">("")
  const [completedSteps, setCompletedSteps] = useState(0)
  const [genComplete, setGenComplete] = useState(false)
  const [error, setError] = useState("")

  const supabase = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createBrowserClient(url, key) : null
  })()

  // Redirect if already completed onboarding
  useEffect(() => {
    if (isDev) return
    const check = async () => {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push("/login"); return }
      const { data } = await supabase.from("user_profiles").select("onboarding_completed").eq("id", session.user.id).single()
      if (data?.onboarding_completed) router.push("/dashboard")
    }
    check()
  }, []) // eslint-disable-line

  // Advance the generation checklist one step at a time. The last step stays
  // "in progress" (capped) until genComplete flips it — so we never show the
  // whole thing as done before the real plan has come back.
  useEffect(() => {
    if (step !== "loading" || genComplete) return
    const interval = setInterval(() => {
      setCompletedSteps(prev => Math.min(prev + 1, GEN_STEPS.length - 1))
    }, STEP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [step, genComplete])

  const saveToSupabase = async (plan: GeneratedPlan, userId: string) => {
    if (!supabase) return

    // Upsert profile
    await supabase.from("user_profiles").upsert({
      id: userId,
      wedding_date: weddingDate,
      guest_count: guestCount,
      wedding_type: weddingType,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })

    // Insert checklist items
    const checklistRows = plan.checklist.flatMap((group, gi) =>
      group.tasks.map((t, ti) => ({
        user_id: userId,
        month_label: group.month_label,
        task: t.task,
        category: t.category ?? null,
        notes: t.notes ?? null,
        sort_order: gi * 100 + ti,
      }))
    )
    if (checklistRows.length) await supabase.from("checklist_items").insert(checklistRows)

    // Insert budget items
    const budgetRows = plan.budget.flatMap((group, gi) =>
      group.items.map((item, ii) => ({
        user_id: userId,
        category: group.category,
        item_name: item.item_name,
        estimated_amount: item.estimated_amount,
        notes: item.notes ?? null,
        sort_order: gi * 100 + ii,
      }))
    )
    if (budgetRows.length) await supabase.from("budget_items").insert(budgetRows)

    // Insert milestones
    const milestoneRows = plan.milestones.map((m, i) => ({
      user_id: userId,
      title: m.title,
      due_date: m.due_date,
      description: m.description,
      sort_order: i,
    }))
    if (milestoneRows.length) await supabase.from("milestones").insert(milestoneRows)
  }

  // Tick every remaining step to done, hold a beat so the final check is
  // visible, then continue.
  const finishSteps = async () => {
    setGenComplete(true)
    setCompletedSteps(GEN_STEPS.length)
    await new Promise(r => setTimeout(r, 900))
  }

  const handleGenerate = async () => {
    if (!weddingType) return
    setCompletedSteps(0)
    setGenComplete(false)
    setStep("loading")
    setError("")

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weddingDate, guestCount, weddingType }),
      })
      const { plan, error: apiErr } = await res.json()
      if (apiErr || !plan) throw new Error(apiErr ?? "No plan returned")

      if (isDev) {
        // Dev mode — persist to localStorage so the flow works without auth or
        // the Supabase tables. (The Anthropic key is server-side and unaffected.)
        localStorage.setItem("dev_wedding_plan", JSON.stringify(plan))
        localStorage.setItem("dev_onboarding", JSON.stringify({ weddingDate, guestCount, weddingType }))
        await finishSteps()
        setStep("done")
        router.push("/dashboard")
        return
      }

      const { data: { session } } = await supabase!.auth.getSession()
      if (!session) { router.push("/login"); return }
      await saveToSupabase(plan, session.user.id)
      await finishSteps()
      setStep("done")
      router.push("/dashboard")
    } catch (err) {
      console.error(err)
      setError("Something went wrong generating your plan. Please try again.")
      setStep("type")
    }
  }

  // ─── Slides ──────────────────────────────────────────────────────────────

  if (step === "loading" || step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-10 px-6">
        <div className="flex flex-col items-center gap-3">
          <CalendarHeart className="h-11 w-11 text-rose-400 animate-pulse" />
          <h2 className="text-2xl font-semibold text-gray-900">Generating your wedding plan…</h2>
          <p className="text-gray-500 text-sm">Personalising everything for your Singapore wedding</p>
        </div>

        <ul className="flex flex-col gap-3 w-full max-w-sm">
          {GEN_STEPS.map((label, i) => {
            const done = i < completedSteps
            const active = i === completedSteps && !genComplete
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
                  done && "border-emerald-200 bg-emerald-50/60",
                  active && "border-rose-200 bg-rose-50/60",
                  !done && !active && "border-gray-100 bg-white"
                )}
              >
                <span className="shrink-0">
                  {done ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 animate-in zoom-in duration-200">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                  ) : active ? (
                    <Loader2 className="h-6 w-6 text-rose-400 animate-spin" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-200" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    done ? "text-gray-900 font-medium" : active ? "text-gray-900" : "text-gray-400"
                  )}
                >
                  {label}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-rose-400 transition-all duration-500"
          style={{ width: step === "date" ? "33%" : step === "guests" ? "66%" : "100%" }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-20 pb-12 sm:pt-28">
        <CalendarHeart className="h-9 w-9 text-rose-400 mb-8" />

        {/* Step 1 — Wedding Date */}
        {step === "date" && (
          <SlideWrapper>
            <StepLabel>Step 1 of 3</StepLabel>
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">When is your wedding?</h1>
            <p className="text-gray-500 mb-8">We'll build your checklist around this date.</p>
            <DatePicker value={weddingDate} onChange={setWeddingDate} />
            <Button
              size="lg"
              className="bg-gray-900 hover:bg-gray-700 px-8 mt-8"
              disabled={!weddingDate}
              onClick={() => setStep("guests")}
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </SlideWrapper>
        )}

        {/* Step 2 — Guest Count */}
        {step === "guests" && (
          <SlideWrapper>
            <StepLabel>Step 2 of 3</StepLabel>
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">How many guests?</h1>
            <p className="text-gray-500 mb-8">This helps us estimate your budget and seating.</p>
            <div className="flex items-center gap-4 mb-8">
              <button
                className="h-10 w-10 rounded-full border border-gray-300 text-xl hover:bg-gray-50 flex items-center justify-center"
                onClick={() => setGuestCount(Math.max(10, guestCount - 10))}
              >−</button>
              <Input
                type="number"
                className="w-28 text-center text-2xl font-semibold h-14 border-gray-300"
                value={guestCount}
                min={10}
                max={2000}
                onChange={e => setGuestCount(Math.max(10, parseInt(e.target.value) || 10))}
              />
              <button
                className="h-10 w-10 rounded-full border border-gray-300 text-xl hover:bg-gray-50 flex items-center justify-center"
                onClick={() => setGuestCount(Math.min(2000, guestCount + 10))}
              >+</button>
            </div>
            <div className="flex gap-3 mb-8">
              {[60, 120, 200, 300].map(n => (
                <button
                  key={n}
                  onClick={() => setGuestCount(n)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors",
                    guestCount === n ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 hover:bg-gray-50"
                  )}
                >{n}</button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep("date")}>Back</Button>
              <Button size="lg" className="bg-gray-900 hover:bg-gray-700 px-8" onClick={() => setStep("type")}>
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </SlideWrapper>
        )}

        {/* Step 3 — Wedding Type */}
        {step === "type" && (
          <SlideWrapper>
            <StepLabel>Step 3 of 3</StepLabel>
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">What are you planning?</h1>
            <p className="text-gray-500 mb-8">We'll include the right customs and timeline for your celebration.</p>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex flex-col gap-4 w-full max-w-sm mb-8">
              {([
                { value: "rom_only", label: "ROM Only", desc: "Civil solemnization at ROM — no banquet", icon: "📋" },
                { value: "banquet_only", label: "Banquet Only", desc: "Restaurant or hotel banquet celebration", icon: "🥂" },
                { value: "rom_and_banquet", label: "ROM + Banquet", desc: "Full traditional Singapore Chinese wedding", icon: "🏮" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWeddingType(opt.value)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                    weddingType === opt.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{opt.label}</div>
                    <div className="text-sm text-gray-500">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep("guests")}>Back</Button>
              <Button
                size="lg"
                className="bg-gray-900 hover:bg-gray-700 px-8"
                disabled={!weddingType}
                onClick={handleGenerate}
              >
                Generate My Plan <Heart className="ml-2 h-4 w-4 fill-current" />
              </Button>
            </div>
          </SlideWrapper>
        )}
      </div>
    </div>
  )
}

function SlideWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
      {children}
    </div>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-widest text-rose-400 font-semibold mb-4">{children}</p>
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisYear = today.getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 text-lg font-medium transition-all min-w-[280px] justify-between",
            selected
              ? "border-gray-900 bg-gray-50 text-gray-900"
              : "border-gray-200 text-gray-400 hover:border-gray-400"
          )}
        >
          <CalendarIcon className="h-5 w-5 shrink-0 text-rose-400" />
          <span className="flex-1 text-left">
            {selected ? format(selected, "EEEE, d MMMM yyyy") : "Pick your wedding date"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-3xl shadow-2xl border border-gray-100 overflow-y-auto max-h-[var(--radix-popover-content-available-height)]"
        align="center"
        side="bottom"
        sideOffset={12}
        avoidCollisions={false}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={date => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"))
              setOpen(false)
            }
          }}
          captionLayout="dropdown-buttons"
          fromYear={thisYear}
          toYear={thisYear + 6}
          numberOfMonths={2}
          defaultMonth={selected ?? new Date(thisYear + 1, today.getMonth())}
          disabled={date => date < today}
          initialFocus
          classNames={{
            months: "flex flex-col sm:flex-row gap-6 p-6",
            month: "space-y-4",
            caption: "relative flex items-center justify-center h-9",
            caption_dropdowns: "flex items-center gap-2",
            caption_label: "hidden",
            vhidden: "hidden",
            dropdown: "appearance-none bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300 transition-colors",
            dropdown_month: "relative",
            dropdown_year: "relative",
            nav: "flex items-center",
            nav_button: "h-8 w-8 bg-transparent p-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors",
            nav_button_previous: "absolute left-0 top-0",
            nav_button_next: "absolute right-0 top-0",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-gray-400 w-10 font-medium text-xs flex-1 text-center pb-2",
            row: "flex w-full mt-1.5",
            cell: "flex-1 text-center text-sm relative p-0",
            day: "h-10 w-10 p-0 font-normal text-gray-700 rounded-full hover:bg-rose-50 hover:text-rose-600 mx-auto flex items-center justify-center transition-colors",
            day_selected: "!bg-gray-900 !text-white hover:!bg-gray-900 rounded-full font-semibold",
            day_today: "border border-rose-300 text-rose-500 font-semibold",
            day_outside: "text-gray-300",
            day_disabled: "text-gray-200 cursor-not-allowed hover:bg-transparent hover:text-gray-200",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
