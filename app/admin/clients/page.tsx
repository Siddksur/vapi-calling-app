import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Building2, Users, Phone } from "lucide-react"
import { ClientTable } from "@/components/admin/client-table"

export default async function AdminClientsPage() {
  try {
    const session = await auth()

    if (!session || !session.user || session.user.role !== "OWNER") {
      redirect("/dashboard")
    }

    // Fetch tenants with counts
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            campaigns: true,
            calls: true
          }
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Client Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage all client accounts and their subscriptions
              </p>
            </div>
            <Link href="/admin/clients/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </Link>
          </div>

          <ClientTable tenants={tenants} />
        </div>
      </DashboardLayout>
    )
  } catch (error: any) {
    console.error("Error in AdminClientsPage:", error)
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Client Management</h1>
            <p className="text-red-600 dark:text-red-400 mt-1">
              Error loading clients: {error.message}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }
}

