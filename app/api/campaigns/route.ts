import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/campaigns - List campaigns with pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const isActive = searchParams.get("isActive")
    
    const skip = (page - 1) * limit

    const where: any = {
      ...tenantFilter,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true"
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
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
      prisma.campaign.count({ where })
    ])

    return NextResponse.json({
      campaigns: campaigns.map(campaign => ({
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
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error("Error fetching campaigns:", error)
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    )
  }
}

// POST /api/campaigns - Create new campaign
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = await getTenantId()
    
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      description,
      assistantId,
      phoneNumberId,
      isActive = true,
      scheduleDays = [],
      scheduleFrequency,
      timeZone = "UTC",
      startTime,
      endTime,
      retryAttempts = 1
    } = body

    if (!assistantId || !phoneNumberId) {
      return NextResponse.json(
        { error: "Assistant and phone number are required" },
        { status: 400 }
      )
    }

    // Verify assistant and phone number belong to tenant
    const [assistant, phoneNumber] = await Promise.all([
      prisma.assistant.findFirst({
        where: { id: assistantId, tenantId }
      }),
      prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, tenantId }
      })
    ])

    if (!assistant || !assistant.isActive) {
      return NextResponse.json(
        { error: "Selected assistant is not available" },
        { status: 400 }
      )
    }

    if (!phoneNumber || !phoneNumber.isActive) {
      return NextResponse.json(
        { error: "Selected phone number is not available" },
        { status: 400 }
      )
    }

    // Generate campaign ID
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const campaign = await prisma.campaign.create({
      data: {
        id: campaignId,
        tenantId,
        name: name || null,
        description: description || null,
        assistantId,
        phoneNumberId,
        isActive,
        scheduleDays: scheduleDays || [],
        scheduleFrequency: scheduleFrequency || null,
        timeZone: timeZone || "UTC",
        startTime: startTime || null,
        endTime: endTime || null,
        retryAttempts: retryAttempts || 1
      },
      include: {
        assistant: {
          select: { id: true, name: true }
        },
        phoneNumber: {
          select: { id: true, displayName: true, phoneNumber: true }
        }
      }
    })

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        assistantId: campaign.assistantId,
        assistant: campaign.assistant,
        phoneNumberId: campaign.phoneNumberId,
        phoneNumber: campaign.phoneNumber,
        isActive: campaign.isActive,
        scheduleDays: campaign.scheduleDays,
        scheduleFrequency: campaign.scheduleFrequency,
        timeZone: campaign.timeZone,
        startTime: campaign.startTime,
        endTime: campaign.endTime,
        retryAttempts: campaign.retryAttempts,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating campaign:", error)
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    )
  }
}


