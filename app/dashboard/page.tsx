import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, BarChart3, TrendingUp, Users } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  // Get tenant-scoped statistics
  const tenantFilter = await getTenantFilter()
  
  // Get contacts count (gracefully handle if table doesn't exist yet)
  let totalContacts = 0
  try {
    totalContacts = await prisma.contact.count({ where: tenantFilter })
  } catch (error) {
    // Contacts table might not exist yet, default to 0
    console.warn('Contacts table not available:', error)
  }
  
  const [totalCalls, totalCampaigns, recentCalls] = await Promise.all([
    prisma.call.count({ where: tenantFilter }),
    prisma.campaign.count({ 
      where: { ...tenantFilter, deletedAt: null, isActive: true } 
    }),
    prisma.call.findMany({
      where: tenantFilter,
      take: 5,
      orderBy: { timestamp: "desc" },
      include: {
        campaign: {
          select: { name: true }
        }
      }
    }) as Promise<Array<{
      id: number
      contactName: string
      contactPhone: string
      status: string | null
      timestamp: Date | null
      campaign: { name: string | null } | null
    }>>
  ])

  const stats = [
    {
      title: "Total Calls",
      value: totalCalls.toLocaleString(),
      icon: Phone,
      description: "All time calls"
    },
    {
      title: "Active Campaigns",
      value: totalCampaigns.toLocaleString(),
      icon: BarChart3,
      description: "Currently running"
    },
    {
      title: "Contacts",
      value: totalContacts.toLocaleString(),
      icon: Users,
      description: "In your CRM"
    },
    {
      title: "Success Rate",
      value: "0%",
      icon: TrendingUp,
      description: "Call success rate"
    }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back, {session.user.name || session.user.email}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>Your most recent call activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No calls yet</p>
            ) : (
              <div className="space-y-4">
                {recentCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div>
                      <p className="font-medium">{call.contactName}</p>
                      <p className="text-sm text-gray-500">{call.contactPhone}</p>
                      {call.campaign && (
                        <p className="text-xs text-gray-400 mt-1">Campaign: {call.campaign.name || "N/A"}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{call.status || "N/A"}</p>
                      <p className="text-xs text-gray-500">
                        {call.timestamp ? new Date(call.timestamp).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

