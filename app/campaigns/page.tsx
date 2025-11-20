import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { CampaignsList } from "@/components/campaigns/campaigns-list"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

export default async function CampaignsPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  // Fetch initial campaigns
  const tenantFilter = await getTenantFilter()
  
  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        ...tenantFilter,
        deletedAt: null
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        assistant: {
          select: { id: true, name: true }
        },
        phoneNumber: {
          select: { id: true, displayName: true, phoneNumber: true }
        },
        _count: {
          select: { calls: true }
        }
      }
    }),
    prisma.campaign.count({
      where: {
        ...tenantFilter,
        deletedAt: null
      }
    })
  ])

  const formattedCampaigns = campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    assistantId: campaign.assistantId,
    assistant: campaign.assistant,
    phoneNumberId: campaign.phoneNumberId,
    phoneNumber: campaign.phoneNumber,
    isActive: campaign.isActive,
    scheduleDays: campaign.scheduleDays || [],
    scheduleFrequency: campaign.scheduleFrequency,
    timeZone: campaign.timeZone || "UTC",
    startTime: campaign.startTime,
    endTime: campaign.endTime,
    retryAttempts: campaign.retryAttempts,
    callCount: campaign._count.calls,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your voice calling campaigns
          </p>
        </div>

        <CampaignsList
          initialCampaigns={formattedCampaigns}
          initialPagination={{
            page: 1,
            limit: 20,
            total,
            totalPages: Math.ceil(total / 20)
          }}
        />
      </div>
    </DashboardLayout>
  )
}
