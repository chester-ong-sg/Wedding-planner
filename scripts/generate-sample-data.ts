import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"
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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Chinese names (first names and last names)
const firstNames = [
  "Wei", "Ming", "Hui", "Yan", "Jing", "Li", "Xiu", "Mei", "Ying", "Xia",
  "Jun", "Feng", "Yi", "Yang", "Hong", "Yu", "Xue", "Lin", "Zhen", "Juan"
]

const lastNames = [
  "Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Huang", "Zhao", "Wu", "Zhou",
  "Sun", "Ma", "Zhu", "Hu", "Guo", "Lin", "He", "Gao", "Luo", "Zheng"
]

// Table categories with their guest counts
const tableCategories = [
  { name: "VIP Table", count: 10 },
  { name: "Family Table 1", count: 10 },
  { name: "Family Table 2", count: 10 },
  { name: "University Friends", count: 10 },
  { name: "Secondary School Friends", count: 10 },
  { name: "Work Colleagues", count: 10 },
  { name: "Church Friends", count: 10 },
  { name: "Sports Club", count: 10 },
  { name: "Relatives", count: 10 },
  { name: "Parents' Friends", count: 10 }
]

// Generate a random Chinese name
function generateChineseName(): string {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  return `${lastName} ${firstName}`
}

async function generateSampleData() {
  try {
    // Generate guests for each table category
    const allGuests: Array<{ name: string; table: string }> = []
    
    // For each table category, generate the specified number of guests
    tableCategories.forEach(category => {
      const tableGuests = Array.from({ length: category.count }, () => ({
        name: generateChineseName(),
        table: category.name
      }))
      allGuests.push(...tableGuests)
    })

    // Sort guests by table name to group them together
    allGuests.sort((a, b) => a.table.localeCompare(b.table))

    // Create CSV content with header
    let csvContent = "Name,Table\n"
    allGuests.forEach(guest => {
      // Properly escape quotes in the name and table if they contain commas or quotes
      const escapedName = guest.name.includes('"') ? `"${guest.name.replace(/"/g, '""')}"` : `"${guest.name}"`
      const escapedTable = guest.table.includes('"') ? `"${guest.table.replace(/"/g, '""')}"` : `"${guest.table}"`
      csvContent += `${escapedName},${escapedTable}\n`
    })

    // Write to Downloads folder
    const homeDir = process.env.HOME || process.env.USERPROFILE
    const filePath = path.join(homeDir!, "Downloads", "wedding-guests.csv")
    fs.writeFileSync(filePath, csvContent)

    console.log("Generated tables:", tableCategories.map(c => c.name))
    console.log("Generated guests:", allGuests.length)
    console.log("CSV file generated at:", filePath)
    
    // Print first few entries as a preview
    console.log("\nPreview of the first few entries:")
    console.log(csvContent.split("\n").slice(0, 6).join("\n"))

  } catch (error) {
    console.error("Error generating sample data:", error)
  }
}

generateSampleData() 