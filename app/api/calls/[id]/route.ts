import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

// GET /api/calls/[id] - Get single call with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const tenantFilter = await getTenantFilter()

    const call = await prisma.call.findFirst({
      where: {
        id: parseInt(id),
        ...tenantFilter
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        assistant: {
          select: {
            id: true,
            name: true,
            description: true
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
            email: true,
            phone: true,
            address: true
          }
        }
      }
    })

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 })
    }

    return NextResponse.json({
      call: {
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
      }
    })
  } catch (error: any) {
    console.error("Error fetching call:", error)
    return NextResponse.json(
      { error: "Failed to fetch call" },
      { status: 500 }
    )
  }
}




