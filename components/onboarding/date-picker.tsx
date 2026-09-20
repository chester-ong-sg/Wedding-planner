"use client"

import { useState } from "react"
import { addMonths, format, parseISO } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Props {
  value: string // yyyy-MM-dd, or "" when unset
  onChange: (value: string) => void
}

/** Large, friendly date field. Opens a two-month calendar with month/year dropdowns. */
export function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisYear = today.getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-[320px] items-center justify-between gap-3 rounded-2xl border-2 px-5 py-4 text-lg font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            selected
              ? "border-brand-rose bg-brand-rose-muted text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50",
          )}
        >
          <CalendarIcon className="h-5 w-5 shrink-0 text-brand-rose" />
          <span className="flex-1 text-left">
            {selected ? format(selected, "EEEE, d MMMM yyyy") : "Pick your wedding date"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-3xl border border-border p-0 shadow-2xl"
        align="center"
        side="bottom"
        sideOffset={12}
        avoidCollisions={false}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={date => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"))
              setOpen(false)
            }
          }}
          captionLayout="dropdown-buttons"
          fromYear={thisYear}
          toYear={thisYear + 6}
          numberOfMonths={2}
          defaultMonth={selected ?? addMonths(today, 6)}
          disabled={date => date < today}
          initialFocus
          classNames={{
            months: "flex flex-col sm:flex-row gap-6 p-6",
            month: "space-y-4",
            caption: "relative flex items-center justify-center h-9",
            caption_dropdowns: "flex items-center gap-2",
            caption_label: "hidden",
            vhidden: "hidden",
            dropdown:
              "appearance-none bg-secondary hover:bg-accent rounded-xl px-3 py-1.5 text-sm font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
            dropdown_month: "relative",
            dropdown_year: "relative",
            nav: "flex items-center",
            nav_button:
              "h-8 w-8 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full flex items-center justify-center transition-colors",
            nav_button_previous: "absolute left-0 top-0",
            nav_button_next: "absolute right-0 top-0",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-muted-foreground w-10 font-medium text-xs flex-1 text-center pb-2",
            row: "flex w-full mt-1.5",
            cell: "flex-1 text-center text-sm relative p-0",
            day: "h-10 w-10 p-0 font-normal text-foreground rounded-full hover:bg-brand-rose-muted mx-auto flex items-center justify-center transition-colors",
            day_selected: "!bg-brand-rose !text-white hover:!bg-brand-rose rounded-full font-semibold",
            day_today: "border border-primary text-foreground font-semibold",
            day_outside: "text-muted-foreground/40",
            day_disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
