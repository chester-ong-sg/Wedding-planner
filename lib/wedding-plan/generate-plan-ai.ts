import Anthropic from "@anthropic-ai/sdk"
import { differenceInMonths, format, parseISO, startOfDay } from "date-fns"
import { buildPlanPrompt } from "./ai-prompt"
import { extractJson, parseGeneratedPlan } from "./validate-plan"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"

/** The model that writes personalised plans. */
export const PLAN_MODEL = "claude-sonnet-4-5"

/**
 * Output budget. A full plan is roughly 3–4k tokens; this leaves headroom while
 * still capping the worst-case bill. A reply that hits the cap is discarded
 * rather than parsed, since truncated JSON can't be trusted.
 */
const MAX_TOKENS = 6000

/**
 * Give up after this long so the caller can fall back to the mock plan instead
 * of hanging. MUST stay comfortably below the route's `maxDuration` (60s), or the
 * platform kills the request before the fallback can respond. Measured plans took
 * 35–47s, so 52s leaves room for normal variance without risking the cap.
 */
export const AI_TIMEOUT_MS = 52_000

// claude-sonnet-4-5 list price, USD per million tokens — used only for the cost log.
const PRICE_IN_PER_M = 3
const PRICE_OUT_PER_M = 15

export interface AIPlanInput {
  weddingDate: string
  guestCount: number
  weddingType: WeddingType
  story: string
  /** Injectable for tests. */
  today?: Date
}

export class PlanGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "PlanGenerationError"
  }
}

/** True when a usable key is configured (guards against an unedited placeholder). */
export function hasAnthropicKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return !!key && key.startsWith("sk-ant-") && !/your-anthropic-api-key/i.test(key)
}

/**
 * Generates a plan tailored to the couple's answers AND their free-text note.
 * Throws `PlanGenerationError` on any failure (no key, network, timeout,
 * truncation, unparseable or structurally invalid output) — the caller decides
 * what to fall back to.
 */
export async function generatePlanWithAI(input: AIPlanInput): Promise<GeneratedPlan> {
  if (!hasAnthropicKey()) throw new PlanGenerationError("ANTHROPIC_API_KEY is missing or a placeholder")

  const today = startOfDay(input.today ?? new Date())
  const wedding = startOfDay(parseISO(input.weddingDate))

  const prompt = buildPlanPrompt({
    weddingDate: input.weddingDate,
    guestCount: input.guestCount,
    weddingType: input.weddingType,
    monthsUntilWedding: Math.max(0, differenceInMonths(wedding, today)),
    today: format(today, "yyyy-MM-dd"),
    story: input.story,
  })

  // Created per call so a missing key can never crash the module at import time.
  // No SDK retries: a retry would double the wait, and the fallback is instant.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 0 })

  const started = Date.now()
  let message: Anthropic.Message
  try {
    message = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (err) {
    throw new PlanGenerationError(`Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }

  // Keep per-call spend observable.
  const u = message.usage
  const cost = (u.input_tokens / 1e6) * PRICE_IN_PER_M + (u.output_tokens / 1e6) * PRICE_OUT_PER_M
  console.log(
    `generate-plan (${PLAN_MODEL}): in=${u.input_tokens} out=${u.output_tokens} ` +
      `≈ $${cost.toFixed(4)} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )

  if (message.stop_reason === "max_tokens") {
    throw new PlanGenerationError("Model reply hit max_tokens and was truncated")
  }

  const block = message.content.find(b => b.type === "text")
  if (!block || block.type !== "text") throw new PlanGenerationError("Model reply contained no text")

  let raw: unknown
  try {
    raw = extractJson(block.text)
  } catch (err) {
    throw new PlanGenerationError("Model reply was not valid JSON", { cause: err })
  }

  const plan = parseGeneratedPlan(raw, { today, weddingDate: input.weddingDate })
  if (!plan) throw new PlanGenerationError("Model reply did not match the plan shape")
  return plan
}
