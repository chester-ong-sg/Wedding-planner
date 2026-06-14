"use client"

import { useWeddingData } from "@/contexts/wedding-data"
import { ChecklistSection } from "@/components/dashboard/checklist-section"

export default function ChecklistPage() {
  const { loading, checklist, toggleChecklist, updateChecklist } = useWeddingData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <ChecklistSection
        items={checklist}
        onToggle={toggleChecklist}
        onUpdate={updateChecklist}
      />
    </div>
  )
}
