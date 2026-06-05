"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Guest, RSVPStatus, Table } from "@/types/planner"

const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  contact: z.string().optional().or(z.literal("")),
  dietary_restrictions: z.string().optional().or(z.literal("")),
  rsvp_status: z.enum(["pending", "accepted", "declined"]),
  table_id: z.string().optional(),
})

type GuestFormData = z.infer<typeof guestSchema>

interface GuestFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<Guest, "id" | "created_at" | "updated_at" | "user_id">) => void
  initialData?: Guest
  tables: Table[]
}

export function GuestForm({ open, onOpenChange, onSubmit, initialData, tables }: GuestFormProps) {
  const [isClient, setIsClient] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      contact: initialData?.contact || "",
      dietary_restrictions: initialData?.dietary_restrictions || "",
      rsvp_status: initialData?.rsvp_status || "pending",
      table_id: initialData?.table_id || "unassigned",
    },
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleFormSubmit = (data: GuestFormData) => {
    const guestData = {
      ...data,
      table_id: data.table_id === "unassigned" ? undefined : data.table_id,
    }
    onSubmit(guestData)
    reset()
    onOpenChange(false)
  }

  if (!isClient) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Guest" : "Add Guest"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <Input {...register("name")} />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input {...register("email")} type="email" />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contact Number</label>
            <Input {...register("contact")} />
            {errors.contact && <p className="text-red-500 text-sm mt-1">{errors.contact.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dietary Restrictions</label>
            <Textarea {...register("dietary_restrictions")} />
            {errors.dietary_restrictions && (
              <p className="text-red-500 text-sm mt-1">{errors.dietary_restrictions.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">RSVP Status</label>
            <Select
              value={watch("rsvp_status")}
              onValueChange={(value) => setValue("rsvp_status", value as GuestFormData["rsvp_status"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
            {errors.rsvp_status && <p className="text-red-500 text-sm mt-1">{errors.rsvp_status.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assign to Table</label>
            <Select
              value={watch("table_id")}
              onValueChange={(value) => setValue("table_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">No table assigned</SelectItem>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.table_id && <p className="text-red-500 text-sm mt-1">{errors.table_id.message}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full">
              {initialData ? "Save" : "Add Guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

