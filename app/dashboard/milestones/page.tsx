"use client"

import { useWeddingData } from "@/contexts/wedding-data"
import { MilestonesSection } from "@/components/dashboard/milestones-section"

export default function MilestonesPage() {
  const { loading, milestones, toggleMilestone, updateMilestone } = useWeddingData()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <MilestonesSection
        milestones={milestones}
        onToggle={toggleMilestone}
        onUpdate={updateMilestone}
      />
    </div>
  )
}
