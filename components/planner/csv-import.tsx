"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Upload } from "lucide-react"

interface CsvImportProps {
  onImport: (guests: {
    name: string
    email?: string
    contact?: string
    dietary_restrictions?: string
    rsvp_status?: string
    table?: string
  }[]) => void
}

export function CsvImport({ onImport }: CsvImportProps) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const csvData = event.target?.result as string
        const guests = parseCsv(csvData)
        onImport(guests)
        toast({
          title: "Success",
          description: `Successfully imported ${guests.length} guests`,
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Import Error",
          description: "Failed to parse CSV file. Please check the format.",
        })
      } finally {
        setIsUploading(false)
        // Reset the input
        e.target.value = ""
      }
    }

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Import Error",
        description: "Error reading file",
      })
      setIsUploading(false)
    }

    reader.readAsText(file)
  }

  const stripQuotes = (value: string) => value.trim().replace(/^"|"$/g, "")
  // Normalise header: lowercase + spaces→underscores so "RSVP Status" → "rsvp_status"
  const normaliseHeader = (h: string) => stripQuotes(h).toLowerCase().replace(/\s+/g, "_")

  const parseCsv = (csvData: string) => {
    const lines = csvData.split(/\r?\n/)
    const headers = lines[0].split(",").map(normaliseHeader)

    const nameIndex    = headers.indexOf("name")
    const emailIndex   = headers.indexOf("email")
    const contactIndex = headers.indexOf("contact")
    const dietaryIndex = headers.indexOf("dietary_restrictions")
    const mealIndex    = headers.indexOf("meal_preference")
    const rsvpIndex    = headers.indexOf("rsvp_status")
    const tableIndex   = headers.indexOf("table")

    if (nameIndex === -1) {
      throw new Error("CSV must contain a 'name' column")
    }

    const guests = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].split(",").map(stripQuotes)
      const guest: {
        name: string; email?: string; contact?: string;
        dietary_restrictions?: string; rsvp_status?: string; table?: string
      } = { name: values[nameIndex] }

      if (emailIndex   !== -1 && values[emailIndex])   guest.email   = values[emailIndex]
      if (contactIndex !== -1 && values[contactIndex]) guest.contact = values[contactIndex]
      if (dietaryIndex !== -1 && values[dietaryIndex]) guest.dietary_restrictions = values[dietaryIndex]
      if (mealIndex    !== -1 && values[mealIndex])    guest.dietary_restrictions = values[mealIndex]
      if (rsvpIndex    !== -1 && values[rsvpIndex])    guest.rsvp_status = values[rsvpIndex]
      if (tableIndex   !== -1 && values[tableIndex])   guest.table   = values[tableIndex]

      guests.push(guest)
    }

    return guests
  }

  return (
    <>
      <input
        id="csv-file-input"
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        disabled={isUploading}
        className="hidden"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg"
        disabled={isUploading}
        title="Import CSV"
        onClick={() => document.getElementById('csv-file-input')?.click()}
      >
        <Upload className="h-4 w-4" />
      </Button>
    </>
  )
}

