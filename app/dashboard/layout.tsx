import { DashboardHeader } from "@/components/dashboard-header"
import { WeddingDataProvider } from "@/contexts/wedding-data"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WeddingDataProvider>
      <div className="flex flex-col min-h-screen">
        <DashboardHeader />
        <main className="flex-1">{children}</main>
      </div>
    </WeddingDataProvider>
  )
}
