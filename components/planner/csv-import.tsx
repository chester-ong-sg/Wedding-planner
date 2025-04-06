"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Upload } from "lucide-react"

interface CsvImportProps {
  onImport: (guests: { name: string; meal_preference?: string; rsvp_status?: string }[]) => void
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

  const parseCsv = (csvData: string) => {
    const lines = csvData.split("\n")
    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase())

    const nameIndex = headers.indexOf("name")
    const mealIndex = headers.indexOf("meal_preference")
    const rsvpIndex = headers.indexOf("rsvp_status")
    const tableIndex = headers.indexOf("table")

    if (nameIndex === -1) {
      throw new Error("CSV must contain a 'name' column")
    }

    const guests = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].split(",").map((value) => value.trim())
      const guest: { name: string; meal_preference?: string; rsvp_status?: string; table?: string } = {
        name: values[nameIndex],
      }

      if (mealIndex !== -1 && values[mealIndex]) {
        guest.meal_preference = values[mealIndex]
      }

      if (rsvpIndex !== -1 && values[rsvpIndex]) {
        guest.rsvp_status = values[rsvpIndex]
      }

      if (tableIndex !== -1 && values[tableIndex]) {
        guest.table = values[tableIndex]
      }

      guests.push(guest)
    }

    return guests
  }

  return (
    <div className="flex items-center space-x-2">
      <Input type="file" accept=".csv" onChange={handleFileChange} disabled={isUploading} className="max-w-xs" />
      <Button variant="outline" disabled={isUploading} asChild>
        <label htmlFor="file" className="cursor-pointer">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </label>
      </Button>
    </div>
  )
}

