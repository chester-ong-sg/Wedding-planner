import type { SupabaseClient } from "@supabase/supabase-js"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"
import { placeholderGuestNames } from "./placeholder-guests"

/** Rows per insert, to stay well inside request-size limits for large guest lists. */
const GUEST_INSERT_CHUNK = 500

export interface OnboardingAnswers {
  weddingDate: string
  guestCount: number
  weddingType: WeddingType
}

export type SaveResult = { ok: true } | { ok: false; error: string }

/**
 * Persist a generated plan for a user in Supabase.
 *
 * Order matters: the plan rows are written FIRST and `onboarding_completed` is
 * set LAST. The flag is what lets a returning user skip onboarding, so it must
 * only flip once there is a plan to land on. If any step fails the flag stays
 * false and the user simply retries — they are never stranded on an empty
 * dashboard.
 */
export async function savePlanToSupabase(
  supabase: SupabaseClient,
  userId: string,
  plan: GeneratedPlan,
  answers: OnboardingAnswers,
): Promise<SaveResult> {
  // Guard: never touch the plan of someone who has already finished onboarding
  // (double tab, stale page). Also makes the cleanup below safe.
  const { data: existing, error: readError } = await supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle()
  if (readError) return { ok: false, error: readError.message }
  if (existing?.onboarding_completed) return { ok: false, error: "already-onboarded" }

  // A previous attempt may have failed part-way and left some rows behind.
  // Clear them so a retry doesn't duplicate the plan.
  for (const table of ["checklist_items", "budget_items", "milestones"] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId)
    if (error) return { ok: false, error: error.message }
  }

  const checklistRows = plan.checklist.flatMap((group, gi) =>
    group.tasks.map((t, ti) => ({
      user_id: userId,
      month_label: group.month_label,
      task: t.task,
      category: t.category ?? null,
      notes: t.notes ?? null,
      sort_order: gi * 100 + ti,
    })),
  )
  const budgetRows = plan.budget.flatMap((group, gi) =>
    group.items.map((item, ii) => ({
      user_id: userId,
      category: group.category,
      item_name: item.item_name,
      estimated_amount: item.estimated_amount,
      notes: item.notes ?? null,
      sort_order: gi * 100 + ii,
    })),
  )
  const milestoneRows = plan.milestones.map((m, i) => ({
    user_id: userId,
    title: m.title,
    due_date: m.due_date,
    description: m.description,
    sort_order: i,
  }))

  const inserts: [string, Record<string, unknown>[]][] = [
    ["checklist_items", checklistRows],
    ["budget_items", budgetRows],
    ["milestones", milestoneRows],
  ]
  for (const [table, rows] of inserts) {
    if (rows.length === 0) continue
    const { error } = await supabase.from(table).insert(rows)
    if (error) return { ok: false, error: error.message }
  }

  // Seed the seating planner with placeholder guests (name only) so it isn't
  // empty on first visit. Only when the user has no guests yet — someone who
  // used the planner before onboarding existed must not get duplicates. A retry
  // after a later failure also lands here and correctly finds them already there.
  const { count, error: countError } = await supabase
    .from("guests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (countError) return { ok: false, error: countError.message }

  if ((count ?? 0) === 0) {
    const guestRows = placeholderGuestNames(answers.guestCount).map(name => ({
      user_id: userId,
      name,
      rsvp_status: "pending",
    }))
    for (let i = 0; i < guestRows.length; i += GUEST_INSERT_CHUNK) {
      const { error } = await supabase.from("guests").insert(guestRows.slice(i, i + GUEST_INSERT_CHUNK))
      if (error) return { ok: false, error: error.message }
    }
  }

  // Last: mark onboarding complete.
  const { error: profileError } = await supabase.from("user_profiles").upsert({
    id: userId,
    wedding_date: answers.weddingDate,
    guest_count: answers.guestCount,
    wedding_type: answers.weddingType,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  })
  if (profileError) return { ok: false, error: profileError.message }

  return { ok: true }
}

// ─── Dev-mode persistence ────────────────────────────────────────────────────
// In `next dev` the whole flow runs without auth or the Supabase tables, backed
// by localStorage. Keys are shared with contexts/wedding-data.tsx.

export const DEV_PLAN_KEY = "dev_wedding_plan"
export const DEV_ANSWERS_KEY = "dev_onboarding"
export const DEV_ROWS_KEY = "dev_plan_rows"

export function saveDevPlan(plan: GeneratedPlan, answers: OnboardingAnswers) {
  localStorage.setItem(DEV_PLAN_KEY, JSON.stringify(plan))
  localStorage.setItem(DEV_ANSWERS_KEY, JSON.stringify(answers))
  // A fresh plan supersedes any edited rows from a previous run.
  localStorage.removeItem(DEV_ROWS_KEY)
}

/** Set by onboarding, consumed once by the dashboard to show a welcome banner. */
export const JUST_ONBOARDED_KEY = "onboarding_just_finished"
