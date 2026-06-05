"use client"

import { useState, useRef } from "react"
import { useDrop } from "react-dnd"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Edit2, Users } from "lucide-react"
import type { Guest, Table } from "@/types/planner"

interface TableComponentProps {
  table: Table
  guests: Guest[]
  onUpdate: (id: string, updates: Partial<Table>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
  onDragStart: (id: string, e: React.MouseEvent) => void
}

type TableShape = "round" | "square" | "rectangular"

interface DragItem {
  type: "table" | "guest"
  id: string
}

export function TableComponent({ table, guests, onUpdate, onDelete, onUpdateGuest, onDragStart }: TableComponentProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isViewingGuests, setIsViewingGuests] = useState(false)
  const [name, setName] = useState(table.name)
  const [shape, setShape] = useState<TableShape>(table.shape)
  const [capacity, setCapacity] = useState(table.capacity)

  // Filter guests to only show those assigned to this table
  const tableGuests = guests.filter(guest => guest.table_id === table.id)

  const [{ isOver }, drop] = useDrop({
    accept: "guest",
    drop: (item: DragItem) => {
      if (item.type === "guest") {
        onUpdateGuest(item.id, { table_id: table.id })
      }
    },
    canDrop: (item: DragItem) => {
      if (item.type !== "guest") return false
      const isAlreadyAtTable = tableGuests.some(g => g.id === item.id)
      return !isAlreadyAtTable && tableGuests.length < table.capacity
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver() && monitor.canDrop(),
    }),
  })

  const handleSave = async () => {
    await onUpdate(table.id, {
      name,
      shape,
      capacity,
    })
    setIsEditing(false)
  }

  const getTableStyle = () => ({
    position: "absolute" as const,
    left: `${table.x}px`,
    top: `${table.y}px`,
    width: shape === "rectangular" ? "200px" : "150px",
    height: shape === "rectangular" ? "100px" : "150px",
    backgroundColor: isOver ? "#e5e7eb" : "#ffffff",
    border: isOver ? "2px dashed #000" : "2px solid #000",
    borderRadius: shape === "round" ? "50%" : "8px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    cursor: "move",
    transition: "border 0.1s ease-out",
    padding: "1rem",
    zIndex: isOver ? 1000 : 1,
    userSelect: "none" as const,
  })

  const ref = useRef<HTMLDivElement>(null)
  drop(ref)

  return (
    <>
      <div ref={ref} style={getTableStyle()} onMouseDown={(e) => onDragStart(table.id, e)} className="group">
        <div className="text-center">
          <div className="font-bold">{table.name}</div>
          <div className="text-sm text-gray-500">
            {tableGuests.length} / {table.capacity} guests
          </div>
        </div>
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsViewingGuests(true)}
            className="h-6 w-6"
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(table.id)}
            className="h-6 w-6"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Shape</label>
              <Select value={shape} onValueChange={(value) => setShape(value as TableShape)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round">Round</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="rectangular">Rectangular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Capacity</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={capacity}
                onChange={(e) => {
                  const value = e.target.value === "" ? 1 : parseInt(e.target.value)
                  setCapacity(isNaN(value) ? 1 : Math.max(1, Math.min(20, value)))
                }}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewingGuests} onOpenChange={setIsViewingGuests}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guests at {table.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {tableGuests.map((guest) => (
              <div
                key={guest.id}
                className="p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => onUpdateGuest(guest.id, { table_id: undefined })}
              >
                <div className="font-medium">{guest.name}</div>
                <div className="text-sm text-gray-500">
                  {guest.rsvp_status === "attending" ? "Attending" : "Not attending"}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

