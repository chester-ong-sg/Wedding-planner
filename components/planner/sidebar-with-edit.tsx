"use client"

import { useState } from "react"
import { useDrag, useDrop } from "react-dnd"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { GuestForm } from "@/components/planner/guest-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Search, Pencil, Trash } from "lucide-react"
import type { Guest, Table } from "@/types/planner"

interface SidebarProps {
  guests: Guest[]
  tables: Table[]
  onAddGuest: (data: Partial<Guest>) => Promise<void>
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
  onDeleteGuest: (id: string) => Promise<void>
  onDeleteManyGuests: (ids: string[]) => Promise<void>
  onDeleteManyTables: (ids: string[]) => Promise<void>
  onAddTable: () => void
}

interface DragItem {
  type: "guest"
  id: string
  tableId: string | null
}

export function Sidebar({ guests, tables, onAddGuest, onUpdateGuest, onDeleteGuest, onDeleteManyGuests, onDeleteManyTables, onAddTable }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null)

  // Bulk selection state
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set())
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set())
  const [confirmBulkDeleteGuests, setConfirmBulkDeleteGuests] = useState(false)
  const [confirmBulkDeleteTables, setConfirmBulkDeleteTables] = useState(false)

  const guestsByTable = guests.reduce((acc, guest) => {
    const tableId = guest.table_id || "unassigned"
    if (!acc[tableId]) acc[tableId] = []
    acc[tableId].push(guest)
    return acc
  }, {} as Record<string, Guest[]>)

  const filteredGuests = (tableId: string) => {
    const list = guestsByTable[tableId] ?? []
    if (!searchQuery) return list
    return list.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>(() => ({
    accept: "guest",
    drop: (item) => {
      if (item.type === "guest") {
        onUpdateGuest(item.id, { table_id: item.tableId === "unassigned" ? undefined : item.tableId ?? undefined })
      }
    },
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
  }))

  const toggleGuest = (id: string) => {
    setSelectedGuestIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTable = (id: string) => {
    setSelectedTableIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const GuestItem = ({ guest, tableId }: { guest: Guest; tableId: string }) => {
    const [{ isDragging }, drag] = useDrag<DragItem, void, { isDragging: boolean }>(() => ({
      type: "guest",
      item: { type: "guest", id: guest.id, tableId },
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    }))

    return (
      <div
        ref={drag}
        className={`p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 ${isDragging ? "opacity-50" : ""}`}
      >
        <Checkbox
          checked={selectedGuestIds.has(guest.id)}
          onCheckedChange={() => toggleGuest(guest.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{guest.name}</div>
          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            guest.rsvp_status === "accepted" ? "bg-green-100 text-green-700"
            : guest.rsvp_status === "declined" ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-500"
          }`}>
            {guest.rsvp_status === "accepted" ? "Accepted" : guest.rsvp_status === "declined" ? "Declined" : "Pending"}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setEditingGuest(guest)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeletingGuest(guest)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  const handleEditSubmit = async (updates: Omit<Guest, "id" | "created_at" | "updated_at" | "user_id">) => {
    if (editingGuest) {
      await onUpdateGuest(editingGuest.id, updates)
      setEditingGuest(null)
    }
  }

  return (
    <div className="w-80 border-r h-screen flex flex-col" ref={drop}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Search guests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setIsAddGuestOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Guest
          </Button>
          <Button className="flex-1" variant="outline" onClick={onAddTable}>
            <Plus className="h-4 w-4 mr-2" />
            Add Table
          </Button>
        </div>
      </div>

      {/* Bulk action bars */}
      {selectedGuestIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b text-sm">
          <span className="text-red-700 font-medium">{selectedGuestIds.size} guest{selectedGuestIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedGuestIds(new Set())}>Clear</Button>
            <Button size="sm" className="h-7 text-xs bg-red-500 hover:bg-red-600" onClick={() => setConfirmBulkDeleteGuests(true)}>
              Delete
            </Button>
          </div>
        </div>
      )}
      {selectedTableIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-orange-50 border-b text-sm">
          <span className="text-orange-700 font-medium">{selectedTableIds.size} table{selectedTableIds.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedTableIds(new Set())}>Clear</Button>
            <Button size="sm" className="h-7 text-xs bg-red-500 hover:bg-red-600" onClick={() => setConfirmBulkDeleteTables(true)}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Guest list */}
      <div className="flex-1 overflow-auto p-4">
        <Accordion type="multiple" className="w-full">
          {tables.map((table) => (
            <AccordionItem key={table.id} value={table.id}>
              <div className="relative flex items-center">
                <Checkbox
                  checked={selectedTableIds.has(table.id)}
                  onCheckedChange={() => toggleTable(table.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 z-10"
                />
                <AccordionTrigger className="text-sm w-full pl-6">
                  {table.name} ({guestsByTable[table.id]?.length || 0} guests)
                </AccordionTrigger>
              </div>
              <AccordionContent>
                <div className="space-y-2 pl-6">
                  {filteredGuests(table.id).map((guest) => (
                    <GuestItem key={guest.id} guest={guest} tableId={table.id} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="unassigned">
            <AccordionTrigger className="text-sm">
              Unassigned ({guestsByTable["unassigned"]?.length || 0} guests)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {filteredGuests("unassigned").map((guest) => (
                  <GuestItem key={guest.id} guest={guest} tableId="unassigned" />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Dialogs */}
      <Dialog open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Guest</DialogTitle></DialogHeader>
          <GuestForm open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen} onSubmit={onAddGuest} tables={tables} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Guest</DialogTitle></DialogHeader>
          {editingGuest && (
            <GuestForm
              open={!!editingGuest}
              onOpenChange={(open) => !open && setEditingGuest(null)}
              onSubmit={handleEditSubmit}
              tables={tables}
              initialData={editingGuest}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Single guest delete */}
      <AlertDialog open={!!deletingGuest} onOpenChange={(open) => !open && setDeletingGuest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{deletingGuest?.name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => { if (deletingGuest) onDeleteGuest(deletingGuest.id); setDeletingGuest(null) }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk guest delete */}
      <AlertDialog open={confirmBulkDeleteGuests} onOpenChange={setConfirmBulkDeleteGuests}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedGuestIds.size} guest{selectedGuestIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the selected guests. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => { onDeleteManyGuests([...selectedGuestIds]); setSelectedGuestIds(new Set()); setConfirmBulkDeleteGuests(false) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk table delete */}
      <AlertDialog open={confirmBulkDeleteTables} onOpenChange={setConfirmBulkDeleteTables}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTableIds.size} table{selectedTableIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the selected tables and unassign all guests from them. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => { onDeleteManyTables([...selectedTableIds]); setSelectedTableIds(new Set()); setConfirmBulkDeleteTables(false) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
