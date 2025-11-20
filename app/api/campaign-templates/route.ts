import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/campaign-templates - List all templates for a tenant
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()

    const templates = await prisma.campaignTemplate.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
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
      templates: templates.map(template => ({
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
      }))
    })
  } catch (error: any) {
    console.error("Error fetching campaign templates:", error)
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    )
  }
}

// POST /api/campaign-templates - Create new template
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

    const template = await prisma.campaignTemplate.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description || null,
        assistantId: assistantId || null,
        phoneNumberId: phoneNumberId || null,
        isActive: isActive ?? true,
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
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating campaign template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    )
  }
}




