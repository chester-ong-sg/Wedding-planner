import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, CalendarHeart, Users, Table2 } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <CalendarHeart className="h-6 w-6 mr-2" />
          <span className="font-bold">Wedding Planner</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            Login
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/register">
            Register
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                    Plan Your Perfect Wedding Seating
                  </h1>
                  <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                    Simplify your wedding planning with our intuitive drag-and-drop table planner. Arrange tables,
                    assign guests, and create the perfect seating arrangement.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/planner">
                    <Button size="lg" className="gap-2">
                      Get Started <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                    <Table2 className="h-8 w-8" />
                    <h3 className="text-xl font-bold">Table Management</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Create and arrange tables with different shapes and sizes
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
                    <Users className="h-8 w-8" />
                    <h3 className="text-xl font-bold">Guest Assignment</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Drag and drop guests to assign them to tables
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Setup Instructions</h2>
                <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                  To use this application, you need to set up your Supabase environment variables.
                </p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <div className="rounded-lg bg-white p-4 shadow-md dark:bg-gray-900">
                  <h3 className="mb-2 font-medium">Environment Variables</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Add these to your .env.local file:</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
                    <br />
                    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full border-t px-4 md:px-6">
        <p className="text-xs text-gray-500 dark:text-gray-400">© 2023 Wedding Planner. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  )
}

