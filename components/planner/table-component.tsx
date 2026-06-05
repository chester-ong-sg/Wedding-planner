"use client"

import { useState, useRef, useEffect } from "react"
import { useDrop } from "react-dnd"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Edit2, Users } from "lucide-react"
import { toast } from "sonner"
import type { Guest, Table } from "@/types/planner"

type EditableField = "name" | "email" | "contact" | "dietary_restrictions" | "rsvp_status"
type LocalGuest = Guest & { _dirty?: boolean }

// Stable component — must live outside TableComponent to avoid remounting on every render
function EditableCell({
  value, isEditing, onChange, onBlur, onDoubleClick,
}: {
  value: string
  isEditing: boolean
  onChange: (v: string) => void
  onBlur: () => void
  onDoubleClick: () => void
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
    <span
      className="block cursor-default select-none"
      onDoubleClick={onDoubleClick}
      title="Double-click to edit"
    >
      {value || "—"}
    </span>
  )
}

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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // Inline editing state for guest list dialog
  const [localGuests, setLocalGuests] = useState<LocalGuest[]>([])
  const [editingCell, setEditingCell] = useState<{ guestId: string; field: EditableField } | null>(null)

  // Sync local guests when dialog opens
  useEffect(() => {
    if (isViewingGuests) setLocalGuests(tableGuests.map(g => ({ ...g })))
  }, [isViewingGuests])

  const handleCellChange = (guestId: string, field: EditableField, value: string) => {
    setLocalGuests(prev => prev.map(g => g.id === guestId ? { ...g, [field]: value, _dirty: true } : g))
  }

  const handleCellBlur = () => setEditingCell(null)

  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      const dirty = localGuests.filter(g => g._dirty)
      for (const g of dirty) {
        await onUpdateGuest(g.id, {
          name: g.name,
          email: g.email,
          contact: g.contact,
          dietary_restrictions: g.dietary_restrictions,
          rsvp_status: g.rsvp_status,
        })
      }
      if (dirty.length > 0) {
        toast.success("Changes saved", { duration: 2000 })
      }
      setEditingCell(null)
    }
    setIsViewingGuests(open)
  }
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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={ref} style={getTableStyle()} onMouseDown={(e) => onDragStart(table.id, e)} onDoubleClick={() => setIsViewingGuests(true)}>
            <div className="text-center">
              <div className="font-bold">{table.name}</div>
              <div className="text-sm text-gray-500">
                {tableGuests.length} / {table.capacity} guests
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent onMouseDown={(e) => e.stopPropagation()}>
          <ContextMenuItem onSelect={() => setIsViewingGuests(true)}>
            <Users className="h-4 w-4" />
            Guest List
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
            Edit
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => setIsConfirmingDelete(true)}
            className="text-red-500 hover:bg-red-50 focus:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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

      <Dialog open={isViewingGuests} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{table.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-2">Double-click any cell to edit. Changes save when you close.</p>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[160px]" />
                <col className="w-[200px]" />
                <col className="w-[140px]" />
                <col className="w-[180px]" />
                <col className="w-[110px]" />
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
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No guests assigned to this table</td>
                  </tr>
                ) : (
                  localGuests.map((guest) => {
                    const isActive = (f: EditableField) => editingCell?.guestId === guest.id && editingCell.field === f
                    return (
                      <tr key={guest.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <EditableCell value={guest.name ?? ""} isEditing={isActive("name")} onChange={(v) => handleCellChange(guest.id, "name", v)} onBlur={handleCellBlur} onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "name" })} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <EditableCell value={guest.email ?? ""} isEditing={isActive("email")} onChange={(v) => handleCellChange(guest.id, "email", v)} onBlur={handleCellBlur} onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "email" })} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <EditableCell value={guest.contact ?? ""} isEditing={isActive("contact")} onChange={(v) => handleCellChange(guest.id, "contact", v)} onBlur={handleCellBlur} onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "contact" })} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <EditableCell value={guest.dietary_restrictions ?? ""} isEditing={isActive("dietary_restrictions")} onChange={(v) => handleCellChange(guest.id, "dietary_restrictions", v)} onBlur={handleCellBlur} onDoubleClick={() => setEditingCell({ guestId: guest.id, field: "dietary_restrictions" })} />
                        </td>
                        <td className="px-4 py-3">
                          {isActive("rsvp_status") ? (
                            <select autoFocus className="w-full bg-blue-50 border-b border-blue-400 outline-none text-sm py-0.5" value={guest.rsvp_status} onChange={(e) => handleCellChange(guest.id, "rsvp_status", e.target.value)} onBlur={handleCellBlur}>
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
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete table?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{table.name}</span> and unassign all {tableGuests.length} guest{tableGuests.length !== 1 ? "s" : ""} from it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => onDelete(table.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

