"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { Sidebar } from "@/components/planner/sidebar-with-edit"
import { TableComponent } from "@/components/planner/table-component"
import { ExportCSV } from "@/components/planner/export-csv"
import { CsvImport } from "@/components/planner/csv-import"
import { Button } from "@/components/ui/button"
import { Plus, Undo2, Redo2, Minus, Maximize2 } from "lucide-react"
import { AuthProvider } from "@/components/auth-provider"
import type { Guest, Table } from "@/types/planner"
import type { Session } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface State {
  tables: Table[]
  guests: Guest[]
}

function PlannerContent() {
  const router = useRouter()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = url && key ? createBrowserClient(url, key) : null
  const [tables, setTables] = useState<Table[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(0.7)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingTable, setDraggingTable] = useState<{
    id: string; startMouseX: number; startMouseY: number; origX: number; origY: number
  } | null>(null)
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)

  // History management
  const [history, setHistory] = useState<State[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  const saveState = useCallback((newTables: Table[], newGuests: Guest[]) => {
    const newState = { tables: [...newTables], guests: [...newGuests] }
    setHistory((prev) => {
      // Clear any redo states
      const newHistory = prev.slice(0, currentIndex + 1)
      newHistory.push(newState)
      return newHistory
    })
    setCurrentIndex((prev) => prev + 1)
  }, [currentIndex])

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = currentIndex - 1
      const state = history[newIndex]
      setTables([...state.tables])
      setGuests([...state.guests])
      setCurrentIndex(newIndex)
    }
  }, [canUndo, currentIndex, history])

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = currentIndex + 1
      const state = history[newIndex]
      setTables([...state.tables])
      setGuests([...state.guests])
      setCurrentIndex(newIndex)
    }
  }, [canRedo, currentIndex, history])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) {
      router.push("/login")
      return
    }

    // DEV ONLY: skip auth so the planner is viewable without a Supabase account
    if (process.env.NODE_ENV === 'development') return

    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }
      setSession(session)
    }

    fetchSession()
  }, [supabase, router])

  useEffect(() => {
    // DEV ONLY: skip data fetch, just stop the loading spinner
    if (process.env.NODE_ENV === 'development' && !session) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      if (!session?.user.id) return

      const { data: tablesData, error: tablesError } = await supabase
        .from("tables")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true })

      if (tablesError) {
        console.error("Error fetching tables:", tablesError)
        return
      }

      const { data: guestsData, error: guestsError } = await supabase
        .from("guests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true })

      if (guestsError) {
        console.error("Error fetching guests:", guestsError)
        return
      }

      setTables(tablesData)
      setGuests(guestsData)
      setLoading(false)
    }

    if (session?.user.id) {
      fetchData()
    }
  }, [session, supabase])

  const handleImport = async (importedGuests: { name: string; email?: string; contact?: string; dietary_restrictions?: string; meal_preference?: string; rsvp_status?: string; table?: string }[]) => {
    // DEV ONLY: import into local state without Supabase
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
        name: g.name,
        email: g.email ?? null,
        contact: g.contact ?? null,
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

    // First, create tables from unique table names
    const uniqueTableNames = [...new Set(importedGuests.map(guest => guest.table).filter(Boolean))]
    const tableMap = new Map<string, string>() // Map table names to table IDs

    // Calculate grid positions
    const GRID_SIZE = 200 // Space between tables
    const TABLES_PER_ROW = 5 // Maximum tables per row
    let currentRow = 0
    let currentCol = 0

    for (const tableName of uniqueTableNames) {
      if (!tableName) continue

      // Check if table already exists
      const existingTable = tables.find(t => t.name === tableName)
      if (existingTable) {
        tableMap.set(tableName, existingTable.id)
        continue
      }

      // Calculate position on grid
      const x = currentCol * GRID_SIZE + 50 // 50px padding from left
      const y = currentRow * GRID_SIZE + 50 // 50px padding from top

      // Create new table
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .insert({
          name: tableName,
          shape: "round",
          capacity: 10,
          x,
          y,
          user_id: session.user.id,
        })
        .select()
        .single()

      if (tableError) throw tableError
      if (tableData) {
        tableMap.set(tableName, tableData.id)
        setTables(prev => [...prev, tableData])
        
        // Update grid position
        currentCol++
        if (currentCol >= TABLES_PER_ROW) {
          currentCol = 0
          currentRow++
        }
      }
    }

    // Then create guests and assign them to tables
    const newGuests = await Promise.all(
      importedGuests.map(async (guest) => {
        const tableId = guest.table ? tableMap.get(guest.table) : undefined
        const { data, error } = await supabase
          .from("guests")
          .insert({
            name: guest.name,
            dietary_restrictions: guest.meal_preference,
            rsvp_status: guest.rsvp_status,
            table_id: tableId,
            user_id: session.user.id,
          })
          .select()
          .single()

        if (error) throw error
        return data
      })
    )

    setGuests((prev) => [...prev, ...newGuests])
    saveState([...tables], [...guests, ...newGuests])
  }

  const [newTable, setNewTable] = useState<{
    name: string
    capacity: number
    shape: "round" | "square" | "rectangular"
  }>({
    name: "",
    capacity: 8,
    shape: "round",
  })

  const handleAddTable = async () => {
    const tableCount = tables.length
    const row = Math.floor(tableCount / 5)
    const col = tableCount % 5
    const tableData = {
      name: newTable.name || `Table ${tableCount + 1}`,
      shape: newTable.shape,
      capacity: newTable.capacity,
      x: col * 280 + 50,
      y: row * 220 + 50,
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
      const { data, error } = await supabase!
        .from("tables").insert([tableData]).select().single()

      if (error) {
        console.error("Error adding table:", error.message)
        return
      }

      if (!data) {
        console.error("No data returned after adding table")
        return
      }

      const newTables = [...tables, data]
      setTables(newTables)
      saveState(newTables, guests)
      setNewTable({ name: "", capacity: 8, shape: "round" })
      setIsAddTableOpen(false)
    } catch (error) {
      console.error("Unexpected error adding table:", error)
    }
  }

  const isDev = process.env.NODE_ENV === 'development' && !session

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
      const { data: newGuest, error } = await supabase!
        .from("guests").insert([{ ...data, user_id: s.user.id }]).select().single()
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

  const handleZoom = (delta: number) => {
    setScale((prev) => {
      const newScale = Math.max(0.1, Math.min(2.0, prev + delta))
      return newScale
    })
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleZoom(-e.deltaY * 0.001)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  })

  const [spacePressed, setSpacePressed] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault() // prevent browser auto-scroll on middle click
    // Enable panning with left click, middle mouse button, or when holding space
    if (e.button === 0 || e.button === 1 || (e.button === 0 && spacePressed)) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const SNAP = 40

  const snapToGrid = (v: number) => Math.round(v / SNAP) * SNAP

  const handleTableDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const table = tables.find(t => t.id === id)
    if (!table) return
    setDraggingTable({ id, startMouseX: e.clientX, startMouseY: e.clientY, origX: table.x, origY: table.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingTable) {
      const dx = (e.clientX - draggingTable.startMouseX) / scale
      const dy = (e.clientY - draggingTable.startMouseY) / scale
      setTables(prev => prev.map(t =>
        t.id === draggingTable.id
          ? { ...t, x: snapToGrid(draggingTable.origX + dx), y: snapToGrid(draggingTable.origY + dy) }
          : t
      ))
      return
    }
    if (isDragging) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
    if (draggingTable) {
      const table = tables.find(t => t.id === draggingTable.id)
      if (table) handleUpdateTable(draggingTable.id, { x: snapToGrid(table.x), y: snapToGrid(table.y) })
      setDraggingTable(null)
      return
    }
    if (isDragging) {
      setIsDragging(false)
    }
  }

  // Add keyboard shortcut for space bar to enable panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setSpacePressed(true)
        document.body.style.cursor = 'grab'
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
        document.body.style.cursor = 'default'
        setIsDragging(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen overflow-hidden">
          <Sidebar
            guests={guests}
            tables={tables}
            onAddGuest={handleAddGuest}
            onUpdateGuest={handleUpdateGuest}
            onDeleteGuest={handleDeleteGuest}
            onDeleteManyGuests={handleDeleteManyGuests}
            onDeleteManyTables={handleDeleteManyTables}
            onAddTable={() => setIsAddTableOpen(true)}
          />
          <div className="flex-1 relative overflow-hidden">
            <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Table</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Table Name</Label>
                    <Input
                      id="name"
                      value={newTable.name}
                      onChange={(e) => setNewTable(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter table name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Number of Guests</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      max="20"
                      value={newTable.capacity}
                      onChange={(e) => setNewTable(prev => ({ ...prev, capacity: parseInt(e.target.value) || 8 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shape">Table Shape</Label>
                    <Select
                      value={newTable.shape}
                      onValueChange={(value: "round" | "square" | "rectangular") =>
                        setNewTable(prev => ({ ...prev, shape: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shape" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round">Round</SelectItem>
                        <SelectItem value="square">Square</SelectItem>
                        <SelectItem value="rectangular">Rectangular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddTable} className="w-full">
                    Add Table
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <div
              ref={canvasRef}
              className="w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: draggingTable ? 'grabbing' : isDragging ? 'grabbing' : 'default' }}
            >
              <div
                style={{
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.1s ease-out",
                }}
              >
                <div 
                  className="absolute inset-0 bg-grid" 
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                      linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                    `,
                    backgroundSize: "160px 160px",
                    backgroundPosition: "0px 0px",
                    width: "20000px",
                    height: "20000px",
                    left: "-10000px",
                    top: "-10000px",
                  }}
                />
                {tables.map((table) => (
                  <TableComponent
                    key={table.id}
                    table={table}
                    guests={guests.filter((guest) => guest.table_id === table.id)}
                    onUpdate={handleUpdateTable}
                    onDelete={handleDeleteTable}
                    onUpdateGuest={handleUpdateGuest}
                    onDragStart={handleTableDragStart}
                  />
                ))}
              </div>
            </div>

            {/* Figma-style floating toolbar — fixed centre bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-lg px-2 py-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleZoom(0.1)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleZoom(-0.1)}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setScale(0.7); setPosition({ x: 0, y: 0 }) }}>
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

interface TableComponentProps {
  table: Table
  guests: Guest[]
  onUpdate: (id: string, updates: Partial<Table>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
}

