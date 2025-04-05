export type TableShape = "round" | "square" | "rectangular"

export type RSVPStatus = "pending" | "attending" | "declined"

export interface Table {
  id: string
  name: string
  shape: TableShape
  capacity: number
  x: number
  y: number
  user_id: string
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  name: string
  email?: string
  contact?: string
  dietary_restrictions?: string
  rsvp_status: RSVPStatus
  table_id?: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface DraggableItemType {
  type: "TABLE" | "GUEST"
  id: string
}

