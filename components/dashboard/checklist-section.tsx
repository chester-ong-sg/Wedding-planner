"use client"

import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Pencil, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChecklistItem } from "@/types/dashboard"

const CATEGORY_COLORS: Record<string, string> = {
  Venue:          "bg-blue-100 text-blue-700",
  Finance:        "bg-green-100 text-green-700",
  Photography:    "bg-purple-100 text-purple-700",
  Attire:         "bg-pink-100 text-pink-700",
  Entertainment:  "bg-yellow-100 text-yellow-700",
  Customs:        "bg-red-100 text-red-700",
  Guests:         "bg-orange-100 text-orange-700",
  Planning:       "bg-gray-100 text-gray-700",
  Legal:          "bg-teal-100 text-teal-700",
}

interface Props {
  items: ChecklistItem[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<ChecklistItem>) => void
}

export function ChecklistSection({ items, onToggle, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  // Group by month_label preserving AI order (use first-seen sort_order per group)
  const groups = items.reduce((acc, item) => {
    if (!acc[item.month_label]) acc[item.month_label] = []
    acc[item.month_label].push(item)
    return acc
  }, {} as Record<string, ChecklistItem[]>)

  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) =>
    (a[0]?.sort_order ?? 0) - (b[0]?.sort_order ?? 0)
  )

  const completedCount = items.filter(i => i.is_completed).length

  const startEdit = (item: ChecklistItem) => { setEditingId(item.id); setDraft(item.task) }
  const commitEdit = (id: string) => { if (draft.trim()) onUpdate(id, { task: draft.trim() }); setEditingId(null) }
  const cancelEdit = () => setEditingId(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Wedding Checklist</h2>
        <span className="text-sm text-gray-500">{completedCount} / {items.length} done</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-rose-400 rounded-full transition-all duration-500"
          style={{ width: items.length ? `${(completedCount / items.length) * 100}%` : "0%" }}
        />
      </div>

      <Accordion type="multiple" defaultValue={sortedGroups.slice(0, 2).map(([k]) => k)} className="w-full">
        {sortedGroups.map(([label, groupItems]) => {
          const doneInGroup = groupItems.filter(i => i.is_completed).length
          return (
            <AccordionItem key={label} value={label}>
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex-1 text-left">{label}</span>
                <span className="text-xs text-gray-400 mr-2">{doneInGroup}/{groupItems.length}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2 pt-1 pb-2">
                  {groupItems.sort((a, b) => a.sort_order - b.sort_order).map(item => (
                    <div key={item.id} className="flex items-start gap-3 group py-1">
                      <Checkbox
                        className="mt-0.5"
                        checked={item.is_completed}
                        onCheckedChange={checked => onToggle(item.id, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        {editingId === item.id ? (
                          <div className="flex gap-2">
                            <Input
                              autoFocus
                              className="h-7 text-sm"
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") commitEdit(item.id); if (e.key === "Escape") cancelEdit() }}
                            />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => commitEdit(item.id)}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-sm", item.is_completed && "line-through text-gray-400")}>
                              {item.task}
                            </span>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => startEdit(item)}>
                              <Pencil className="h-3 w-3 text-gray-400" />
                            </button>
                          </div>
                        )}
                        {item.notes && !editingId && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      {item.category && (
                        <span className={cn(
                          "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium",
                          CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-600"
                        )}>
                          {item.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </section>
  )
}
