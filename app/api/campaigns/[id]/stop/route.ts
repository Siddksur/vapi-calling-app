import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

/**
 * POST /api/campaigns/[id]/stop - Stop/pause a campaign
 * This will:
 * 1. Set campaign.isActive = false
 * 2. Cancel all scheduled calls for this campaign
 * 3. Allow active calls to complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = await params
    const tenantFilter = await getTenantFilter()

    // Verify campaign exists and belongs to tenant
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ...tenantFilter,
        deletedAt: null
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Deactivate campaign
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        isActive: false
      }
    })

    // Cancel all scheduled calls
    const cancelledCount = await prisma.call.updateMany({
      where: {
        campaignId: campaignId,
        status: "scheduled"
      },
      data: {
        status: "cancelled",
        message: "Call cancelled: Campaign stopped"
      }
    })

    return NextResponse.json({
      success: true,
      message: "Campaign stopped successfully",
      cancelledCalls: cancelledCount.count
    })
  } catch (error: any) {
    console.error("Error stopping campaign:", error)
    return NextResponse.json(
      { error: "Failed to stop campaign" },
      { status: 500 }
    )
  }
}




