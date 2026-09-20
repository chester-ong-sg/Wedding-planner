"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DatePicker } from "@/components/onboarding/date-picker"
import { GeneratingScreen } from "@/components/onboarding/generating-screen"
import { JUST_ONBOARDED_KEY, saveDevPlan, savePlanToSupabase } from "@/lib/wedding-plan/save-plan"
import { MAX_STORY_LENGTH } from "@/lib/wedding-plan/limits"
import { cn } from "@/lib/utils"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"

type Step = "date" | "guests" | "type" | "story" | "generating"

const STEP_ORDER: Step[] = ["date", "guests", "type", "story"]

/** From this many characters the counter turns from muted to a warning colour. */
const STORY_WARN_AT = 450

/** The generating screen is always shown for at least this long, so it feels considered. */
const MIN_GENERATING_MS = 2000
/** Brief pause on "Your plan is ready" before moving on. */
const READY_BEAT_MS = 600

const MIN_GUESTS = 1
const MAX_GUESTS = 2000
const GUEST_PRESETS = [50, 100, 150, 200, 300]

const isDev = process.env.NODE_ENV === "development"

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const WEDDING_TYPES: { value: WeddingType; label: string; desc: string }[] = [
  { value: "rom_only", label: "ROM only", desc: "Solemnisation at the Registry of Marriages. No banquet." },
  { value: "banquet_only", label: "Banquet only", desc: "A hotel or restaurant banquet, no separate ROM day." },
  { value: "rom_and_banquet", label: "ROM + Banquet", desc: "The full works: ROM, tea ceremony, gate-crash and banquet." },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("date")
  const [weddingDate, setWeddingDate] = useState("")
  const [guestText, setGuestText] = useState("150")
  const [weddingType, setWeddingType] = useState<WeddingType | "">("")
  const [story, setStory] = useState("")
  // Whether the plan being generated is personalised (drives the loading copy).
  const [personalised, setPersonalised] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  const guestCount = parseInt(guestText, 10)
  const guestsValid = Number.isInteger(guestCount) && guestCount >= MIN_GUESTS && guestCount <= MAX_GUESTS

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return url && key ? createBrowserClient(url, key) : null
  }, [])

  // Onboarding shows once: if this user has already finished it, go straight to
  // the dashboard. (Dev mode has no auth, so it always allows a re-run.)
  useEffect(() => {
    if (isDev) return
    const check = async () => {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      const { data } = await supabase
        .from("user_profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .maybeSingle()
      if (data?.onboarding_completed) router.replace("/dashboard")
    }
    check()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Ask the API for a plan, then persist it. Throws on any failure. */
  const generateAndSave = async (storyText: string) => {
    const answers = { weddingDate, guestCount, weddingType: weddingType as WeddingType }

    // `story` is only sent when the couple wrote one: no text means no AI call.
    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storyText ? { ...answers, story: storyText } : answers),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.plan) throw new Error(json.error ?? "No plan returned")
    const plan: GeneratedPlan = json.plan

    if (isDev) {
      saveDevPlan(plan, answers)
      return
    }

    if (!supabase) throw new Error("no-supabase")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error("no-session")

    const result = await savePlanToSupabase(supabase, session.user.id, plan, answers)
    if (!result.ok) throw new Error(result.error)
  }

  /** `skip` ignores whatever is in the box and asks for the standard plan. */
  const handleGenerate = async ({ skip = false } = {}) => {
    if (!weddingType || !guestsValid || !weddingDate || step === "generating") return
    const storyText = skip ? "" : story.trim()
    setError("")
    setReady(false)
    setPersonalised(storyText.length > 0)
    setStep("generating")

    try {
      // Whichever is slower wins: the real work, or the 2s minimum.
      await Promise.all([generateAndSave(storyText), wait(MIN_GENERATING_MS)])
      setReady(true)
      await wait(READY_BEAT_MS)
      try { sessionStorage.setItem(JUST_ONBOARDED_KEY, "1") } catch { /* private mode — banner is optional */ }
      router.replace("/dashboard")
    } catch (err) {
      console.error("Onboarding failed:", err)
      const message = err instanceof Error ? err.message : ""
      if (message === "no-session") { router.replace("/login"); return }
      if (message === "already-onboarded") { router.replace("/dashboard"); return }
      setError("Something went wrong putting your plan together. Nothing was lost — please try again.")
      setStep("story")
    }
  }

  if (step === "generating") return <GeneratingScreen ready={ready} personalised={personalised} />

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center px-6 pt-16 pb-12">
        <div className="w-full max-w-xl flex flex-col items-center">
          <span className="text-5xl leading-none text-brand-rose select-none" aria-hidden="true">囍</span>

          {/* Progress */}
          <div
            className="mt-8 mb-12 flex w-40 gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEP_ORDER.length}
            aria-valuenow={stepIndex + 1}
            aria-label={`Question ${stepIndex + 1} of ${STEP_ORDER.length}`}
          >
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= stepIndex ? "bg-brand-rose" : "bg-border")}
              />
            ))}
          </div>

          {step === "date" && (
            <Slide>
              <Question>When&apos;s the big day?</Question>
              <Hint>Pick a date, even a tentative one. We&apos;ll plan backwards from it.</Hint>
              <div className="mt-10"><DatePicker value={weddingDate} onChange={setWeddingDate} /></div>
              <Nav>
                <Next disabled={!weddingDate} onClick={() => setStep("guests")} />
              </Nav>
            </Slide>
          )}

          {step === "guests" && (
            <Slide>
              <Question>How many guests are you expecting?</Question>
              <Hint>Count both sides, and your parents&apos; friends too. A rough number is fine.</Hint>

              <div className="mt-10 flex flex-col items-center gap-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  min={MIN_GUESTS}
                  max={MAX_GUESTS}
                  aria-label="Number of guests"
                  aria-invalid={!guestsValid}
                  className="h-16 w-40 rounded-2xl border-2 text-center text-3xl font-semibold md:text-3xl focus-visible:border-brand-rose"
                  value={guestText}
                  onChange={e => setGuestText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && guestsValid) setStep("type") }}
                />
                <p className="h-5 text-sm text-muted-foreground">
                  {guestsValid
                    ? `About ${Math.ceil(guestCount / 10)} tables of 10, if you're doing a banquet`
                    : `Enter a number between ${MIN_GUESTS} and ${MAX_GUESTS}`}
                </p>
              </div>

              <div className="mt-6 flex gap-2">
                {GUEST_PRESETS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGuestText(String(n))}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      guestsValid && guestCount === n
                        ? "border-brand-rose bg-brand-rose-muted font-medium text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <Nav>
                <Back onClick={() => setStep("date")} />
                <Next disabled={!guestsValid} onClick={() => setStep("type")} />
              </Nav>
            </Slide>
          )}

          {step === "type" && (
            <Slide>
              <Question>What are you planning?</Question>
              <Hint>We&apos;ll tailor the timeline and budget to match.</Hint>

              <RadioGroup
                value={weddingType}
                onValueChange={v => setWeddingType(v as WeddingType)}
                className="mt-10 w-full max-w-md gap-3"
                aria-label="Wedding type"
              >
                {WEDDING_TYPES.map(opt => (
                  <label key={opt.value} htmlFor={`type-${opt.value}`} className="block cursor-pointer text-left">
                    <RadioGroupItem id={`type-${opt.value}`} value={opt.value} className="peer sr-only" />
                    <div
                      className={cn(
                        "rounded-2xl border-2 border-border px-5 py-4 transition-colors hover:border-primary/50",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                        "peer-data-[state=checked]:border-brand-rose peer-data-[state=checked]:bg-brand-rose-muted",
                      )}
                    >
                      <div className="font-semibold text-foreground">{opt.label}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              <Nav>
                <Back onClick={() => setStep("guests")} />
                <Next disabled={!weddingType} onClick={() => setStep("story")} />
              </Nav>
            </Slide>
          )}

          {step === "story" && (
            <Slide>
              <Question>Tell us a bit about your wedding</Question>
              <Hint>Anything you&apos;ve already planned, things you&apos;re excited about, or things you&apos;re worried about.</Hint>

              {error && (
                <p role="alert" className="mt-6 max-w-lg rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-10 w-full max-w-lg text-left">
                <textarea
                  autoFocus
                  value={story}
                  maxLength={MAX_STORY_LENGTH}
                  onChange={e => setStory(e.target.value)}
                  onKeyDown={e => {
                    // Ctrl/Cmd + Enter builds the plan; plain Enter is a newline.
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && story.trim()) handleGenerate()
                  }}
                  aria-label="Tell us a bit about your wedding"
                  aria-describedby="story-count"
                  placeholder="e.g. We've booked the ROM for June and can't wait for the tea ceremony, but I'm nervous about keeping both sets of parents happy…"
                  className={cn(
                    "block h-56 w-full resize-none rounded-2xl border-2 border-border bg-card p-5 text-base leading-relaxed text-foreground",
                    "placeholder:text-muted-foreground transition-colors",
                    "focus-visible:border-brand-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                />
                <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs">
                  <span className="text-muted-foreground">Used only to personalise your plan with AI.</span>
                  <span
                    id="story-count"
                    className={cn("tabular-nums", story.length >= STORY_WARN_AT ? "font-medium text-brand-rose" : "text-muted-foreground")}
                  >
                    {story.length} / {MAX_STORY_LENGTH}
                  </span>
                </div>
              </div>

              <Nav>
                <Back onClick={() => { setError(""); setStep("type") }} />
                <Next disabled={!story.trim()} onClick={() => handleGenerate()} label="Build my plan" />
              </Nav>

              <Button
                type="button"
                variant="ghost"
                onClick={() => handleGenerate({ skip: true })}
                className="mt-3 text-muted-foreground"
              >
                Skip, just generate a plan
              </Button>
            </Slide>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────────

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      {children}
    </div>
  )
}

function Question({ children }: { children: React.ReactNode }) {
  return <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">{children}</h1>
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-md text-balance text-muted-foreground">{children}</p>
}

function Nav({ children }: { children: React.ReactNode }) {
  return <div className="mt-12 flex items-center gap-3">{children}</div>
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="lg" onClick={onClick} className="text-muted-foreground">
      <ArrowLeft /> Back
    </Button>
  )
}

function Next({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button
      type="button"
      size="lg"
      disabled={disabled}
      onClick={onClick}
      className="bg-brand-rose px-8 text-white hover:brightness-95"
    >
      {label} <ArrowRight />
    </Button>
  )
}
