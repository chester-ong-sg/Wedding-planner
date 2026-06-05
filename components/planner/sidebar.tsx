"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GuestForm } from "@/components/planner/guest-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Search } from "lucide-react"
import type { Guest, Table } from "@/types/planner"

interface SidebarProps {
  guests: Guest[]
  tables: Table[]
  onAddGuest: (guest: Omit<Guest, "id" | "created_at" | "updated_at" | "user_id">) => void
  onUpdateGuest: (id: string, updates: Partial<Guest>) => void
  onDeleteGuest: (id: string) => void
}

export function Sidebar({ guests, tables, onAddGuest, onUpdateGuest, onDeleteGuest }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)

  const filteredGuests = guests.filter((guest) =>
    guest.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const guestsByTable = tables.reduce((acc, table) => {
    acc[table.id] = filteredGuests.filter((guest) => guest.table_id === table.id)
    return acc
  }, {} as Record<string, Guest[]>)

  const unassignedGuests = filteredGuests.filter((guest) => !guest.table_id)

  return (
    <div className="w-80 border-r h-screen flex flex-col">
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
                    <div
                      key={guest.id}
                      className="p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => onUpdateGuest(guest.id, { table_id: undefined })}
                    >
                      <div className="font-medium">{guest.name}</div>
                      <div className="text-sm text-gray-500">
                        {guest.rsvp_status === "accepted" ? "Accepted" : guest.rsvp_status === "declined" ? "Declined" : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}

          {unassignedGuests.length > 0 && (
            <AccordionItem value="unassigned">
              <AccordionTrigger className="text-sm">
                Unassigned Guests ({unassignedGuests.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {unassignedGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="font-medium">{guest.name}</div>
                      <div className="text-sm text-gray-500">
                        {guest.rsvp_status === "accepted" ? "Accepted" : guest.rsvp_status === "declined" ? "Declined" : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
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
    </div>
  )
} 