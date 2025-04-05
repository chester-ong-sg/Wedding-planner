export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      tables: {
        Row: {
          id: string
          name: string
          shape: "round" | "square" | "rectangular"
          x: number
          y: number
          capacity: number
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          shape: "round" | "square" | "rectangular"
          x: number
          y: number
          capacity: number
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          shape?: "round" | "square" | "rectangular"
          x?: number
          y?: number
          capacity?: number
          created_at?: string
          user_id?: string
        }
      }
      guests: {
        Row: {
          id: string
          name: string
          meal_preference: string | null
          rsvp_status: "confirmed" | "pending" | "declined" | null
          table_id: string | null
          seat_number: number | null
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          meal_preference?: string | null
          rsvp_status?: "confirmed" | "pending" | "declined" | null
          table_id?: string | null
          seat_number?: number | null
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          meal_preference?: string | null
          rsvp_status?: "confirmed" | "pending" | "declined" | null
          table_id?: string | null
          seat_number?: number | null
          created_at?: string
          user_id?: string
        }
      }
    }
  }
}

