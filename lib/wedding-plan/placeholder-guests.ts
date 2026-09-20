/**
 * Placeholder guests seeded into the seating planner when onboarding finishes,
 * so the couple can start arranging tables straight away and fill in real names
 * and details later. They carry a name only — no email, contact or diet.
 */

/**
 * The planner loads guests with a single un-paginated query, and PostgREST caps
 * that at 1000 rows by default. Seeding more than that would create guests the
 * planner could never show.
 */
export const MAX_PLACEHOLDER_GUESTS = 1000

export function placeholderGuestCount(guestCount: number): number {
  if (!Number.isFinite(guestCount)) return 0
  return Math.max(0, Math.min(Math.floor(guestCount), MAX_PLACEHOLDER_GUESTS))
}

export function placeholderGuestNames(guestCount: number): string[] {
  return Array.from({ length: placeholderGuestCount(guestCount) }, (_, i) => `Guest ${i + 1}`)
}
