import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { CallsList } from "@/components/calls/calls-list"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

export default async function CallsPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  // Fetch initial data
  const tenantFilter = await getTenantFilter()
  
  const [calls, total, campaigns] = await Promise.all([
    prisma.call.findMany({
      where: tenantFilter,
      take: 50,
      orderBy: { timestamp: "desc" },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        },
        assistant: {
          select: {
            id: true,
            name: true
          }
        },
        phoneNumber: {
          select: {
            id: true,
            displayName: true,
            phoneNumber: true
          }
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }),
    prisma.call.count({ where: tenantFilter }),
    prisma.campaign.findMany({
      where: {
        ...tenantFilter,
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: "asc" }
    })
  ])

  // Calculate statistics
  const [completed, successful, avgDurationResult, totalCostResult] = await Promise.all([
    prisma.call.count({
      where: {
        ...tenantFilter,
        status: "completed"
      }
    }),
    prisma.call.count({
      where: {
        ...tenantFilter,
        callOutcome: "success"
      }
    }),
    prisma.call.aggregate({
      where: {
        ...tenantFilter,
        duration: { not: null }
      },
      _avg: {
        duration: true
      }
    }),
    prisma.call.aggregate({
      where: {
        ...tenantFilter,
        cost: { not: null }
      },
      _sum: {
        cost: true
      }
    })
  ])

  const formattedCalls = calls.map(call => ({
    id: call.id,
    tenantId: call.tenantId,
    campaignId: call.campaignId,
    campaign: call.campaign,
    contactName: call.contactName,
    contactPhone: call.contactPhone,
    contactAddress: call.contactAddress,
    callId: call.callId,
    status: call.status,
    scheduledTime: call.scheduledTime,
    scheduledTimeLocal: call.scheduledTimeLocal,
    endedReason: call.endedReason,
    callOutcome: call.callOutcome,
    duration: call.duration ? Number(call.duration) : null,
    cost: call.cost ? Number(call.cost) : null,
    successEvaluation: call.successEvaluation,
    structuredData: call.structuredData,
    summary: call.summary,
    recordingUrl: call.recordingUrl,
    actualCallTime: call.actualCallTime,
    message: call.message,
    timestamp: call.timestamp,
    assistant: call.assistant,
    phoneNumber: call.phoneNumber,
    contact: call.contact
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage your call history with detailed analytics
          </p>
        </div>

        <CallsList
          initialCalls={formattedCalls}
          initialPagination={{
            page: 1,
            limit: 50,
            total,
            totalPages: Math.ceil(total / 50)
          }}
          initialStats={{
            total,
            completed,
            successful,
            avgDuration: avgDurationResult._avg.duration ? Number(avgDurationResult._avg.duration) : null,
            totalCost: totalCostResult._sum.cost ? Number(totalCostResult._sum.cost) : null
          }}
          campaigns={campaigns}
        />
      </div>
    </DashboardLayout>
  )
}
