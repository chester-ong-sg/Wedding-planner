export type WeddingType = 'rom_only' | 'banquet_only' | 'rom_and_banquet'

export interface UserProfile {
  id: string
  wedding_date: string | null
  guest_count: number | null
  wedding_type: WeddingType | null
  onboarding_completed: boolean
}

export interface ChecklistItem {
  id: string
  user_id: string
  month_label: string
  task: string
  category: string | null
  is_completed: boolean
  due_date: string | null
  notes: string | null
  sort_order: number
}

export interface BudgetItem {
  id: string
  user_id: string
  category: string
  item_name: string
  estimated_amount: number
  actual_amount: number | null
  notes: string | null
  sort_order: number
}

export interface Milestone {
  id: string
  user_id: string
  title: string
  due_date: string | null
  description: string | null
  is_completed: boolean
  sort_order: number
}

export interface GeneratedPlan {
  checklist: {
    month_label: string
    tasks: { task: string; category: string; notes?: string }[]
  }[]
  budget: {
    category: string
    items: { item_name: string; estimated_amount: number; notes?: string }[]
  }[]
  milestones: { title: string; due_date: string; description: string }[]
}
