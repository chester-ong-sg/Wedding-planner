import { format, isValid, parseISO, startOfDay } from "date-fns"
import type { GeneratedPlan } from "@/types/dashboard"

/**
 * Validates and normalises a plan produced by the AI so that it is guaranteed
 * to have the exact `GeneratedPlan` shape the dashboard and the save logic
 * expect — the same shape `buildMockPlan()` returns. Model output is untrusted:
 * anything structurally wrong is rejected (returns null) so the caller can fall
 * back to the mock rather than writing broken rows.
 */

const MAX_CHECKLIST_GROUPS = 12
const MAX_TASKS_PER_GROUP = 12
const MAX_BUDGET_CATEGORIES = 10
const MAX_ITEMS_PER_CATEGORY = 12
const MAX_MILESTONES = 20
const MAX_TEXT = 300
const MAX_AMOUNT = 10_000_000

/** Categories the checklist UI has a colour for. Anything else falls back to "Planning". */
export const CHECKLIST_CATEGORIES = [
  "Customs", "Venue", "Finance", "Photography", "Attire",
  "Entertainment", "Guests", "Planning", "Legal",
] as const

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** Trimmed, non-empty, length-capped string — or null. */
function text(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t
}

export interface ParseOptions {
  /** "Today" — milestone dates before this are moved up to it. */
  today: Date
  /** yyyy-MM-dd — milestone dates after this are pulled back to it. */
  weddingDate: string
}

export function parseGeneratedPlan(raw: unknown, opts: ParseOptions): GeneratedPlan | null {
  if (!isRecord(raw)) return null
  const { checklist, budget, milestones } = raw
  if (!Array.isArray(checklist) || !Array.isArray(budget) || !Array.isArray(milestones)) return null
  if (checklist.length === 0 || checklist.length > MAX_CHECKLIST_GROUPS) return null
  if (budget.length === 0 || budget.length > MAX_BUDGET_CATEGORIES) return null
  if (milestones.length === 0 || milestones.length > MAX_MILESTONES) return null

  const out: GeneratedPlan = { checklist: [], budget: [], milestones: [] }

  for (const g of checklist) {
    if (!isRecord(g)) return null
    const month_label = text(g.month_label, 60)
    if (!month_label || !Array.isArray(g.tasks) || g.tasks.length === 0 || g.tasks.length > MAX_TASKS_PER_GROUP) return null
    const tasks: GeneratedPlan["checklist"][number]["tasks"] = []
    for (const t of g.tasks) {
      if (!isRecord(t)) return null
      const task = text(t.task)
      if (!task) return null
      const category = text(t.category, 40)
      const notes = text(t.notes)
      tasks.push({
        task,
        category: category && (CHECKLIST_CATEGORIES as readonly string[]).includes(category) ? category : "Planning",
        ...(notes ? { notes } : {}),
      })
    }
    out.checklist.push({ month_label, tasks })
  }

  for (const c of budget) {
    if (!isRecord(c)) return null
    const category = text(c.category, 60)
    if (!category || !Array.isArray(c.items) || c.items.length === 0 || c.items.length > MAX_ITEMS_PER_CATEGORY) return null
    const items: GeneratedPlan["budget"][number]["items"] = []
    for (const i of c.items) {
      if (!isRecord(i)) return null
      const item_name = text(i.item_name)
      const amount = i.estimated_amount
      if (!item_name || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null
      const notes = text(i.notes)
      items.push({ item_name, estimated_amount: Math.round(amount), ...(notes ? { notes } : {}) })
    }
    out.budget.push({ category, items })
  }

  const today = startOfDay(opts.today)
  const wedding = startOfDay(parseISO(opts.weddingDate))
  for (const m of milestones) {
    if (!isRecord(m)) return null
    const title = text(m.title)
    const description = text(m.description) ?? ""
    if (!title || typeof m.due_date !== "string" || !ISO_DATE.test(m.due_date)) return null
    const due = parseISO(m.due_date)
    if (!isValid(due)) return null
    // Keep every milestone inside [today, wedding day] rather than trusting the model's arithmetic.
    const clamped = due < today ? today : due > wedding ? wedding : due
    out.milestones.push({ title, due_date: format(clamped, "yyyy-MM-dd"), description })
  }
  out.milestones.sort((a, b) => a.due_date.localeCompare(b.due_date))

  return out
}

/** Pulls the JSON object out of a model reply, tolerating markdown fences and stray prose. */
export function extractJson(reply: string): unknown {
  const cleaned = reply.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
  const first = cleaned.indexOf("{")
  const last = cleaned.lastIndexOf("}")
  if (first === -1 || last <= first) throw new Error("No JSON object in model reply")
  return JSON.parse(cleaned.slice(first, last + 1))
}
