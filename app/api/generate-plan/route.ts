import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { GeneratedPlan } from "@/types/dashboard"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function monthsUntilWedding(weddingDate: string): number {
  const now = new Date()
  const wedding = new Date(weddingDate)
  return Math.max(
    1,
    (wedding.getFullYear() - now.getFullYear()) * 12 +
      (wedding.getMonth() - now.getMonth())
  )
}

function weddingTypeLabel(type: string): string {
  if (type === "rom_only") return "ROM only (Registry of Marriages, no banquet)"
  if (type === "banquet_only") return "Banquet only (no ROM)"
  return "ROM + Banquet (full traditional Singapore Chinese wedding)"
}

// Grounding data from a real 2025 Singapore Chinese banquet wedding (~178 guests,
// ~18 tables of 10, hotel ballroom). Use these as price/structure anchors and
// scale proportionally to the couple's actual guest count.
const REAL_REFERENCE = `
REAL SINGAPORE WEDDING REFERENCE (actual spend, ~178 guests, hotel ballroom banquet — anchor your estimates to these and scale by guest count):

Actual vendor costs (SGD), total ~$45,935 excluding rings/angpao/betrothal:
- Hotel ballroom + banquet F&B: $34,000  (works out to roughly $185–$195 per guest at a 4–5 star hotel; this is the single biggest line item)
- Photographer + Videographer (same studio, full day): $4,488
- Groom's suit + bride's gown: $2,756
- Bridal makeup artist (2 looks, morning + banquet): $1,440
- Photobooth (roving + station): $1,088
- Transport (2 chauffeured cars, ~6 hours — one bridal car, one for entourage): $976
- Emcee (bilingual, dinner banquet): $788
- Florist (bridal bouquet, corsages, wristlets): $399

Real wedding-day timeline (full traditional flow, condensed):
- ~5:00–6:00am: Bridesmaids/groomsmen arrive, flowers & corsages distributed, makeup begins (MUA needs ~2h for bride)
- ~7:00–8:00am: Bridal car convoy to bride's house; gate-crash (闯门) games; groom gives angpao to sisters
- ~9:30am: Return to groom's house — prayers, tangyuan
- ~10:45–11:30am: Tea ceremony (敬茶) at the hotel/home; hotel can provide tea, bring own disposable cups + tea set
- ~11:30am: Cocktail reception starts; AV testing, background music
- ~12:30pm: Childhood montage, 1st march-in (pick an entry song), Course 1 of banquet
- ~1:30pm: Main game (Bingo is popular — prizes are 3 random big angpaos), roving photobooth
- ~2:00pm: 2nd march-in, champagne pour, cake; family stage photos
- Evening: After-party (e.g. karaoke)

Seating reality: 10 pax per round table; a VIP table near the stage for immediate family; tables grouped by family branch (e.g. clusters for each aunt/uncle's family) and split by groom's side vs bride's side across the aisle. Plan for a few "+1" and baby-chair adjustments.

Practical day-of items couples forget: angpao box + appointed trusted collector, table gifts + game cards pre-placed, parking coupons from banquet manager, suit covers, 2 laptops + HDMI adaptors for AV, swiss rolls/biscuits for the morning, printed guest lists for both sides.
`.trim()

const MOCK_PLAN: GeneratedPlan = {
  checklist: [
    {
      month_label: "12 months before",
      tasks: [
        { task: "Set your wedding date and check auspicious dates (择日) with family elders", category: "Planning", notes: "Consult a 择日 master or use a Chinese almanac" },
        { task: "Decide on banquet venue and start shortlisting hotels", category: "Venue", notes: "Popular SG venues book up fast — visit at least 3" },
        { task: "Set overall wedding budget", category: "Finance", notes: "Include angpao projections to offset costs" },
        { task: "Register for ROM appointment (slots open 3 months in advance)", category: "Legal", notes: "Book at ROM Building, Paterson Road" },
      ],
    },
    {
      month_label: "9 months before",
      tasks: [
        { task: "Book wedding banquet venue and confirm date", category: "Venue" },
        { task: "Engage wedding photographer and videographer", category: "Photography", notes: "SG photographers book 12–18 months ahead for peak dates" },
        { task: "Start shortlisting wedding gown and suit tailoring", category: "Attire" },
        { task: "Discuss gate crash (闯门) traditions with brothers and sisters", category: "Customs" },
      ],
    },
    {
      month_label: "6 months before",
      tasks: [
        { task: "Confirm gown fitting appointments", category: "Attire" },
        { task: "Book emcee and live band / DJ", category: "Entertainment" },
        { task: "Discuss 过大礼 (betrothal ceremony) items and dates with both families", category: "Customs" },
        { task: "Finalise guest list and begin seating arrangements", category: "Guests" },
      ],
    },
    {
      month_label: "3 months before",
      tasks: [
        { task: "Send out invitations (physical or digital)", category: "Guests" },
        { task: "Confirm wedding day itinerary with coordinator", category: "Planning" },
        { task: "Arrange angpao box and appoint a trusted person to collect", category: "Finance" },
        { task: "Plan tea ceremony (敬茶) sequence and prepare tea set gifts", category: "Customs" },
      ],
    },
    {
      month_label: "1 month before",
      tasks: [
        { task: "Final gown and suit fitting", category: "Attire" },
        { task: "Confirm RSVP headcount with venue", category: "Venue" },
        { task: "Prepare gatecrash games and items for brothers/sisters", category: "Customs" },
        { task: "Finalise seating plan and print table cards", category: "Guests" },
      ],
    },
  ],
  budget: [
    {
      category: "Venue & Catering",
      items: [
        { item_name: "Banquet hall rental + F&B", estimated_amount: 30000, notes: "~$120–$180 per pax for hotel banquet" },
        { item_name: "Corkage fee (if bringing own alcohol)", estimated_amount: 500 },
        { item_name: "Table decorations (centrepieces)", estimated_amount: 2000 },
      ],
    },
    {
      category: "Photography & Videography",
      items: [
        { item_name: "Wedding day photographer", estimated_amount: 3500 },
        { item_name: "Videographer (highlight + full edit)", estimated_amount: 3000 },
        { item_name: "Pre-wedding photoshoot", estimated_amount: 2500, notes: "Overseas or local studio" },
      ],
    },
    {
      category: "Attire",
      items: [
        { item_name: "Bridal gown (rental or purchase)", estimated_amount: 3000 },
        { item_name: "Groom suit", estimated_amount: 1500 },
        { item_name: "Qipao / kua for tea ceremony", estimated_amount: 1200 },
        { item_name: "Bridesmaids dresses", estimated_amount: 600 },
      ],
    },
    {
      category: "Customs & Traditions",
      items: [
        { item_name: "过大礼 betrothal gifts", estimated_amount: 3000, notes: "Includes wedding cakes, wine, jewellery" },
        { item_name: "Tea ceremony gifts and ang ku kueh", estimated_amount: 500 },
        { item_name: "Gatecrash props and penalties budget", estimated_amount: 300 },
      ],
    },
    {
      category: "Miscellaneous",
      items: [
        { item_name: "Wedding rings", estimated_amount: 3000 },
        { item_name: "Hair & makeup (bride + sisters)", estimated_amount: 1500 },
        { item_name: "Wedding favours for guests", estimated_amount: 800 },
        { item_name: "Transportation (bridal car + limo)", estimated_amount: 1000 },
        { item_name: "Contingency fund (10%)", estimated_amount: 5000 },
      ],
    },
  ],
  milestones: [
    { title: "ROM appointment confirmed", due_date: new Date(Date.now() + 270 * 86400000).toISOString().split("T")[0], description: "Book at ROM Singapore — slots release 3 months in advance" },
    { title: "Venue deposit paid", due_date: new Date(Date.now() + 240 * 86400000).toISOString().split("T")[0], description: "Secure your banquet hall before the date gets taken" },
    { title: "过大礼 betrothal ceremony", due_date: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0], description: "Traditionally 1–3 months before the wedding" },
    { title: "Final RSVP headcount due", due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], description: "Confirm numbers with the hotel for final billing" },
  ],
}

export async function POST(req: NextRequest) {
  try {
    const { weddingDate, guestCount, weddingType } = await req.json()

    if (!weddingDate || !guestCount || !weddingType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === "your-anthropic-api-key-here") {
      console.warn("No ANTHROPIC_API_KEY — returning mock plan")
      return NextResponse.json({ plan: MOCK_PLAN })
    }

    const months = monthsUntilWedding(weddingDate)
    const typeLabel = weddingTypeLabel(weddingType)

    const prompt = `You are a Singapore wedding planning assistant with deep knowledge of Chinese wedding customs in Singapore.

Generate a comprehensive wedding plan for a couple with these details:
- Wedding date: ${weddingDate}
- Months until wedding: ${months} months
- Number of guests: ${guestCount}
- Wedding type: ${typeLabel}

Create a plan tailored to a Singapore Chinese wedding. Include relevant traditions naturally:
- 择日 (auspicious date selection)
- 过大礼 (betrothal ceremony with gifts)
- 闯门 (gate crash games by brothers and sisters)
- 敬茶 (tea ceremony sequence)
- Angpao (red packet) collection logistics
- ROM at Registry of Marriages Singapore
- Typical Singapore hotel banquet pricing (SGD)

${REAL_REFERENCE}

Rules:
- Budget in SGD, whole numbers only (no cents)
- Anchor every budget estimate to the REAL REFERENCE above, then scale to ${guestCount} guests (the reference was for ~178 guests). The ballroom + F&B line scales almost linearly with guest count (~$185–$195/pax); vendor fees like photographer, emcee, makeup, gown are mostly fixed regardless of guest count.
- For a ${typeLabel}, only include the relevant items: ROM-only weddings skip the banquet/ballroom and most day-of banquet logistics; banquet-only weddings skip the ROM-specific tasks.
- Mirror the real wedding-day timeline structure when describing day-of tasks (gate-crash → prayers → tea ceremony → reception → march-ins → games → stage photos).
- Tone: warm, local, personal — not generic Western wedding advice — like a friend who just got married in Singapore sharing exactly what they did
- Include Singapore-specific vendors/venues and the practical day-of items couples forget

SIZE LIMITS — keep the plan tight to control cost; do NOT pad:
- Checklist: exactly 5 time-grouped sections (e.g. "12 months before" down to "Wedding week"), 3–4 tasks each.
- Budget: exactly 5 categories, 3–4 line items each.
- Milestones: 4–5 key dated milestones.
- Keep ALL text terse: task and milestone titles under ~10 words; milestone descriptions one short sentence. Use "notes" sparingly — mainly to justify a budget figure — and keep them under ~12 words. Most checklist items need no notes at all.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "checklist": [
    {
      "month_label": "12 months before",
      "tasks": [
        { "task": "string", "category": "string", "notes": "optional string" }
      ]
    }
  ],
  "budget": [
    {
      "category": "string",
      "items": [
        { "item_name": "string", "estimated_amount": 0, "notes": "optional string" }
      ]
    }
  ],
  "milestones": [
    { "title": "string", "due_date": "YYYY-MM-DD", "description": "string" }
  ]
}`

    const message = await client.messages.create({
      // Haiku 4.5 ($1/$5 per M tok) — 3x cheaper than Sonnet ($3/$15). The plan
      // is heavily grounded by REAL_REFERENCE, so the model isn't doing much
      // free-form reasoning; Haiku handles the structured fill well.
      model: "claude-haiku-4-5",
      // Real output is ~3000 tokens; cap a little above so a runaway response
      // can never bill more than this (output is the dominant cost).
      max_tokens: 5000,
      messages: [{ role: "user", content: prompt }],
    })

    // Log token usage so per-call cost stays observable.
    const u = message.usage
    const cost = (u.input_tokens / 1e6) * 1 + (u.output_tokens / 1e6) * 5
    console.log(
      `generate-plan usage: in=${u.input_tokens} out=${u.output_tokens} ` +
        `cache_read=${u.cache_read_input_tokens ?? 0} ≈ $${cost.toFixed(4)}`
    )

    if (message.stop_reason === "max_tokens") {
      console.error("generate-plan: response hit max_tokens — output truncated")
      return NextResponse.json({ error: "Plan too large — please try again" }, { status: 500 })
    }

    const text = message.content[0].type === "text" ? message.content[0].text : ""

    // Strip any accidental markdown fences, then isolate the JSON object
    let cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
    const firstBrace = cleaned.indexOf("{")
    const lastBrace = cleaned.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)
    }
    const plan: GeneratedPlan = JSON.parse(cleaned)

    return NextResponse.json({ plan })
  } catch (err) {
    console.error("generate-plan error:", err)
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 })
  }
}
