import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/campaign-templates/[id] - Get single template
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

    const template = await prisma.campaignTemplate.findFirst({
      where: {
        id: id,
        ...tenantFilter
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

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        assistantId: template.assistantId,
        assistant: template.assistant,
        phoneNumberId: template.phoneNumberId,
        phoneNumber: template.phoneNumber,
        isActive: template.isActive,
        scheduleDays: template.scheduleDays,
        scheduleFrequency: template.scheduleFrequency,
        timeZone: template.timeZone,
        startTime: template.startTime,
        endTime: template.endTime,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString()
      }
    })
  } catch (error: any) {
    console.error("Error fetching template:", error)
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    )
  }
}

// PUT /api/campaign-templates/[id] - Update template
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

    // Verify template exists and belongs to tenant
    const existing = await prisma.campaignTemplate.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
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
      endTime
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      )
    }

    // Verify assistant and phone number belong to tenant if provided
    if (assistantId) {
      const assistant = await prisma.assistant.findFirst({
        where: { id: assistantId, tenantId }
      })
      if (!assistant) {
        return NextResponse.json(
          { error: "Selected assistant is not available" },
          { status: 400 }
        )
      }
    }

    if (phoneNumberId) {
      const phoneNumber = await prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, tenantId }
      })
      if (!phoneNumber) {
        return NextResponse.json(
          { error: "Selected phone number is not available" },
          { status: 400 }
        )
      }
    }

    const template = await prisma.campaignTemplate.update({
      where: { id: id },
      data: {
        name: name.trim(),
        description: description || null,
        assistantId: assistantId || null,
        phoneNumberId: phoneNumberId || null,
        isActive: isActive ?? existing.isActive,
        scheduleDays: scheduleDays || [],
        scheduleFrequency: scheduleFrequency || null,
        timeZone: timeZone || "UTC",
        startTime: startTime || null,
        endTime: endTime || null
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
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        assistantId: template.assistantId,
        assistant: template.assistant,
        phoneNumberId: template.phoneNumberId,
        phoneNumber: template.phoneNumber,
        isActive: template.isActive,
        scheduleDays: template.scheduleDays,
        scheduleFrequency: template.scheduleFrequency,
        timeZone: template.timeZone,
        startTime: template.startTime,
        endTime: template.endTime,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString()
      }
    })
  } catch (error: any) {
    console.error("Error updating template:", error)
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    )
  }
}

// DELETE /api/campaign-templates/[id] - Delete template
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

    // Verify template exists and belongs to tenant
    const existing = await prisma.campaignTemplate.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    await prisma.campaignTemplate.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}




