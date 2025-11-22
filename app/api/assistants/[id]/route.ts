import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"
import { getVAPIAssistant, updateVAPIAssistant } from "@/lib/vapi"

// GET /api/assistants/[id] - Get assistant details including system prompt and first message
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
    const tenantId = await getTenantId()

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    // Fetch assistant from database
    const assistant = await prisma.assistant.findFirst({
      where: {
        id,
        ...tenantFilter
      },
      select: {
        id: true,
        name: true,
        description: true,
        systemPrompt: true,
        firstMessage: true,
        isActive: true
      }
    })

    if (!assistant) {
      return NextResponse.json({ error: "Assistant not found" }, { status: 404 })
    }

    // If system prompt or first message is missing, fetch from VAPI
    if (!assistant.systemPrompt || !assistant.firstMessage) {
      const vapiResult = await getVAPIAssistant(id, tenantId)
      
      if (vapiResult.success && vapiResult.assistant) {
        // Update database with fetched values
        const updateData: {
          systemPrompt?: string | null
          firstMessage?: string | null
        } = {}

        if (!assistant.systemPrompt && vapiResult.assistant.systemPrompt) {
          updateData.systemPrompt = vapiResult.assistant.systemPrompt
        }

        if (!assistant.firstMessage && vapiResult.assistant.firstMessage) {
          updateData.firstMessage = vapiResult.assistant.firstMessage
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.assistant.update({
            where: { id },
            data: updateData
          })

          // Return updated assistant
          return NextResponse.json({
            assistant: {
              ...assistant,
              ...updateData
            }
          })
        }
      }
    }

    return NextResponse.json({ assistant })
  } catch (error: any) {
    console.error("Error fetching assistant:", error)
    return NextResponse.json(
      { error: "Failed to fetch assistant" },
      { status: 500 }
    )
  }
}

// PATCH /api/assistants/[id] - Update assistant system prompt and/or first message
export async function PATCH(
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
    const tenantId = await getTenantId()

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    // Verify assistant belongs to tenant
    const assistant = await prisma.assistant.findFirst({
      where: {
        id,
        ...tenantFilter
      }
    })

    if (!assistant) {
      return NextResponse.json({ error: "Assistant not found" }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { systemPrompt, firstMessage } = body

    // Validate that at least one field is provided
    if (systemPrompt === undefined && firstMessage === undefined) {
      return NextResponse.json(
        { error: "At least one field (systemPrompt or firstMessage) must be provided" },
        { status: 400 }
      )
    }

    // Prepare update data
    const updates: {
      systemPrompt?: string
      firstMessage?: string
    } = {}

    if (systemPrompt !== undefined) {
      updates.systemPrompt = systemPrompt
    }

    if (firstMessage !== undefined) {
      updates.firstMessage = firstMessage
    }

    // Update in VAPI first
    const vapiResult = await updateVAPIAssistant(id, tenantId, updates)

    if (!vapiResult.success) {
      return NextResponse.json(
        { error: vapiResult.error || "Failed to update assistant in VAPI" },
        { status: 500 }
      )
    }

    // Update in local database
    const updateData: {
      systemPrompt?: string | null
      firstMessage?: string | null
      updatedAt: Date
    } = {
      updatedAt: new Date()
    }

    if (systemPrompt !== undefined) {
      updateData.systemPrompt = systemPrompt || null
    }

    if (firstMessage !== undefined) {
      updateData.firstMessage = firstMessage || null
    }

    const updatedAssistant = await prisma.assistant.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        systemPrompt: true,
        firstMessage: true,
        isActive: true
      }
    })

    return NextResponse.json({
      assistant: updatedAssistant,
      message: "Assistant updated successfully"
    })
  } catch (error: any) {
    console.error("Error updating assistant:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update assistant" },
      { status: 500 }
    )
  }
}

