"use client"

import { useDrag } from "react-dnd"
import type { Guest } from "@/types/planner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Edit2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface GuestComponentProps {
  guest: Guest
  onEdit: (guest: Guest) => void
  onDelete: (guestId: string) => void
}

export function GuestComponent({ guest, onEdit, onDelete }: GuestComponentProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "GUEST",
    item: { id: guest.id, type: "GUEST" },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }))

  const getRsvpBadge = () => {
    switch (guest.rsvp_status) {
      case "confirmed":
        return (
          <Badge variant="default" className="bg-green-500">
            Confirmed
          </Badge>
        )
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      default:
        return null
    }
  }

  return (
    <div ref={drag} className={cn("cursor-move transition-all", isDragging ? "opacity-50" : "opacity-100")}>
      <Card className="mb-2">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-medium">{guest.name}</span>
              <div className="flex items-center gap-2 mt-1">
                {guest.meal_preference && (
                  <span className="text-xs text-muted-foreground">{guest.meal_preference}</span>
                )}
                {getRsvpBadge()}
              </div>
            </div>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(guest)
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(guest.id)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

