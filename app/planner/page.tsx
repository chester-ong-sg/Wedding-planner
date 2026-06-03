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
  DialogTrigger,
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

  const handleImport = async (importedGuests: { name: string; meal_preference?: string; rsvp_status?: string; table?: string }[]) => {
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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error("No session found")
      return
    }

    try {
      const tableCount = tables.length
      const row = Math.floor(tableCount / 5)
      const col = tableCount % 5

      const tableData = {
        name: newTable.name || `Table ${tableCount + 1}`,
        shape: newTable.shape,
        capacity: newTable.capacity,
        x: col * 280 + 50,
        y: row * 220 + 50,
        user_id: session.user.id,
      }

      const { data, error } = await supabase
        .from("tables")
        .insert([tableData])
        .select()
        .single()

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

  const handleUpdateTable = async (id: string, updates: Partial<Table>) => {
    const { error } = await supabase
      .from("tables")
      .update(updates)
      .eq("id", id)

    if (error) {
      console.error("Error updating table:", error)
      return
    }

    const newTables = tables.map((table) => (table.id === id ? { ...table, ...updates } : table))
    setTables(newTables)
    saveState(newTables, guests)
  }

  const handleDeleteTable = async (id: string) => {
    const { error } = await supabase.from("tables").delete().eq("id", id)

    if (error) {
      console.error("Error deleting table:", error)
      return
    }

    const newTables = tables.filter((table) => table.id !== id)
    setTables(newTables)
    saveState(newTables, guests)
  }

  const handleAddGuest = async (data: Partial<Guest>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error("No session found")
      return
    }

    try {
      const { data: newGuest, error } = await supabase
        .from("guests")
        .insert([{ ...data, user_id: session.user.id }])
        .select()
        .single()

      if (error) {
        console.error("Error adding guest:", error.message)
        return
      }

      if (!newGuest) {
        console.error("No data returned after adding guest")
        return
      }

      const newGuests = [...guests, newGuest]
      setGuests(newGuests)
      saveState(tables, newGuests)
    } catch (error) {
      console.error("Unexpected error adding guest:", error)
    }
  }

  const handleUpdateGuest = async (id: string, updates: Partial<Guest>) => {
    try {
      const { error } = await supabase
        .from("guests")
        .update(updates)
        .eq("id", id)

      if (error) {
        console.error("Error updating guest:", error.message)
        return
      }

      const newGuests = guests.map((guest) => 
        guest.id === id ? { ...guest, ...updates } : guest
      )
      setGuests(newGuests)
      saveState(tables, newGuests)
    } catch (error) {
      console.error("Unexpected error updating guest:", error)
    }
  }

  const handleDeleteGuest = async (id: string) => {
    const { error } = await supabase.from("guests").delete().eq("id", id)

    if (error) {
      console.error("Error deleting guest:", error)
      return
    }

    const newGuests = guests.filter((guest) => guest.id !== id)
    setGuests(newGuests)
    saveState(tables, newGuests)
  }

  const handleZoom = (delta: number) => {
    setScale((prev) => {
      const newScale = Math.max(0.5, Math.min(1.5, prev + delta))
      return newScale
    })
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      handleZoom(-e.deltaY * 0.001)
    }
  }

  const [spacePressed, setSpacePressed] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    // Enable panning with left click, middle mouse button, or when holding space
    if (e.button === 0 || e.button === 1 || (e.button === 0 && spacePressed)) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
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
      <div className="flex h-screen flex-col">
        <div className="flex h-16 items-center border-b px-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.min(prev + 0.1, 1.5))}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.5))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(0.7)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="h-6 w-px bg-border" />
            <CsvImport onImport={handleImport} />
            <ExportCSV guests={guests} tables={tables} />
          </div>
        </div>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            guests={guests}
            tables={tables}
            onAddGuest={handleAddGuest}
            onUpdateGuest={handleUpdateGuest}
            onDeleteGuest={handleDeleteGuest}
          />
          <div className="flex-1 relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-gray-800">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Table
                  </Button>
                </DialogTrigger>
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
            </div>
            <div 
              className="w-full h-full overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              style={{ cursor: isDragging ? 'grabbing' : 'default' }}
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
                    backgroundSize: "280px 220px",
                    backgroundPosition: "50px 50px",
                    width: "10000px",
                    height: "10000px",
                    left: "-5000px",
                    top: "-5000px",
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
                  />
                ))}
              </div>
            </div>
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

