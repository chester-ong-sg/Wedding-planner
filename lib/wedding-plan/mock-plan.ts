import { differenceInCalendarDays, differenceInMonths, addDays, format, parseISO, startOfDay } from "date-fns"
import type { GeneratedPlan, WeddingType } from "@/types/dashboard"

/**
 * BUILT-IN PLAN — used when the couple skips the free-text step (so no AI tokens
 * are spent) and as the fallback whenever the AI call fails.
 *
 * The template below is a realistic Singapore Chinese wedding (ROM + banquet,
 * ~150 guests, ~6 months out) in the exact shape the AI returns
 * (`GeneratedPlan`; see ./validate-plan.ts, which the AI's output must match).
 * `buildMockPlan` only *stamps* it with the couple's real dates and headcount
 * so the dashboard reads sensibly:
 *
 *   - checklist groups are labelled from the actual months remaining
 *   - milestone dates are counted back from the actual wedding date
 *   - per-guest / per-table budget lines scale with the guest count
 *   - rows tagged `only` are dropped for wedding types they don't apply to
 *
 * See app/api/generate-plan/route.ts for when this is used instead of the AI.
 *
 * Prices are ballpark 2025–26 Singapore figures, anchored to the reference
 * wedding in ./ai-prompt.ts. They are estimates, not quotes.
 */

export interface MockPlanInput {
  weddingDate: string // yyyy-MM-dd
  guestCount: number
  weddingType: WeddingType
  /** Injectable "today" so the output is deterministic in tests. */
  today?: Date
}

const BANQUET: WeddingType[] = ["banquet_only", "rom_and_banquet"]
const ROM: WeddingType[] = ["rom_only", "rom_and_banquet"]

const applies = (only: WeddingType[] | undefined, type: WeddingType) => !only || only.includes(type)

// ─── Checklist ───────────────────────────────────────────────────────────────

interface TaskTemplate {
  task: string
  category: string
  notes?: string
  only?: WeddingType[]
}

interface GroupTemplate {
  /** Months before the wedding this group is due. 0 = wedding week. */
  monthsBefore: number
  tasks: TaskTemplate[]
}

const CHECKLIST: GroupTemplate[] = [
  {
    monthsBefore: 6,
    tasks: [
      {
        task: "Check auspicious dates (择日) with the elders",
        category: "Customs",
        notes: "Many families avoid the 7th lunar month. Ask before you book anything.",
      },
      { task: "Sit down with both parents: budget and who pays for what", category: "Finance" },
      {
        task: "Visit 3 banquet venues and ask for the ++ price",
        category: "Venue",
        notes: "Service charge and GST usually go on top of the quote.",
        only: BANQUET,
      },
      { task: "Book your banquet date and pay the deposit", category: "Venue", only: BANQUET },
      {
        task: "Book your ROM solemnisation slot",
        category: "Legal",
        notes: "Check the ROM website for the current booking rules.",
        only: ROM,
      },
      {
        task: "Draft the guest list — groom's side, bride's side",
        category: "Guests",
        notes: "Your parents will add names. Leave some room.",
      },
    ],
  },
  {
    monthsBefore: 5,
    tasks: [
      { task: "Book photographer and videographer", category: "Photography", notes: "Popular dates go early." },
      {
        task: "Book your bridal makeup artist",
        category: "Attire",
        notes: "Doing a banquet? Book a second look for the evening.",
      },
      { task: "Start gown and suit fittings", category: "Attire" },
      { task: "Book an emcee (bilingual if the elders need it)", category: "Entertainment", only: BANQUET },
      {
        task: "Sound out your gate-crash squad (闯门)",
        category: "Customs",
        notes: "Brothers, sisters, close friends. Ask early.",
      },
    ],
  },
  {
    monthsBefore: 4,
    tasks: [
      {
        task: "Confirm 过大礼 date, items and who carries what",
        category: "Customs",
        notes: "Agree the list with both families first.",
      },
      { task: "Book the bridal car and an entourage car", category: "Planning" },
      { task: "Book your pre-wedding shoot (optional)", category: "Photography" },
      { task: "Design your invitations — printed, digital, or both", category: "Guests" },
    ],
  },
  {
    monthsBefore: 3,
    tasks: [
      { task: "Send invitations — and still call the aunties", category: "Guests" },
      {
        task: "Plan the tea ceremony (敬茶): order, tea set, sweet tea",
        category: "Customs",
        notes: "List the elders in order of seniority, each side.",
      },
      {
        task: "Appoint an angpao collector and get an angpao box",
        category: "Finance",
        notes: "Someone you trust who isn't busy running the day.",
      },
      {
        task: "Pick your 安床 (bed-setting) date",
        category: "Customs",
        notes: "Needs an auspicious date. Ask the elders.",
      },
      { task: "Do your menu tasting", category: "Venue", only: BANQUET },
    ],
  },
  {
    monthsBefore: 2,
    tasks: [
      {
        task: "Lodge your Notice of Marriage with ROM",
        category: "Legal",
        notes: "Check ROM for the current lead time.",
        only: ROM,
      },
      {
        task: "First pass at the seating plan",
        category: "Guests",
        notes: "Use the Seating tab. Group tables by family branch.",
        only: BANQUET,
      },
      {
        task: "Agree the gate-crash games and penalties with your squad",
        category: "Customs",
      },
      { task: "Choose march-in songs and the photo montage", category: "Entertainment", only: BANQUET },
      { task: "Second fitting for gown and suit", category: "Attire" },
    ],
  },
  {
    monthsBefore: 1,
    tasks: [
      {
        task: "Chase RSVPs and confirm your final headcount",
        category: "Guests",
        notes: "For a banquet, ask your manager for the exact cutoff.",
      },
      { task: "Finalise the seating plan and print table numbers", category: "Guests", only: BANQUET },
      { task: "Collect the rings and do final fittings", category: "Attire" },
      {
        task: "Buy sweets and tangyuan (汤圆) ingredients",
        category: "Customs",
        notes: "Tangyuan is for the morning at home.",
      },
      { task: "Buy table gifts and game prizes", category: "Guests", only: BANQUET },
      { task: "Confirm the day timeline with photographer, MUA and drivers", category: "Planning" },
    ],
  },
  {
    monthsBefore: 0,
    tasks: [
      {
        task: "上头 hair-combing ritual (night before or that morning)",
        category: "Customs",
        notes: "Confirm the timing with the elders.",
      },
      { task: "Hand the angpao box to your collector", category: "Finance" },
      {
        task: "Brief the gate-crash squad and prepare angpao for the sisters",
        category: "Customs",
        notes: "The groom's side prepares these for the door games.",
      },
      { task: "Pack the day bag: spare shoes, tissues, snacks, phone charger", category: "Planning" },
      {
        task: "Send parking coupons, table gifts and game cards to the venue",
        category: "Venue",
        only: BANQUET,
      },
      {
        task: "Arrange 回门 — visiting the bride's family after the wedding",
        category: "Customs",
        notes: "Usually within a few days. Confirm with your in-laws.",
      },
    ],
  },
]

function monthLabel(monthsBefore: number): string {
  if (monthsBefore === 0) return "Wedding week"
  if (monthsBefore === 1) return "1 month to go"
  return `${monthsBefore} months to go`
}

// ─── Milestones ──────────────────────────────────────────────────────────────

interface MilestoneTemplate {
  title: string
  description: string
  /** Days before the wedding, for a ~6 month runway. Compressed for closer dates. */
  daysBefore: number
  only?: WeddingType[]
}

/** The runway the template's offsets were written for. */
const TEMPLATE_RUNWAY_DAYS = 180

const MILESTONES: MilestoneTemplate[] = [
  { title: "Wedding date locked in (择日)", description: "Elders have checked the almanac and everyone agrees.", daysBefore: 175 },
  { title: "Banquet deposit paid", description: "Date and venue secured with the hotel.", daysBefore: 165, only: BANQUET },
  { title: "ROM slot booked", description: "Check the ROM website for the current booking rules.", daysBefore: 160, only: ROM },
  { title: "Photographer and makeup artist booked", description: "The two vendors that fill up first.", daysBefore: 145 },
  { title: "Guest list v1 done", description: "Both sides, with your parents' additions.", daysBefore: 125 },
  { title: "Invitations sent", description: "Send them out, then follow up with a call.", daysBefore: 90 },
  { title: "过大礼 betrothal", description: "Confirm the date and items with both families.", daysBefore: 70 },
  { title: "Menu tasting done", description: "Lock the menu and any dietary needs.", daysBefore: 60, only: BANQUET },
  { title: "Notice of Marriage lodged with ROM", description: "Check ROM for the current lead time.", daysBefore: 55, only: ROM },
  { title: "Final headcount to the hotel", description: "Confirm the exact cutoff with your banquet manager.", daysBefore: 21, only: BANQUET },
  { title: "安床 bed-setting", description: "Needs an auspicious date. Ask the elders.", daysBefore: 10 },
  { title: "Angpao collector briefed", description: "Box handed over, and they know the plan.", daysBefore: 3 },
  { title: "The big day 囍", description: "You planned well. Enjoy every minute.", daysBefore: 0 },
]

// ─── Budget ──────────────────────────────────────────────────────────────────

interface BudgetCtx {
  guests: number
  tables: number
}

interface BudgetLineTemplate {
  item_name: string | ((c: BudgetCtx) => string)
  amount: number | ((c: BudgetCtx) => number)
  notes?: string
  only?: WeddingType[]
}

interface BudgetCategoryTemplate {
  category: string
  items: BudgetLineTemplate[]
}

/** Nearest $50 — keeps scaled figures looking like real quotes. */
const round50 = (n: number) => Math.round(n / 50) * 50

const BUDGET: BudgetCategoryTemplate[] = [
  {
    category: "Banquet",
    items: [
      {
        item_name: c => `Banquet F&B (${c.tables} tables of 10)`,
        amount: c => round50(c.guests * 185),
        notes: "About $185 a guest at a hotel. Usually quoted ++ (service charge + GST).",
        only: BANQUET,
      },
      { item_name: "Drinks top-up and corkage", amount: 1200, only: BANQUET },
      { item_name: "Table décor and centrepieces", amount: c => c.tables * 100, only: BANQUET },
      { item_name: "Bilingual emcee", amount: 800, only: BANQUET },
    ],
  },
  {
    category: "Photo & Video",
    items: [
      { item_name: "Photographer and videographer (actual day)", amount: 4500 },
      { item_name: "Pre-wedding shoot", amount: 2500, notes: "Optional. Skip it and save this." },
      { item_name: "Photobooth", amount: 1100, only: BANQUET },
    ],
  },
  {
    category: "Attire & Beauty",
    items: [
      { item_name: "Gown and groom's suit", amount: 2800 },
      { item_name: "Qipao / kua for the tea ceremony", amount: 900 },
      {
        item_name: "Bridal makeup and hair",
        amount: 1500,
        notes: "Budgeted for 2 looks, morning and evening.",
      },
      { item_name: "Bouquet, corsages and wristlets", amount: 400 },
      { item_name: "Wedding rings", amount: 3000 },
    ],
  },
  {
    category: "Customs & Angpao",
    items: [
      {
        item_name: "过大礼 betrothal gifts",
        amount: 3000,
        notes: "Varies a lot by family. Agree the list with the elders.",
      },
      { item_name: "喜饼 wedding pastries for relatives", amount: 1000 },
      { item_name: "Tea ceremony set and sweets", amount: 300 },
      { item_name: "Gate-crash angpao and prizes", amount: 300 },
      { item_name: "Angpao box and cards", amount: 50 },
    ],
  },
  {
    category: "Logistics & Admin",
    items: [
      { item_name: "Bridal car and entourage car", amount: 1000 },
      { item_name: "Invitations and stationery", amount: 600 },
      { item_name: "Table gifts and favours", amount: c => round50(c.guests * 5), only: BANQUET },
      {
        item_name: "ROM fees (notice and solemnisation)",
        amount: 150,
        notes: "Rough estimate. Check ROM for the current fees.",
        only: ROM,
      },
    ],
  },
]

// ─── Builder ─────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd")

export function buildMockPlan(input: MockPlanInput): GeneratedPlan {
  const { weddingType } = input
  const guests = Math.max(1, Math.round(input.guestCount))
  const today = startOfDay(input.today ?? new Date())
  const wedding = startOfDay(parseISO(input.weddingDate))
  const daysUntil = Math.max(0, differenceInCalendarDays(wedding, today))
  const monthsUntil = Math.max(0, differenceInMonths(wedding, today))
  const ctx: BudgetCtx = { guests, tables: Math.max(1, Math.ceil(guests / 10)) }

  // Checklist — groups that are already "overdue" for a close wedding date are
  // folded into a single "Start now" group instead of being silently dropped.
  const groups = CHECKLIST.map(g => ({
    monthsBefore: g.monthsBefore,
    tasks: g.tasks.filter(t => applies(t.only, weddingType)),
  })).filter(g => g.tasks.length > 0)

  const overdue = groups.filter(g => g.monthsBefore > monthsUntil)
  const upcoming = groups.filter(g => g.monthsBefore <= monthsUntil)

  const checklist: GeneratedPlan["checklist"] = []
  if (overdue.length > 0) {
    checklist.push({ month_label: "Start now", tasks: overdue.flatMap(g => g.tasks.map(toTask)) })
  }
  for (const g of upcoming) {
    checklist.push({ month_label: monthLabel(g.monthsBefore), tasks: g.tasks.map(toTask) })
  }

  // Budget
  const budget: GeneratedPlan["budget"] = BUDGET.map(cat => ({
    category: cat.category,
    items: cat.items
      .filter(i => applies(i.only, weddingType))
      .map(i => ({
        item_name: typeof i.item_name === "function" ? i.item_name(ctx) : i.item_name,
        estimated_amount: Math.round(typeof i.amount === "function" ? i.amount(ctx) : i.amount),
        ...(i.notes ? { notes: i.notes } : {}),
      })),
  })).filter(cat => cat.items.length > 0)

  const subtotal = budget.reduce((s, c) => s + c.items.reduce((t, i) => t + i.estimated_amount, 0), 0)
  budget.push({
    category: "Contingency",
    items: [
      {
        item_name: "Buffer (10%)",
        estimated_amount: Math.max(100, round50(subtotal * 0.1)),
        notes: "Something always costs more than you thought.",
      },
    ],
  })

  // Milestones — offsets are written for a 6-month runway, so squeeze them
  // proportionally when the wedding is closer, and never date one in the past.
  const squeeze = Math.min(1, daysUntil / TEMPLATE_RUNWAY_DAYS)
  const milestones: GeneratedPlan["milestones"] = MILESTONES.filter(m => applies(m.only, weddingType))
    .map((m, order) => {
      const raw = addDays(wedding, -Math.round(m.daysBefore * squeeze))
      return { order, due: raw < today ? today : raw, m }
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.order - b.order)
    .map(({ due, m }) => ({ title: m.title, due_date: fmtDate(due), description: m.description }))

  return { checklist, budget, milestones }
}

function toTask(t: TaskTemplate) {
  return { task: t.task, category: t.category, ...(t.notes ? { notes: t.notes } : {}) }
}
