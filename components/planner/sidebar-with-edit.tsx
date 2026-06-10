"use client"

import { useState, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Search, Pencil, Trash, LayoutGrid, Table as TableIcon, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { CsvImport } from "@/components/planner/csv-import"
import { ExportCSV } from "@/components/planner/export-csv"
import type { Guest, Table, RSVPStatus } from "@/types/planner"

export type ViewMode = "grid" | "table"

type SortCol = "name" | "table" | "rsvp" | "dietary" | "email" | "contact"
type SortDir = "asc" | "desc"

interface SidebarProps {
  guests: Guest[]
  tables: Table[]
  onAddGuest: (data: Partial<Guest>) => Promise<void>
  onUpdateGuest: (id: string, updates: Partial<Guest>) => Promise<void>
  onDeleteGuest: (id: string) => Promise<void>
  onDeleteManyGuests: (ids: string[]) => Promise<void>
  onDeleteManyTables: (ids: string[]) => Promise<void>
  onAddTable: () => void
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
  onImport: (guests: { name: string; email?: string; contact?: string; dietary_restrictions?: string; rsvp_status?: string; table?: string }[]) => void
}

interface DragItem {
  type: "guest"
  id: string
  tableId: string | null
}

export function Sidebar({ guests, tables, onAddGuest, onUpdateGuest, onDeleteGuest, onDeleteManyGuests, onDeleteManyTables, onAddTable, viewMode, onViewChange, onImport }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null)

  // Bulk selection state
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set())
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set())
  const [confirmBulkDeleteGuests, setConfirmBulkDeleteGuests] = useState(false)
  const [confirmBulkDeleteTables, setConfirmBulkDeleteTables] = useState(false)

  // Table-view sort & filter state
  const [sortCol, setSortCol] = useState<SortCol>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [rsvpFilter, setRsvpFilter] = useState<string>("all")

  // Inline cell editing state
  const [editingCell, setEditingCell] = useState<{
    guestId: string
    field: "name" | "dietary" | "table" | "rsvp" | "email" | "contact"
    value: string
  } | null>(null)

  const startEdit = (guest: Guest, field: "name" | "dietary" | "table" | "rsvp" | "email" | "contact") => {
    let value = ""
    if (field === "name") value = guest.name
    else if (field === "dietary") value = guest.dietary_restrictions ?? ""
    else if (field === "table") value = guest.table_id ?? ""
    else if (field === "rsvp") value = guest.rsvp_status
    else if (field === "email") value = guest.email ?? ""
    else if (field === "contact") value = guest.contact ?? ""
    setEditingCell({ guestId: guest.id, field, value })
  }

  const commitEdit = async () => {
    if (!editingCell) return
    const { guestId, field, value } = editingCell
    const updates: Partial<Guest> = {}
    if (field === "name" && value.trim()) updates.name = value.trim()
    else if (field === "dietary") updates.dietary_restrictions = value.trim() || undefined
    else if (field === "rsvp") updates.rsvp_status = value as RSVPStatus
    else if (field === "table") updates.table_id = value || undefined
    else if (field === "email") updates.email = value.trim() || undefined
    else if (field === "contact") updates.contact = value.trim() || undefined
    setEditingCell(null)
    if (Object.keys(updates).length) await onUpdateGuest(guestId, updates)
  }

  const cancelEdit = () => setEditingCell(null)

  const isEditing = (guestId: string, field: string) =>
    editingCell?.guestId === guestId && editingCell?.field === field

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

  const tableNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    tables.forEach(t => { m[t.id] = t.name })
    return m
  }, [tables])

  const handleSortClick = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  const sortedFilteredGuests = useMemo(() => {
    let list = [...guests]
    if (searchQuery) list = list.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (rsvpFilter !== "all") list = list.filter(g => g.rsvp_status === rsvpFilter)
    list.sort((a, b) => {
      let av = "", bv = ""
      if (sortCol === "name") { av = a.name; bv = b.name }
      else if (sortCol === "table") { av = tableNameMap[a.table_id ?? ""] ?? ""; bv = tableNameMap[b.table_id ?? ""] ?? "" }
      else if (sortCol === "rsvp") { av = a.rsvp_status; bv = b.rsvp_status }
      else if (sortCol === "dietary") { av = a.dietary_restrictions ?? ""; bv = b.dietary_restrictions ?? "" }
      else if (sortCol === "email") { av = a.email ?? ""; bv = b.email ?? "" }
      else if (sortCol === "contact") { av = a.contact ?? ""; bv = b.contact ?? "" }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return list
  }, [guests, searchQuery, rsvpFilter, sortCol, sortDir, tableNameMap])

  const allSelected = sortedFilteredGuests.length > 0 && sortedFilteredGuests.every(g => selectedGuestIds.has(g.id))
  const toggleSelectAll = () => {
    if (allSelected) setSelectedGuestIds(new Set())
    else setSelectedGuestIds(new Set(sortedFilteredGuests.map(g => g.id)))
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 inline ml-1 opacity-40" />
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />
  }

  const rsvpChip = (status: string) => {
    if (status === "accepted") return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Accepted</span>
    if (status === "declined") return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Declined</span>
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">Pending</span>
  }

  return (
    <div className={`${viewMode === "table" ? "flex-1" : "w-80"} border-r h-screen flex flex-col`} ref={drop}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Search guests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden shrink-0">
            <button
              onClick={() => onViewChange("grid")}
              className={`px-2.5 py-2 transition-colors ${viewMode === "grid" ? "bg-black text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewChange("table")}
              className={`px-2.5 py-2 transition-colors border-l ${viewMode === "table" ? "bg-black text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
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
          {viewMode === "table" && (
            <>
              <CsvImport onImport={onImport} />
              <ExportCSV guests={guests} tables={tables} />
            </>
          )}
        </div>
        {viewMode === "table" && (
          <div className="mt-2">
            <Select value={rsvpFilter} onValueChange={setRsvpFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Filter RSVP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All RSVP statuses</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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
      {viewMode === "grid" ? (
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
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white border-b z-10">
              <tr>
                <th className="p-3 text-left w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("name")}
                >
                  Name <SortIcon col="name" />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("table")}
                >
                  Table <SortIcon col="table" />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("rsvp")}
                >
                  RSVP <SortIcon col="rsvp" />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("email")}
                >
                  Email <SortIcon col="email" />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("contact")}
                >
                  Contact <SortIcon col="contact" />
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                  onClick={() => handleSortClick("dietary")}
                >
                  Dietary <SortIcon col="dietary" />
                </th>
                <th className="p-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {sortedFilteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400 text-sm">
                    No guests found
                  </td>
                </tr>
              ) : (
                sortedFilteredGuests.map((guest) => (
                  <tr key={guest.id} className="border-b hover:bg-gray-50 transition-colors group">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedGuestIds.has(guest.id)}
                        onCheckedChange={() => toggleGuest(guest.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    {/* Name — inline text edit */}
                    <td
                      className="p-0 font-medium cursor-text"
                      onClick={() => !isEditing(guest.id, "name") && startEdit(guest, "name")}
                    >
                      {isEditing(guest.id, "name") ? (
                        <input
                          autoFocus
                          className="w-full px-3 py-3 text-sm font-medium bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                        />
                      ) : (
                        <span className="block px-3 py-3 hover:bg-blue-50 rounded transition-colors">{guest.name}</span>
                      )}
                    </td>

                    {/* Table — inline select */}
                    <td
                      className="p-0 cursor-pointer"
                      onClick={() => !isEditing(guest.id, "table") && startEdit(guest, "table")}
                    >
                      {isEditing(guest.id, "table") ? (
                        <select
                          autoFocus
                          className="w-full px-3 py-3 text-sm bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          onChange={async e => {
                            const val = e.target.value
                            setEditingCell(null)
                            await onUpdateGuest(guest.id, { table_id: val || undefined })
                          }}
                          onBlur={cancelEdit}
                          onKeyDown={e => { if (e.key === "Escape") cancelEdit() }}
                        >
                          <option value="">Unassigned</option>
                          {tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="block px-3 py-3 text-gray-500 hover:bg-blue-50 rounded transition-colors">
                          {guest.table_id ? (tableNameMap[guest.table_id] ?? "—") : <span className="italic text-gray-400">Unassigned</span>}
                        </span>
                      )}
                    </td>

                    {/* RSVP — inline select */}
                    <td
                      className="p-0 cursor-pointer"
                      onClick={() => !isEditing(guest.id, "rsvp") && startEdit(guest, "rsvp")}
                    >
                      {isEditing(guest.id, "rsvp") ? (
                        <select
                          autoFocus
                          className="w-full px-3 py-3 text-xs bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          onChange={async e => {
                            const val = e.target.value as RSVPStatus
                            setEditingCell(null)
                            await onUpdateGuest(guest.id, { rsvp_status: val })
                          }}
                          onBlur={cancelEdit}
                          onKeyDown={e => { if (e.key === "Escape") cancelEdit() }}
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                        </select>
                      ) : (
                        <span className="block px-3 py-3 hover:bg-blue-50 rounded transition-colors">
                          {rsvpChip(guest.rsvp_status)}
                        </span>
                      )}
                    </td>

                    {/* Email — inline text edit */}
                    <td
                      className="p-0 cursor-text"
                      onClick={() => !isEditing(guest.id, "email") && startEdit(guest, "email")}
                    >
                      {isEditing(guest.id, "email") ? (
                        <input
                          autoFocus
                          type="email"
                          className="w-full px-3 py-3 text-sm bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          placeholder="email@example.com"
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                        />
                      ) : (
                        <span className="block px-3 py-3 text-gray-500 hover:bg-blue-50 rounded transition-colors truncate max-w-[160px]">
                          {guest.email || <span className="text-gray-300">—</span>}
                        </span>
                      )}
                    </td>

                    {/* Contact — inline text edit */}
                    <td
                      className="p-0 cursor-text"
                      onClick={() => !isEditing(guest.id, "contact") && startEdit(guest, "contact")}
                    >
                      {isEditing(guest.id, "contact") ? (
                        <input
                          autoFocus
                          type="tel"
                          className="w-full px-3 py-3 text-sm bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          placeholder="+65 9123 4567"
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                        />
                      ) : (
                        <span className="block px-3 py-3 text-gray-500 hover:bg-blue-50 rounded transition-colors">
                          {guest.contact || <span className="text-gray-300">—</span>}
                        </span>
                      )}
                    </td>

                    {/* Dietary — inline text edit */}
                    <td
                      className="p-0 cursor-text"
                      onClick={() => !isEditing(guest.id, "dietary") && startEdit(guest, "dietary")}
                    >
                      {isEditing(guest.id, "dietary") ? (
                        <input
                          autoFocus
                          className="w-full px-3 py-3 text-sm bg-blue-50 outline-none border-x border-blue-300 focus:border-blue-500"
                          value={editingCell!.value}
                          placeholder="e.g. Vegetarian"
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit() }}
                        />
                      ) : (
                        <span className="block px-3 py-3 text-gray-500 hover:bg-blue-50 rounded transition-colors">
                          {guest.dietary_restrictions || <span className="text-gray-300">—</span>}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingGuest(guest)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingGuest(guest)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {sortedFilteredGuests.length > 0 && (
            <p className="text-xs text-gray-400 text-center py-3">
              {sortedFilteredGuests.length} of {guests.length} guests
            </p>
          )}
        </div>
      )}

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
