import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantId, getTenantFilter } from "@/lib/tenant"
import axios from "axios"

// POST /api/assistants/sync - Sync assistants from VAPI
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

    // Get tenant's VAPI configuration
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        vapiPrivateKey: true,
        vapiOrganizationId: true,
        vapiBaseUrl: true
      }
    })

    if (!tenant?.vapiPrivateKey) {
      return NextResponse.json(
        { error: "VAPI configuration not found for this tenant" },
        { status: 400 }
      )
    }

    const baseUrl = tenant.vapiBaseUrl || "https://api.vapi.ai"

    // Fetch assistants from VAPI
    // Note: organizationId should NOT be in the request body
    // It's handled via the API key/authentication
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tenant.vapiPrivateKey}`,
      "Content-Type": "application/json"
    }

    // Fetch assistants from VAPI
    // Note: organizationId should NOT be in the request body or params
    // The API key in the Authorization header identifies the organization
    console.log(`🔄 Syncing assistants for tenant ${tenantId} from VAPI...`)
    
    const response = await axios.get(`${baseUrl}/assistant`, {
      headers,
      // No params - don't include organizationId
    })

    // Handle different response formats
    let vapiAssistants: any[] = []
    
    if (Array.isArray(response.data)) {
      vapiAssistants = response.data
    } else if (response.data?.assistants && Array.isArray(response.data.assistants)) {
      vapiAssistants = response.data.assistants
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      vapiAssistants = response.data.data
    } else if (response.data && typeof response.data === 'object') {
      // Single assistant object
      vapiAssistants = [response.data]
    }

    console.log(`📥 Received ${vapiAssistants.length} assistant(s) from VAPI`)

    if (!Array.isArray(vapiAssistants) || vapiAssistants.length === 0) {
      console.warn("⚠️ No assistants found in VAPI response:", response.data)
      return NextResponse.json({
        success: true,
        message: "No assistants found in VAPI organization",
        synced: 0,
        total: 0
      })
    }

    // Sync assistants to database
    const syncedAssistants = []
    const errors = []

    for (const vapiAssistant of vapiAssistants) {
      try {
        const assistant = await prisma.assistant.upsert({
          where: { id: vapiAssistant.id },
          update: {
            name: vapiAssistant.name || vapiAssistant.firstMessage || "Unnamed Assistant",
            description: vapiAssistant.model?.provider || vapiAssistant.description || null,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            id: vapiAssistant.id,
            tenantId: tenantId,
            name: vapiAssistant.name || vapiAssistant.firstMessage || "Unnamed Assistant",
            description: vapiAssistant.model?.provider || vapiAssistant.description || null,
            isActive: true
          }
        })

        syncedAssistants.push(assistant)
      } catch (error: any) {
        errors.push({
          assistantId: vapiAssistant.id,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedAssistants.length} assistant(s)`,
      synced: syncedAssistants.length,
      total: vapiAssistants.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error("Error syncing assistants:", error)
    
    // Check if it's the organizationId error
    if (error.response?.data?.message?.includes("organizationId")) {
      return NextResponse.json(
        { error: "VAPI API error: organizationId should not be included in the request body. It's handled via authentication." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.response?.data?.message || error.message || "Failed to sync assistants" },
      { status: 500 }
    )
  }
}

