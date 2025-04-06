import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"
import { fileURLToPath } from "url"

// Get current file path in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials")
  process.exit(1)
}

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteAllGuests() {
  try {
    console.log("Starting deletion process...")

    // Delete all guests first
    const { error: guestsError } = await supabase
      .from("guests")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (guestsError) {
      console.error("Error deleting guests:", guestsError)
      return
    }
    console.log("Successfully deleted all guests!")

    // Then delete all tables
    const { error: tablesError } = await supabase
      .from("tables")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (tablesError) {
      console.error("Error deleting tables:", tablesError)
      return
    }
    console.log("Successfully deleted all tables!")

    console.log("Database cleared successfully!")

  } catch (error) {
    console.error("Error:", error)
  }
}

deleteAllGuests() 