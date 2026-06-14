"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Circle, Pencil, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Milestone } from "@/types/dashboard"

interface Props {
  milestones: Milestone[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<Milestone>) => void
}

export function MilestonesSection({ milestones, onToggle, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const sorted = [...milestones].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  const formatDate = (d: string | null) => {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })
  }

  const daysUntil = (d: string | null) => {
    if (!d) return null
    const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000)
    if (diff < 0) return "Overdue"
    if (diff === 0) return "Today"
    return `${diff}d away`
  }

  const startEdit = (m: Milestone) => { setEditingId(m.id); setDraft(m.title) }
  const commitEdit = (id: string) => { onUpdate(id, { title: draft.trim() || undefined }); setEditingId(null) }
  const cancelEdit = () => setEditingId(null)

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Milestones</h2>
      <div className="flex flex-col gap-3">
        {sorted.map(m => {
          const days = daysUntil(m.due_date)
          const isOverdue = days === "Overdue"
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border transition-colors",
                m.is_completed ? "bg-secondary border-border opacity-60" : "bg-card border-border"
              )}
            >
              <button className="mt-0.5 shrink-0" onClick={() => onToggle(m.id, !m.is_completed)}>
                {m.is_completed
                  ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                  : <Circle className="h-5 w-5 text-border hover:text-muted-foreground" />
                }
              </button>
              <div className="flex-1 min-w-0">
                {editingId === m.id ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      className="h-7 text-sm"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(m.id); if (e.key === "Escape") cancelEdit() }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => commitEdit(m.id)}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className={cn("font-medium text-sm", m.is_completed && "line-through text-gray-400")}>{m.title}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(m)}>
                      <Pencil className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                )}
                {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
              </div>
              <div className="text-right shrink-0">
                {m.due_date && (
                  <>
                    <div className="text-xs text-gray-500">{formatDate(m.due_date)}</div>
                    <div className={cn("text-xs font-medium mt-0.5", isOverdue ? "text-destructive" : "text-brand-rose")}>
                      {days}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
