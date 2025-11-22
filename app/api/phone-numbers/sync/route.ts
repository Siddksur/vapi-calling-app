import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantId } from "@/lib/tenant"
import axios from "axios"

// POST /api/phone-numbers/sync - Sync phone numbers from VAPI
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

    // Fetch phone numbers from VAPI
    // Note: organizationId should NOT be in the request body or params
    // The API key in the Authorization header identifies the organization
    console.log(`🔄 Syncing phone numbers for tenant ${tenantId} from VAPI...`)
    
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tenant.vapiPrivateKey}`,
      "Content-Type": "application/json"
    }

    const response = await axios.get(`${baseUrl}/phone-number`, {
      headers,
      // No params - don't include organizationId
    })

    // Handle different response formats
    let vapiPhoneNumbers: any[] = []
    
    if (Array.isArray(response.data)) {
      vapiPhoneNumbers = response.data
    } else if (response.data?.phoneNumbers && Array.isArray(response.data.phoneNumbers)) {
      vapiPhoneNumbers = response.data.phoneNumbers
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      vapiPhoneNumbers = response.data.data
    } else if (response.data && typeof response.data === 'object') {
      // Single phone number object
      vapiPhoneNumbers = [response.data]
    }

    console.log(`📥 Received ${vapiPhoneNumbers.length} phone number(s) from VAPI`)

    if (!Array.isArray(vapiPhoneNumbers) || vapiPhoneNumbers.length === 0) {
      console.warn("⚠️ No phone numbers found in VAPI response:", response.data)
      return NextResponse.json({
        success: true,
        message: "No phone numbers found in VAPI organization",
        synced: 0,
        total: 0
      })
    }

    // Sync phone numbers to database
    const syncedPhoneNumbers = []
    const errors = []

    for (const vapiPhoneNumber of vapiPhoneNumbers) {
      try {
        // Extract phone number data from VAPI response
        const phoneId = vapiPhoneNumber.id
        const displayName = vapiPhoneNumber.name || vapiPhoneNumber.displayName || vapiPhoneNumber.number || "Unnamed Phone"
        const phoneNumber = vapiPhoneNumber.number || vapiPhoneNumber.phoneNumber || null

        if (!phoneId) {
          console.warn("⚠️ Skipping phone number without ID:", vapiPhoneNumber)
          continue
        }

        const phoneNumberRecord = await prisma.phoneNumber.upsert({
          where: { id: phoneId },
          update: {
            displayName,
            phoneNumber,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            id: phoneId,
            tenantId: tenantId,
            displayName,
            phoneNumber,
            isActive: true
          }
        })

        syncedPhoneNumbers.push(phoneNumberRecord)
      } catch (error: any) {
        errors.push({
          phoneNumberId: vapiPhoneNumber.id,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedPhoneNumbers.length} phone number(s)`,
      synced: syncedPhoneNumbers.length,
      total: vapiPhoneNumbers.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error("Error syncing phone numbers:", error)
    
    // Check if it's the organizationId error
    if (error.response?.data?.message?.includes("organizationId")) {
      return NextResponse.json(
        { error: "VAPI API error: organizationId should not be included in the request body. It's handled via authentication." },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.response?.data?.message || error.message || "Failed to sync phone numbers" },
      { status: 500 }
    )
  }
}




