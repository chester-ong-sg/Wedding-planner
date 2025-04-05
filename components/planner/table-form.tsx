"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import type { Table } from "@/types/planner"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const formSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  shape: z.enum(["round", "square", "rectangular"]),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
})

type FormValues = z.infer<typeof formSchema>

interface TableFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: FormValues) => void
  initialData?: Table
}

export function TableForm({ open, onOpenChange, onSubmit, initialData }: TableFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          shape: initialData.shape,
          capacity: initialData.capacity,
        }
      : {
          name: "",
          shape: "round",
          capacity: 8,
        },
  })

  const handleSubmit = (data: FormValues) => {
    onSubmit(data)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Table" : "Add New Table"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Family Table" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Shape</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a table shape" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="round">Round</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="rectangular">Rectangular</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

