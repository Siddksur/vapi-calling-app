import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

// GET /api/calls - List calls with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const campaignId = searchParams.get("campaignId") || ""
    const callOutcome = searchParams.get("callOutcome") || ""
    const startDate = searchParams.get("startDate") || ""
    const endDate = searchParams.get("endDate") || ""
    
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      ...tenantFilter,
    }

    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: "insensitive" } },
        { contactPhone: { contains: search, mode: "insensitive" } },
        { callId: { contains: search, mode: "insensitive" } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (campaignId) {
      where.campaignId = campaignId
    }

    if (callOutcome) {
      where.callOutcome = callOutcome
    }

    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) {
        where.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate)
      }
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        skip,
        take: limit,
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
      prisma.call.count({ where })
    ])

    // Calculate statistics
    const stats = await Promise.all([
      prisma.call.count({
        where: {
          ...where,
          status: "completed"
        }
      }),
      prisma.call.count({
        where: {
          ...where,
          callOutcome: "success"
        }
      }),
      prisma.call.aggregate({
        where: {
          ...where,
          duration: { not: null }
        },
        _avg: {
          duration: true
        }
      }),
      prisma.call.aggregate({
        where: {
          ...where,
          cost: { not: null }
        },
        _sum: {
          cost: true
        }
      })
    ])

    return NextResponse.json({
      calls: calls.map(call => ({
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
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total: total,
        completed: stats[0],
        successful: stats[1],
        avgDuration: stats[2]._avg.duration ? Number(stats[2]._avg.duration) : null,
        totalCost: stats[3]._sum.cost ? Number(stats[3]._sum.cost) : null
      }
    })
  } catch (error: any) {
    console.error("Error fetching calls:", error)
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    )
  }
}




