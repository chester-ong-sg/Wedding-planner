"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// Shown one at a time, cross-fading. Local touches, not generic "loading…".
const MESSAGES = [
  "Checking auspicious dates · 择日",
  "Lining up the tea ceremony · 敬茶",
  "Rehearsing the gate-crash · 闯门",
  "Counting the angpao · 红包",
  "Working out your budget in SGD",
]

// A personalised plan is written by the AI and can take up to a minute, so the
// messages are paced slower and the last one is honest about the wait rather
// than pretending we're nearly done.
const PERSONALISED_MESSAGES = [
  "Reading what you told us",
  "Checking auspicious dates · 择日",
  "Making room for what you're excited about",
  "Working through your worries, one by one",
  "Lining up the tea ceremony · 敬茶",
  "Counting the angpao · 红包",
  "Working out your budget in SGD",
  "Writing it all up. This one takes a little longer",
]

const MESSAGE_INTERVAL_MS = 650
const PERSONALISED_INTERVAL_MS = 3500

// Fixed positions (not random) so the composition is stable between renders.
const SPARKLES: { left: string; top: string; size: number; delay: string; dur: string; tone: "rose" | "gold" }[] = [
  { left: "8%", top: "62%", size: 8, delay: "0s", dur: "2.8s", tone: "gold" },
  { left: "20%", top: "78%", size: 6, delay: "0.5s", dur: "2.4s", tone: "rose" },
  { left: "33%", top: "88%", size: 10, delay: "1.1s", dur: "3s", tone: "gold" },
  { left: "48%", top: "92%", size: 6, delay: "0.3s", dur: "2.6s", tone: "rose" },
  { left: "63%", top: "86%", size: 9, delay: "0.9s", dur: "2.9s", tone: "gold" },
  { left: "77%", top: "76%", size: 6, delay: "1.4s", dur: "2.5s", tone: "rose" },
  { left: "90%", top: "64%", size: 8, delay: "0.2s", dur: "2.7s", tone: "gold" },
  { left: "14%", top: "44%", size: 5, delay: "1.7s", dur: "2.6s", tone: "rose" },
  { left: "86%", top: "46%", size: 5, delay: "0.7s", dur: "2.8s", tone: "rose" },
]

export function GeneratingScreen({ ready, personalised = false }: { ready: boolean; personalised?: boolean }) {
  const [index, setIndex] = useState(0)
  const messages = personalised ? PERSONALISED_MESSAGES : MESSAGES

  // Advance through the messages, then hold on the last one until we're ready.
  useEffect(() => {
    if (ready) return
    const id = setInterval(
      () => setIndex(i => Math.min(i + 1, messages.length - 1)),
      personalised ? PERSONALISED_INTERVAL_MS : MESSAGE_INTERVAL_MS,
    )
    return () => clearInterval(id)
  }, [ready, personalised, messages.length])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      {/* The mark */}
      <div className="relative h-56 w-72 flex items-center justify-center" aria-hidden="true">
        <div
          className="onb-breathe absolute h-52 w-52 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(38 80% 85%) 0%, hsl(38 72% 93% / 0.6) 50%, transparent 72%)" }}
        />
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className={cn("onb-rise absolute rotate-45 rounded-[2px]", s.tone === "rose" ? "bg-brand-rose" : "bg-primary")}
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: 0,
              ["--delay" as string]: s.delay,
              ["--dur" as string]: s.dur,
            }}
          />
        ))}
        <span
          key={ready ? "ready" : "working"}
          className={cn("relative text-8xl leading-none text-brand-rose select-none", ready && "onb-stamp")}
        >
          囍
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
        <h2 className="text-2xl font-semibold text-foreground">
          {ready ? "Your plan is ready" : "Putting your plan together…"}
        </h2>
        {/* Rotating line is decorative — the heading carries the accessible state. */}
        <p aria-hidden="true" className="h-5 text-sm text-muted-foreground">
          {ready ? (
            "Taking you to your dashboard"
          ) : (
            <span key={index} className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              {messages[index]}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
