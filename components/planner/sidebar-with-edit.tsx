"use client"

import { useState } from "react"
import { useDrag, useDrop } from "react-dnd"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GuestForm } from "@/components/planner/guest-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Search, Pencil, Trash } from "lucide-react"
import type { Guest, Table } from "@/types/planner"

interface SidebarProps {
  guests: Guest[]
  tables: Table[]
  onAddGuest: (data: Partial<Guest>) => Promise<void>
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
  onDeleteGuest: (id: string) => Promise<void>
}

interface DragItem {
  type: "guest"
  id: string
  tableId: string | null
}

export function Sidebar({ guests, tables, onAddGuest, onUpdateGuest, onDeleteGuest }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)

  const guestsByTable = guests.reduce((acc, guest) => {
    const tableId = guest.table_id || "unassigned"
    if (!acc[tableId]) {
      acc[tableId] = []
    }
    acc[tableId].push(guest)
    return acc
  }, {} as Record<string, Guest[]>)

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>(() => ({
    accept: "guest",
    drop: (item) => {
      if (item.type === "guest") {
        const tableId = item.tableId === "unassigned" ? null : item.tableId
        onUpdateGuest(item.id, { table_id: tableId })
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }))

  const GuestItem = ({ guest, tableId }: { guest: Guest; tableId: string }) => {
    const [{ isDragging }, drag] = useDrag<DragItem, void, { isDragging: boolean }>(() => ({
      type: "guest",
      item: { type: "guest", id: guest.id, tableId },
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }))

    return (
      <div
        ref={drag}
        className={`p-2 border rounded-lg hover:bg-gray-50 flex items-center justify-between ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <div className="flex-1">
          <div className="font-medium">{guest.name}</div>
          <div className="text-sm text-gray-500">
            {guest.rsvp_status === "attending" ? "Attending" : "Not attending"}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditGuest(guest)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDeleteGuest(guest.id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  const handleEditGuest = (guest: Guest) => {
    setEditingGuest(guest)
  }

  const handleEditSubmit = async (updates: Omit<Guest, "id" | "created_at" | "updated_at" | "user_id">) => {
    if (editingGuest) {
      await onUpdateGuest(editingGuest.id, updates)
      setEditingGuest(null)
    }
  }

  return (
    <div className="w-80 border-r h-screen flex flex-col" ref={drop}>
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
        <Button className="w-full" onClick={() => setIsAddGuestOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Guest
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Accordion type="single" collapsible className="w-full">
          {tables.map((table) => (
            <AccordionItem key={table.id} value={table.id}>
              <AccordionTrigger className="text-sm">
                {table.name} ({guestsByTable[table.id]?.length || 0} guests)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {guestsByTable[table.id]?.map((guest) => (
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
                {guestsByTable["unassigned"]?.map((guest) => (
                  <GuestItem key={guest.id} guest={guest} tableId="unassigned" />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Dialog open={isAddGuestOpen} onOpenChange={setIsAddGuestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
          </DialogHeader>
          <GuestForm
            open={isAddGuestOpen}
            onOpenChange={setIsAddGuestOpen}
            onSubmit={onAddGuest}
            tables={tables}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGuest} onOpenChange={(open) => !open && setEditingGuest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Guest</DialogTitle>
          </DialogHeader>
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
    </div>
  )
}