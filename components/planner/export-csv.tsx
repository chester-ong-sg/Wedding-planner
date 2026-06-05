import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { Guest, Table } from "@/types/planner"

interface ExportCSVProps {
  guests: Guest[]
  tables: Table[]
}

export function ExportCSV({ guests, tables }: ExportCSVProps) {
  const handleExport = () => {
    // Group guests by table
    const guestsByTable = tables.reduce((acc, table) => {
      acc[table.id] = guests.filter(guest => guest.table_id === table.id)
      return acc
    }, {} as Record<string, Guest[]>)

    // Add unassigned guests
    guestsByTable["unassigned"] = guests.filter(guest => !guest.table_id)

    // Find the maximum number of guests at any table
    const maxGuests = Math.max(
      ...Object.values(guestsByTable).map(guests => guests.length)
    )

    // Create headers for each table
    const tableHeaders = tables.map(table => table.name)
    tableHeaders.push("Unassigned")
    const headers = ["Seat", ...tableHeaders].join(",")

    // Create rows for each seat position
    const rows = []
    for (let i = 0; i < maxGuests; i++) {
      const row = [i + 1] // Seat number
      tables.forEach(table => {
        const tableGuests = guestsByTable[table.id] || []
        const guest = tableGuests[i]
        if (guest) {
          row.push(`${guest.name}${guest.dietary_restrictions ? ` (${guest.dietary_restrictions})` : ""}`)
        } else {
          row.push("") // Empty seat
        }
      })
      // Add unassigned guests
      const unassignedGuests = guestsByTable["unassigned"] || []
      const unassignedGuest = unassignedGuests[i]
      row.push(unassignedGuest ? unassignedGuest.name : "")
      rows.push(row.join(","))
    }

    // Add table summary
    const summaryRows = [
      "\nTable Summary",
      ["Table Name", "Capacity", "Current Guests", "Available Seats"].join(","),
      ...tables.map(table => {
        const tableGuests = guestsByTable[table.id] || []
        return [
          table.name,
          table.capacity,
          tableGuests.length,
          table.capacity - tableGuests.length,
        ].join(",")
      }),
      ["Unassigned", "-", guestsByTable["unassigned"]?.length || 0, "-"].join(",")
    ]

    // Combine all content
    const csvContent = [
      headers,
      ...rows,
      ...summaryRows
    ].join("\n")

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "wedding_planner_export.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-lg"
      onClick={handleExport}
      title="Export CSV"
    >
      <Download className="h-4 w-4" />
    </Button>
  )
} 