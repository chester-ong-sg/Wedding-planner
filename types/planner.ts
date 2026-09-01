export type TableShape = "round" | "square" | "rectangular"

export type RSVPStatus = "pending" | "accepted" | "declined"

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

/**
 * A freehand pencil stroke on the canvas.
 * `points` is a flat [x1, y1, p1, x2, y2, p2, ...] triple per sample — the third
 * value is pointer pressure (0..1), used to vary stroke width.
 */
export interface Drawing {
  id: string
  points: number[]
  color: string
  width: number
  user_id: string
  created_at: string
  updated_at: string
}

export interface DraggableItemType {
  type: "TABLE" | "GUEST"
  id: string
}

