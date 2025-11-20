import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/campaigns/[id] - Get single campaign
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

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: id,
        ...tenantFilter,
        deletedAt: null
      },
      include: {
        assistant: {
          select: { id: true, name: true, description: true }
        },
        phoneNumber: {
          select: { id: true, displayName: true, phoneNumber: true }
        },
        calls: {
          take: 10,
          orderBy: { timestamp: "desc" },
          select: {
            id: true,
            contactName: true,
            contactPhone: true,
            status: true,
            callOutcome: true,
            timestamp: true
          }
        },
        _count: {
          select: { calls: true }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

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
        scheduleDays: campaign.scheduleDays || [],
        scheduleFrequency: campaign.scheduleFrequency,
        timeZone: campaign.timeZone || "UTC",
        startTime: campaign.startTime,
        endTime: campaign.endTime,
        retryAttempts: campaign.retryAttempts,
        calls: campaign.calls,
        callCount: campaign._count.calls,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      }
    })
  } catch (error: any) {
    console.error("Error fetching campaign:", error)
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    )
  }
}

// PUT /api/campaigns/[id] - Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const tenantId = await getTenantId()
    const tenantFilter = await getTenantFilter()

    // Verify campaign exists and belongs to tenant
    const existing = await prisma.campaign.findFirst({
      where: {
        id: id,
        ...tenantFilter,
        deletedAt: null
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      description,
      assistantId,
      phoneNumberId,
      isActive,
      scheduleDays,
      scheduleFrequency,
      timeZone,
      startTime,
      endTime,
      retryAttempts
    } = body

    // Verify assistant and phone number if being updated
    if (assistantId && assistantId !== existing.assistantId) {
      const assistant = await prisma.assistant.findFirst({
        where: { id: assistantId, tenantId: tenantId as string }
      })
      if (!assistant || !assistant.isActive) {
        return NextResponse.json(
          { error: "Selected assistant is not available" },
          { status: 400 }
        )
      }
    }

    if (phoneNumberId && phoneNumberId !== existing.phoneNumberId) {
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, tenantId: tenantId as string }
      })
      if (!phoneNumber || !phoneNumber.isActive) {
        return NextResponse.json(
          { error: "Selected phone number is not available" },
          { status: 400 }
        )
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id: id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        assistantId: assistantId || existing.assistantId,
        phoneNumberId: phoneNumberId || existing.phoneNumberId,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        scheduleDays: scheduleDays !== undefined ? scheduleDays : existing.scheduleDays,
        scheduleFrequency: scheduleFrequency !== undefined ? scheduleFrequency : existing.scheduleFrequency,
        timeZone: timeZone || existing.timeZone || "UTC",
        startTime: startTime !== undefined ? startTime : existing.startTime,
        endTime: endTime !== undefined ? endTime : existing.endTime,
        retryAttempts: retryAttempts !== undefined ? retryAttempts : existing.retryAttempts
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
    })
  } catch (error: any) {
    console.error("Error updating campaign:", error)
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    )
  }
}

// DELETE /api/campaigns/[id] - Soft delete campaign
export async function DELETE(
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

    // Verify campaign exists and belongs to tenant
    const existing = await prisma.campaign.findFirst({
      where: {
        id: id,
        ...tenantFilter,
        deletedAt: null
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Soft delete
    await prisma.campaign.update({
      where: { id: id },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting campaign:", error)
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    )
  }
}


