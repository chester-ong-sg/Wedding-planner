"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { DndProvider, useDrop } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Sidebar } from "@/components/planner/sidebar-with-edit"
import { KonvaStage } from "@/components/planner/konva-stage"
import { ExportCSV } from "@/components/planner/export-csv"
import { CsvImport } from "@/components/planner/csv-import"
import { Button } from "@/components/ui/button"
import { Plus, Undo2, Redo2, Minus, Maximize2, Edit2, Users, Trash2 } from "lucide-react"
import { AuthProvider } from "@/components/auth-provider"
import type { Guest, Table } from "@/types/planner"
import type { ViewMode } from "@/components/planner/sidebar-with-edit"
import type { Session } from "@supabase/supabase-js"
import type Konva from "konva"
import { TABLE_RADIUS, SQ_W, RECT_W, RECT_H } from "@/components/planner/konva-table"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AppState {
  tables: Table[]
  guests: Guest[]
}

interface DragItem {
  type: "guest"
  id: string
  tableId: string | null
}

// ─── EditTableDialog ──────────────────────────────────────────────────────────

function EditTableDialog({
  table,
  onSave,
  onClose,
}: {
  table: Table
  onSave: (id: string, updates: Partial<Table>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(table.name)
  const [shape, setShape] = useState<Table["shape"]>(table.shape)
  const [capacity, setCapacity] = useState(table.capacity)

  const handleSave = async () => {
    await onSave(table.id, { name, shape, capacity })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm font-medium">Shape</Label>
            <Select value={shape} onValueChange={(v) => setShape(v as Table["shape"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round">Round</SelectItem>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="rectangular">Rectangular</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Capacity</Label>
            <Input
              type="number" min="1" max="20" value={capacity} className="mt-1"
              onChange={(e) => {
                const v = parseInt(e.target.value)
                setCapacity(isNaN(v) ? 1 : Math.max(1, Math.min(20, v)))
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

type EditableField = "name" | "email" | "contact" | "dietary_restrictions" | "rsvp_status"

function EditableCell({
  value, isEditing, onChange, onBlur, onDoubleClick,
}: {
  value: string; isEditing: boolean
  onChange: (v: string) => void; onBlur: () => void; onDoubleClick: () => void
}) {
  return isEditing ? (
    <input
      autoFocus
      className="w-full bg-blue-50 border-b border-blue-400 outline-none px-1 py-0.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  ) : (
    <span className="block cursor-default select-none" onDoubleClick={onDoubleClick} title="Double-click to edit">
      {value || "—"}
    </span>
  )
}

// ─── ViewGuestsDialog ─────────────────────────────────────────────────────────

type LocalGuest = Guest & { _dirty?: boolean }

function ViewGuestsDialog({
  table,
  guests,
  onUpdateGuest,
  onClose,
}: {
  table: Table
  guests: Guest[]
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
  onClose: () => void
}) {
  const [localGuests, setLocalGuests] = useState<LocalGuest[]>(() => guests.map(g => ({ ...g })))
  const [editingCell, setEditingCell] = useState<{ guestId: string; field: EditableField } | null>(null)

  const handleCellChange = (guestId: string, field: EditableField, value: string) =>
    setLocalGuests(prev => prev.map(g => g.id === guestId ? { ...g, [field]: value, _dirty: true } : g))

  const handleClose = async () => {
    const dirty = localGuests.filter(g => g._dirty)
    for (const g of dirty) {
      await onUpdateGuest(g.id, {
        name: g.name, email: g.email, contact: g.contact,
        dietary_restrictions: g.dietary_restrictions, rsvp_status: g.rsvp_status,
      })
    }
    if (dirty.length > 0) toast.success("Changes saved", { duration: 2000 })
    setEditingCell(null)
    onClose()
  }

  const isActive = (guestId: string, field: EditableField) =>
    editingCell?.guestId === guestId && editingCell.field === field

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{table.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-400 -mt-2">Double-click any cell to edit. Changes save when you close.</p>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[160px]" /><col className="w-[200px]" />
              <col className="w-[140px]" /><col className="w-[180px]" /><col className="w-[110px]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Dietary Restrictions</th>
                <th className="px-4 py-3">RSVP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {localGuests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No guests assigned to this table
                  </td>
                </tr>
              ) : localGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <EditableCell value={guest.name ?? ""} isEditing={isActive(guest.id, "name")}
                      onChange={(v) => handleCellChange(guest.id, "name", v)}
                      onBlur={() => setEditingCell(null)}
                      onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "name" })} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <EditableCell value={guest.email ?? ""} isEditing={isActive(guest.id, "email")}
                      onChange={(v) => handleCellChange(guest.id, "email", v)}
                      onBlur={() => setEditingCell(null)}
                      onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "email" })} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <EditableCell value={guest.contact ?? ""} isEditing={isActive(guest.id, "contact")}
                      onChange={(v) => handleCellChange(guest.id, "contact", v)}
                      onBlur={() => setEditingCell(null)}
                      onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "contact" })} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <EditableCell value={guest.dietary_restrictions ?? ""} isEditing={isActive(guest.id, "dietary_restrictions")}
                      onChange={(v) => handleCellChange(guest.id, "dietary_restrictions", v)}
                      onBlur={() => setEditingCell(null)}
                      onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "dietary_restrictions" })} />
                  </td>
                  <td className="px-4 py-3">
                    {isActive(guest.id, "rsvp_status") ? (
                      <select autoFocus
                        className="w-full bg-blue-50 border-b border-blue-400 outline-none text-sm py-0.5"
                        value={guest.rsvp_status ?? ""}
                        onChange={(e) => handleCellChange(guest.id, "rsvp_status", e.target.value)}
                        onBlur={() => setEditingCell(null)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex cursor-default items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${guest.rsvp_status === "accepted" ? "bg-green-100 text-green-700" : guest.rsvp_status === "declined" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
                        onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "rsvp_status" })}
                        title="Double-click to edit"
                      >
                        {guest.rsvp_status === "accepted" ? "Accepted" : guest.rsvp_status === "declined" ? "Declined" : "Pending"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── PlannerCanvas ────────────────────────────────────────────────────────────
// Must be a child of DndProvider so useDrop works

interface PlannerCanvasProps {
  tables: Table[]
  guests: Guest[]
  selectedIds: Set<string>
  stageRef: React.RefObject<Konva.Stage | null>
  onSelect: (id: string, shiftKey: boolean) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onStageClick: () => void
  onDoubleClick: (id: string) => void
  onContextMenu: (id: string, clientX: number, clientY: number) => void
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
}

function PlannerCanvas({
  tables, guests, selectedIds, stageRef,
  onSelect, onDragEnd, onStageClick, onDoubleClick, onContextMenu, onUpdateGuest,
}: PlannerCanvasProps) {
  const [, stageDrop] = useDrop<DragItem, void, never>({
    accept: "guest",
    drop: (item, monitor) => {
      const offset = monitor.getClientOffset()
      const stage = stageRef.current
      if (!offset || !stage) return

      const box = stage.container().getBoundingClientRect()
      const cx = (offset.x - box.left - stage.x()) / stage.scaleX()
      const cy = (offset.y - box.top - stage.y()) / stage.scaleY()

      // Hit-test each table using its actual geometry
      const hit = tables.find(t => {
        if (t.shape === "round") {
          const dx = cx - (t.x + TABLE_RADIUS)
          const dy = cy - (t.y + TABLE_RADIUS)
          return dx * dx + dy * dy <= TABLE_RADIUS * TABLE_RADIUS
        }
        const w = t.shape === "rectangular" ? RECT_W : SQ_W
        const h = t.shape === "rectangular" ? RECT_H : SQ_W
        return cx >= t.x && cx <= t.x + w && cy >= t.y && cy <= t.y + h
      })

      if (!hit) return
      const assigned = guests.filter(g => g.table_id === hit.id)
      if (assigned.some(g => g.id === item.id)) return  // already at this table
      if (assigned.length >= hit.capacity) return        // table full
      onUpdateGuest(item.id, { table_id: hit.id })
    },
  })

  return (
    <div ref={stageDrop as unknown as React.RefCallback<HTMLDivElement>} className="w-full h-full">
      <KonvaStage
        stageRef={stageRef}
        tables={tables}
        guests={guests}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onDragEnd={onDragEnd}
        onStageClick={onStageClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
    </div>
  )
}

// ─── PlannerContent ───────────────────────────────────────────────────────────

function PlannerContent() {
  const router = useRouter()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = url && key ? createBrowserClient(url, key) : null

  const [tables, setTables] = useState<Table[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  // Konva stage ref — used for zoom/pan and drop-target coordinate conversion
  const stageRef = useRef<Konva.Stage | null>(null)

  // Dialog state
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [viewingGuestsTableId, setViewingGuestsTableId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ tableId: string; x: number; y: number } | null>(null)

  // History
  const [hist, setHist] = useState<{ log: AppState[]; idx: number }>({ log: [], idx: -1 })
  const canUndo = hist.idx > 0
  const canRedo = hist.idx < hist.log.length - 1

  const saveState = useCallback((newTables: Table[], newGuests: Guest[]) => {
    const newState = { tables: [...newTables], guests: [...newGuests] }
    setHist(prev => {
      const newLog = prev.log.slice(0, prev.idx + 1)
      newLog.push(newState)
      return { log: newLog, idx: prev.idx + 1 }
    })
  }, [])

  const undo = useCallback(() => {
    if (!canUndo) return
    const newIdx = hist.idx - 1
    const state = hist.log[newIdx]
    if (!state) return
    setTables([...state.tables])
    setGuests([...state.guests])
    setHist(prev => ({ ...prev, idx: newIdx }))
  }, [canUndo, hist])

  const redo = useCallback(() => {
    if (!canRedo) return
    const newIdx = hist.idx + 1
    const state = hist.log[newIdx]
    if (!state) return
    setTables([...state.tables])
    setGuests([...state.guests])
    setHist(prev => ({ ...prev, idx: newIdx }))
  }, [canRedo, hist])

  // Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Backspace → delete selected tables
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return
      if (selectedIds.size > 0) {
        e.preventDefault()
        setPendingDelete([...selectedIds])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds])

  // Dismiss context menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) { router.push("/login"); return }
    if (process.env.NODE_ENV === 'development') return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setSession(session)
    })
  }, [supabase, router])

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !session) {
      setHist({ log: [{ tables: [], guests: [] }], idx: 0 })
      setLoading(false)
      return
    }
    if (!session?.user.id) return
    const fetchData = async () => {
      const { data: tablesData, error: tablesError } = await supabase!
        .from("tables").select("*").eq("user_id", session.user.id).order("created_at", { ascending: true })
      if (tablesError) { console.error("Error fetching tables:", tablesError); return }
      const { data: guestsData, error: guestsError } = await supabase!
        .from("guests").select("*").eq("user_id", session.user.id).order("created_at", { ascending: true })
      if (guestsError) { console.error("Error fetching guests:", guestsError); return }
      setTables(tablesData)
      setGuests(guestsData)
      setHist({ log: [{ tables: tablesData, guests: guestsData }], idx: 0 })
      setLoading(false)
    }
    fetchData()
  }, [session, supabase])

  const isDev = process.env.NODE_ENV === 'development' && !session

  // ── Konva canvas callbacks ────────────────────────────────────────────────

  const handleTableSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      if (shiftKey) {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      }
      return new Set([id])
    })
  }, [])

  const handleTableDragEnd = useCallback(async (id: string, x: number, y: number) => {
    const newTables = tables.map(t => t.id === id ? { ...t, x, y } : t)
    setTables(newTables)
    saveState(newTables, guests)
    if (!isDev) {
      await supabase!.from("tables").update({ x, y }).eq("id", id)
    }
  }, [tables, guests, isDev, supabase, saveState])

  // Toolbar zoom — delegates to stage imperatively
  const handleZoom = (delta: number) => {
    const stage = stageRef.current
    if (!stage) return
    const newScale = Math.max(0.1, Math.min(3.0, stage.scaleX() + delta))
    stage.scaleX(newScale)
    stage.scaleY(newScale)
    stage.batchDraw()
  }

  const handleResetView = () => {
    const stage = stageRef.current
    if (!stage) return
    stage.scale({ x: 0.7, y: 0.7 })
    stage.position({ x: 0, y: 0 })
    stage.batchDraw()
  }

  // ── Data handlers (unchanged) ────────────────────────────────────────────

  const handleImport = async (importedGuests: { name: string; email?: string; contact?: string; dietary_restrictions?: string; meal_preference?: string; rsvp_status?: string; table?: string }[]) => {
    if (process.env.NODE_ENV === 'development' && !session) {
      const GRID_SIZE = 200
      const TABLES_PER_ROW = 5
      let currentRow = 0
      let currentCol = 0
      const tableMap = new Map<string, string>()
      const newTables: typeof tables = []
      const uniqueTableNames = [...new Set(importedGuests.map(g => g.table).filter(Boolean))]
      for (const tableName of uniqueTableNames) {
        if (!tableName) continue
        const existing = tables.find(t => t.name === tableName)
        if (existing) { tableMap.set(tableName, existing.id); continue }
        const id = crypto.randomUUID()
        const x = currentCol * GRID_SIZE + 50
        const y = currentRow * GRID_SIZE + 50
        const table = { id, name: tableName, shape: 'round' as const, capacity: 10, x, y, user_id: 'dev' }
        tableMap.set(tableName, id)
        newTables.push(table)
        currentCol++
        if (currentCol >= TABLES_PER_ROW) { currentCol = 0; currentRow++ }
      }
      const newGuests = importedGuests.map(g => ({
        id: crypto.randomUUID(),
        name: g.name, email: g.email ?? null, contact: g.contact ?? null,
        dietary_restrictions: g.dietary_restrictions ?? g.meal_preference ?? null,
        rsvp_status: (g.rsvp_status as 'pending' | 'accepted' | 'declined') ?? 'pending',
        table_id: g.table ? tableMap.get(g.table) ?? null : null,
        user_id: 'dev',
      }))
      setTables(prev => { const next = [...prev, ...newTables]; saveState(next, [...guests, ...newGuests]); return next })
      setGuests(prev => [...prev, ...newGuests])
      return
    }
    if (!session?.user.id) return
    const uniqueTableNames = [...new Set(importedGuests.map(guest => guest.table).filter(Boolean))]
    const tableMap = new Map<string, string>()
    const GRID_SIZE = 200
    const TABLES_PER_ROW = 5
    let currentRow = 0
    let currentCol = 0
    for (const tableName of uniqueTableNames) {
      if (!tableName) continue
      const existingTable = tables.find(t => t.name === tableName)
      if (existingTable) { tableMap.set(tableName, existingTable.id); continue }
      const x = currentCol * GRID_SIZE + 50
      const y = currentRow * GRID_SIZE + 50
      const { data: tableData, error: tableError } = await supabase!
        .from("tables").insert({ name: tableName, shape: "round", capacity: 10, x, y, user_id: session.user.id })
        .select().single()
      if (tableError) throw tableError
      if (tableData) {
        tableMap.set(tableName, tableData.id)
        setTables(prev => [...prev, tableData])
        currentCol++
        if (currentCol >= TABLES_PER_ROW) { currentCol = 0; currentRow++ }
      }
    }
    const newGuests = await Promise.all(
      importedGuests.map(async (guest) => {
        const tableId = guest.table ? tableMap.get(guest.table) : undefined
        const { data, error } = await supabase!
          .from("guests").insert({
            name: guest.name, dietary_restrictions: guest.meal_preference,
            rsvp_status: guest.rsvp_status, table_id: tableId, user_id: session.user.id,
          }).select().single()
        if (error) throw error
        return data
      })
    )
    setGuests((prev) => [...prev, ...newGuests])
    saveState([...tables], [...guests, ...newGuests])
  }

  const [newTable, setNewTable] = useState<{ name: string; capacity: number; shape: "round" | "square" | "rectangular" }>({
    name: "", capacity: 8, shape: "round",
  })

  const handleAddTable = async () => {
    const tableCount = tables.length
    const row = Math.floor(tableCount / 5)
    const col = tableCount % 5
    const tableData = {
      name: newTable.name || `Table ${tableCount + 1}`,
      shape: newTable.shape, capacity: newTable.capacity,
      x: col * 280 + 50, y: row * 220 + 50,
      user_id: isDev ? 'dev' : '',
    }
    if (isDev) {
      const data = { id: crypto.randomUUID(), ...tableData }
      const newTables = [...tables, data]
      setTables(newTables)
      saveState(newTables, guests)
      setNewTable({ name: "", capacity: 8, shape: "round" })
      setIsAddTableOpen(false)
      return
    }
    const { data: { session } } = await supabase!.auth.getSession()
    if (!session) { console.error("No session found"); return }
    tableData.user_id = session.user.id
    try {
      const { data, error } = await supabase!.from("tables").insert([tableData]).select().single()
      if (error) { console.error("Error adding table:", error.message); return }
      if (!data) { console.error("No data returned after adding table"); return }
      const newTables = [...tables, data]
      setTables(newTables)
      saveState(newTables, guests)
      setNewTable({ name: "", capacity: 8, shape: "round" })
      setIsAddTableOpen(false)
    } catch (error) {
      console.error("Unexpected error adding table:", error)
    }
  }

  const handleUpdateTable = async (id: string, updates: Partial<Table>) => {
    if (!isDev) {
      const { error } = await supabase!.from("tables").update(updates).eq("id", id)
      if (error) { console.error("Error updating table:", error); return }
    }
    const newTables = tables.map((t) => (t.id === id ? { ...t, ...updates } : t))
    setTables(newTables)
    saveState(newTables, guests)
  }

  const handleDeleteTable = async (id: string) => {
    if (!isDev) {
      const { error } = await supabase!.from("tables").delete().eq("id", id)
      if (error) { console.error("Error deleting table:", error); return }
    }
    const newTables = tables.filter((t) => t.id !== id)
    setTables(newTables)
    saveState(newTables, guests)
  }

  const handleAddGuest = async (data: Partial<Guest>) => {
    if (isDev) {
      const newGuest = { id: crypto.randomUUID(), user_id: 'dev', ...data } as Guest
      const newGuests = [...guests, newGuest]
      setGuests(newGuests)
      saveState(tables, newGuests)
      return
    }
    const { data: { session: s } } = await supabase!.auth.getSession()
    if (!s) { console.error("No session found"); return }
    try {
      const { data: newGuest, error } = await supabase!.from("guests").insert([{ ...data, user_id: s.user.id }]).select().single()
      if (error) { console.error("Error adding guest:", error.message); return }
      if (!newGuest) { console.error("No data returned after adding guest"); return }
      const newGuests = [...guests, newGuest]
      setGuests(newGuests)
      saveState(tables, newGuests)
    } catch (error) {
      console.error("Unexpected error adding guest:", error)
    }
  }

  const handleUpdateGuest = async (id: string, updates: Partial<Guest>) => {
    if (!isDev) {
      try {
        const { error } = await supabase!.from("guests").update(updates).eq("id", id)
        if (error) { console.error("Error updating guest:", error.message); return }
      } catch (error) {
        console.error("Unexpected error updating guest:", error); return
      }
    }
    const newGuests = guests.map((g) => (g.id === id ? { ...g, ...updates } : g))
    setGuests(newGuests)
    saveState(tables, newGuests)
  }

  const handleDeleteGuest = async (id: string) => {
    if (!isDev) {
      const { error } = await supabase!.from("guests").delete().eq("id", id)
      if (error) { console.error("Error deleting guest:", error); return }
    }
    const newGuests = guests.filter((g) => g.id !== id)
    setGuests(newGuests)
    saveState(tables, newGuests)
  }

  const handleDeleteManyGuests = async (ids: string[]) => {
    if (!isDev) {
      const { error } = await supabase!.from("guests").delete().in("id", ids)
      if (error) { console.error("Error bulk deleting guests:", error); return }
    }
    const newGuests = guests.filter((g) => !ids.includes(g.id))
    setGuests(newGuests)
    saveState(tables, newGuests)
  }

  const handleDeleteManyTables = async (ids: string[]) => {
    if (!isDev) {
      const { error } = await supabase!.from("tables").delete().in("id", ids)
      if (error) { console.error("Error bulk deleting tables:", error); return }
    }
    const newTables = tables.filter((t) => !ids.includes(t.id))
    const newGuests = guests.map((g) => ids.includes(g.table_id ?? "") ? { ...g, table_id: undefined } : g)
    setTables(newTables)
    setGuests(newGuests)
    saveState(newTables, newGuests)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  const editingTable = editingTableId ? tables.find(t => t.id === editingTableId) : null
  const viewingGuestsTable = viewingGuestsTableId ? tables.find(t => t.id === viewingGuestsTableId) : null

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen overflow-hidden" onClick={() => setContextMenu(null)}>
        <Sidebar
          guests={guests}
          tables={tables}
          onAddGuest={handleAddGuest}
          onUpdateGuest={handleUpdateGuest}
          onDeleteGuest={handleDeleteGuest}
          onDeleteManyGuests={handleDeleteManyGuests}
          onDeleteManyTables={handleDeleteManyTables}
          onAddTable={() => setIsAddTableOpen(true)}
          viewMode={viewMode}
          onViewChange={setViewMode}
          onImport={handleImport}
        />

        <div className={`flex-1 relative overflow-hidden ${viewMode === "table" ? "hidden" : ""}`}>
          {/* Add Table dialog */}
          <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Table</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Table Name</Label>
                  <Input id="name" value={newTable.name} onChange={(e) => setNewTable(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter table name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Number of Guests</Label>
                  <Input id="capacity" type="number" min="1" max="20" value={newTable.capacity} onChange={(e) => setNewTable(prev => ({ ...prev, capacity: parseInt(e.target.value) || 8 }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shape">Table Shape</Label>
                  <Select value={newTable.shape} onValueChange={(value: "round" | "square" | "rectangular") => setNewTable(prev => ({ ...prev, shape: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select shape" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round">Round</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="rectangular">Rectangular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddTable} className="w-full">Add Table</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Konva canvas */}
          <PlannerCanvas
            tables={tables}
            guests={guests}
            selectedIds={selectedIds}
            stageRef={stageRef}
            onSelect={handleTableSelect}
            onDragEnd={handleTableDragEnd}
            onStageClick={() => setSelectedIds(new Set())}
            onDoubleClick={(id) => setViewingGuestsTableId(id)}
            onContextMenu={(id, x, y) => { setContextMenu({ tableId: id, x, y }) }}
            onUpdateGuest={handleUpdateGuest}
          />

          {/* Floating toolbar */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-lg px-2 py-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleZoom(0.1)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleZoom(-0.1)}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleResetView}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <CsvImport onImport={handleImport} />
            <ExportCSV guests={guests} tables={tables} />
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left"
            onClick={() => { setViewingGuestsTableId(contextMenu.tableId); setContextMenu(null) }}
          >
            <Users className="h-4 w-4 text-gray-500" /> Guest List
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-left"
            onClick={() => { setEditingTableId(contextMenu.tableId); setContextMenu(null) }}
          >
            <Edit2 className="h-4 w-4 text-gray-500" /> Edit
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-left text-red-500"
            onClick={() => { setPendingDelete([contextMenu.tableId]); setContextMenu(null) }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}

      {/* Edit table dialog */}
      {editingTable && (
        <EditTableDialog
          key={editingTable.id}
          table={editingTable}
          onSave={handleUpdateTable}
          onClose={() => setEditingTableId(null)}
        />
      )}

      {/* View guests dialog */}
      {viewingGuestsTable && (
        <ViewGuestsDialog
          key={viewingGuestsTable.id}
          table={viewingGuestsTable}
          guests={guests.filter(g => g.table_id === viewingGuestsTable.id)}
          onUpdateGuest={handleUpdateGuest}
          onClose={() => setViewingGuestsTableId(null)}
        />
      )}

      {/* Delete confirmation */}
      {pendingDelete && (() => {
        const names = pendingDelete.map(id => tables.find(t => t.id === id)?.name).filter(Boolean) as string[]
        const count = names.length
        return (
          <AlertDialog open onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {count === 1 ? `Delete "${names[0]}"?` : `Delete ${count} tables?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {count === 1
                    ? `This will permanently remove "${names[0]}" and unassign all its guests.`
                    : `This will permanently remove: ${names.join(', ')}. All assigned guests will be unassigned.`
                  }{' '}This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600"
                  onClick={() => {
                    handleDeleteManyTables(pendingDelete)
                    setSelectedIds(new Set())
                    setPendingDelete(null)
                  }}
                >
                  Delete {count > 1 ? `${count} tables` : 'table'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      })()}
    </DndProvider>
  )
}

export default function PlannerPage() {
  return (
    <AuthProvider>
      <PlannerContent />
    </AuthProvider>
  )
}
