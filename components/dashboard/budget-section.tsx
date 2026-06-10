"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BudgetItem } from "@/types/dashboard"

interface Props {
  items: BudgetItem[]
  onUpdate: (id: string, updates: Partial<BudgetItem>) => void
}

type EditField = "item_name" | "estimated_amount" | "actual_amount" | "notes"

export function BudgetSection({ items, onUpdate }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditField; value: string } | null>(null)

  const groups = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, BudgetItem[]>)

  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) =>
    (a[0]?.sort_order ?? 0) - (b[0]?.sort_order ?? 0)
  )

  const totalEstimated = items.reduce((s, i) => s + (i.estimated_amount ?? 0), 0)
  const totalActual = items.reduce((s, i) => s + (i.actual_amount ?? 0), 0)

  const fmt = (n: number) => `$${n.toLocaleString("en-SG")}`

  const startEdit = (item: BudgetItem, field: EditField) => {
    const value = String(item[field] ?? "")
    setEditingCell({ id: item.id, field, value })
  }

  const commitEdit = () => {
    if (!editingCell) return
    const { id, field, value } = editingCell
    const isNum = field === "estimated_amount" || field === "actual_amount"
    const update: Partial<BudgetItem> = {
      [field]: isNum ? (parseInt(value) || 0) : (value.trim() || undefined),
    }
    onUpdate(id, update)
    setEditingCell(null)
  }

  const isEditing = (id: string, field: EditField) =>
    editingCell?.id === id && editingCell?.field === field

  const EditableCell = ({
    item, field, display, numeric, className,
  }: {
    item: BudgetItem; field: EditField; display: string; numeric?: boolean; className?: string
  }) => (
    <td
      className={cn("px-3 py-2 cursor-text group/cell", className)}
      onClick={() => !isEditing(item.id, field) && startEdit(item, field)}
    >
      {isEditing(item.id, field) ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            type={numeric ? "number" : "text"}
            className="h-7 text-xs w-full"
            value={editingCell!.value}
            onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null) }}
          />
        </div>
      ) : (
        <span className="flex items-center gap-1 hover:bg-blue-50 rounded px-1 py-0.5 -mx-1 transition-colors">
          {display || <span className="text-gray-300">—</span>}
          <Pencil className="h-2.5 w-2.5 text-gray-300 opacity-0 group-hover/cell:opacity-100 shrink-0" />
        </span>
      )}
    </td>
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Budget Breakdown</h2>
        <div className="text-sm text-gray-500">
          Estimated: <span className="font-semibold text-gray-900">{fmt(totalEstimated)}</span>
          {totalActual > 0 && (
            <> · Actual: <span className={cn("font-semibold", totalActual > totalEstimated ? "text-red-500" : "text-green-600")}>{fmt(totalActual)}</span></>
          )}
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">Item</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600 w-32">Estimated (SGD)</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600 w-32">Actual (SGD)</th>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600 w-48">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map(([category, groupItems]) => {
              const catEstimated = groupItems.reduce((s, i) => s + (i.estimated_amount ?? 0), 0)
              const catActual = groupItems.reduce((s, i) => s + (i.actual_amount ?? 0), 0)
              return (
                <>
                  <tr key={`${category}-header`} className="bg-gray-50/50 border-t border-b border-gray-100">
                    <td colSpan={4} className="px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</span>
                        <span className="text-xs text-gray-400">{fmt(catEstimated)}{catActual > 0 ? ` / ${fmt(catActual)}` : ""}</span>
                      </div>
                    </td>
                  </tr>
                  {groupItems.sort((a, b) => a.sort_order - b.sort_order).map(item => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <EditableCell item={item} field="item_name" display={item.item_name} />
                      <EditableCell
                        item={item} field="estimated_amount"
                        display={fmt(item.estimated_amount)}
                        numeric className="text-right tabular-nums"
                      />
                      <EditableCell
                        item={item} field="actual_amount"
                        display={item.actual_amount != null ? fmt(item.actual_amount) : ""}
                        numeric className="text-right tabular-nums"
                      />
                      <EditableCell item={item} field="notes" display={item.notes ?? ""} className="text-xs text-gray-400" />
                    </tr>
                  ))}
                </>
              )
            })}
            <tr className="bg-gray-50 border-t-2 font-semibold">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(totalEstimated)}</td>
              <td className={cn("px-3 py-2.5 text-right tabular-nums", totalActual > totalEstimated ? "text-red-500" : totalActual > 0 ? "text-green-600" : "")}>
                {totalActual > 0 ? fmt(totalActual) : "—"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">Click any cell to edit. Actual column tracks real spend as vendors are confirmed.</p>
    </section>
  )
}
