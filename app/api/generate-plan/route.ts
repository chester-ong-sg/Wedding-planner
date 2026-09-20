import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { isValid, parseISO } from "date-fns"
import { buildMockPlan } from "@/lib/wedding-plan/mock-plan"
import { generatePlanWithAI, hasAnthropicKey } from "@/lib/wedding-plan/generate-plan-ai"
import { MAX_STORY_LENGTH, sanitizeStory } from "@/lib/wedding-plan/ai-prompt"
import { createClient } from "@/utils/supabase/server"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"

/**
 * A personalised plan takes a while to write. Vercel caps this per plan; if your
 * plan's limit is lower than this the platform will use its own cap, and the AI
 * call's timeout (see generate-plan-ai.ts) then can't fire first.
 */
export const maxDuration = 120

const WEDDING_TYPES: WeddingType[] = ["rom_only", "banquet_only", "rom_and_banquet"]
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Where the plan came from — for logging and debugging; the client only reads `plan`. */
type PlanSource = "ai" | "mock" | "mock-fallback" | "mock-no-session"

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * The AI path costs real money, so it is only available to a signed-in user.
 * Development has no auth by design (see docs), so it is exempt there.
 */
async function isSignedIn(): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true
  try {
    const supabase = createClient(await cookies())
    const { data: { user } } = await supabase.auth.getUser()
    return !!user
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return bad("Request body must be JSON")
  }

  const { weddingDate, guestCount, weddingType, story: rawStory } = (body ?? {}) as Record<string, unknown>

  if (typeof weddingDate !== "string" || !ISO_DATE.test(weddingDate) || !isValid(parseISO(weddingDate))) {
    return bad("weddingDate must be a valid yyyy-MM-dd date")
  }
  if (typeof guestCount !== "number" || !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 2000) {
    return bad("guestCount must be a whole number between 1 and 2000")
  }
  if (typeof weddingType !== "string" || !WEDDING_TYPES.includes(weddingType as WeddingType)) {
    return bad("weddingType must be rom_only, banquet_only or rom_and_banquet")
  }
  // Optional free text from step 4. Absent, null or blank all mean "skipped".
  if (rawStory != null && typeof rawStory !== "string") return bad("story must be a string")
  if (typeof rawStory === "string" && rawStory.trim().length > MAX_STORY_LENGTH) {
    return bad(`story must be at most ${MAX_STORY_LENGTH} characters`)
  }
  const story = typeof rawStory === "string" ? sanitizeStory(rawStory) : ""

  const input = { weddingDate, guestCount, weddingType: weddingType as WeddingType }

  let plan: GeneratedPlan
  let source: PlanSource

  if (!story) {
    // Skipped step 4 — there is nothing to personalise, so don't spend tokens.
    plan = buildMockPlan(input)
    source = "mock"
  } else if (!hasAnthropicKey()) {
    console.warn("generate-plan: story provided but ANTHROPIC_API_KEY is missing — using the mock plan")
    plan = buildMockPlan(input)
    source = "mock-fallback"
  } else if (!(await isSignedIn())) {
    console.warn("generate-plan: story provided but no signed-in session — using the mock plan instead of spending tokens")
    plan = buildMockPlan(input)
    source = "mock-no-session"
  } else {
    try {
      plan = await generatePlanWithAI({ ...input, story })
      source = "ai"
    } catch (err) {
      // Never dead-end onboarding on an AI outage, timeout or bad output.
      console.error("generate-plan: AI generation failed, falling back to the mock plan:", err)
      plan = buildMockPlan(input)
      source = "mock-fallback"
    }
  }

  return NextResponse.json({ plan, source })
}
