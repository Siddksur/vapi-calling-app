import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2, DollarSign, TrendingUp } from "lucide-react"

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session || !session.user || session.user.role !== UserRole.OWNER) {
    redirect("/dashboard")
  }

  // Get platform-wide statistics
  const [
    totalTenants,
    activeTenants,
    totalCalls,
    totalCampaigns,
    recentTenants
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.call.count(),
    prisma.campaign.count({ where: { deletedAt: null, isActive: true } }),
    prisma.tenant.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            campaigns: true,
            calls: true
          }
        }
      }
    })
  ])

  const stats = [
    {
      title: "Total Clients",
      value: totalTenants.toLocaleString(),
      icon: Building2,
      description: `${activeTenants} active`
    },
    {
      title: "Total Calls",
      value: totalCalls.toLocaleString(),
      icon: TrendingUp,
      description: "Platform-wide"
    },
    {
      title: "Active Campaigns",
      value: totalCampaigns.toLocaleString(),
      icon: Users,
      description: "Across all clients"
    },
    {
      title: "Revenue",
      value: "$0",
      icon: DollarSign,
      description: "This month"
    }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Platform overview and management
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

        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Clients</CardTitle>
            <CardDescription>Recently added client accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTenants.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No clients yet</p>
            ) : (
              <div className="space-y-4">
                {recentTenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-gray-500">{tenant.slug}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Plan: {tenant.planType} • {tenant._count.users} user(s) • {tenant._count.campaigns} campaign(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tenant.isActive 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {tenant.isActive ? "Active" : "Inactive"}
                      </span>
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

