import axios from "axios"
import { prisma } from "./prisma"

interface VAPIConfig {
  privateKey: string
  organizationId: string | null
  baseUrl: string
}

interface Contact {
  name: string
  phone: string
  address?: string | null
}

interface MakeCallParams {
  tenantId: string
  contact: Contact
  assistantId: string
  phoneNumberId: string
  callId?: number // Database call ID for updating status
  campaignId?: string
}

/**
 * Get VAPI configuration for a tenant
 */
export async function getVAPIConfig(tenantId: string): Promise<VAPIConfig | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      vapiPrivateKey: true,
      vapiOrganizationId: true,
      vapiBaseUrl: true
    }
  })

  if (!tenant || !tenant.vapiPrivateKey) {
    return null
  }

  return {
    privateKey: tenant.vapiPrivateKey,
    organizationId: tenant.vapiOrganizationId,
    baseUrl: tenant.vapiBaseUrl || "https://api.vapi.ai"
  }
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "")

  // If it starts with 1 and has 11 digits, keep as is
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`
  }

  // If it has 10 digits, assume US number and add +1
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`
  }

  // Otherwise, add + if not present
  if (!phone.startsWith("+")) {
    return `+${digitsOnly}`
  }

  return phone
}

/**
 * Make a VAPI call
 * NOTE: organizationId should NOT be included in the request body
 * It's handled via the API key authentication
 */
export async function makeVAPICall(params: MakeCallParams): Promise<{
  success: boolean
  callId?: string
  error?: string
}> {
  const { tenantId, contact, assistantId, phoneNumberId, callId, campaignId } = params

  try {
    // Get tenant-specific VAPI config
    const config = await getVAPIConfig(tenantId)
    if (!config) {
      return {
        success: false,
        error: "VAPI configuration not found for tenant"
      }
    }

    const formattedPhone = formatPhoneNumber(contact.phone)

    // Build call data - DO NOT include organizationId in the body
    // The API key in the Authorization header identifies the organization
    const callData: any = {
      assistantId,
      phoneNumberId,
      customer: {
        number: formattedPhone
      },
      assistantOverrides: {
        variableValues: {
          name: contact.name || "",
          "customer.number": formattedPhone,
          address: contact.address || ""
        }
      }
    }

    // DO NOT add organizationId to callData - it causes errors
    // The VAPI API identifies the organization via the API key in the Authorization header

    console.log(`📞 Making VAPI call for: ${contact.name} ${formattedPhone} (Call ID: ${callId})`)

    const response = await axios.post(`${config.baseUrl}/call`, callData, {
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json"
      }
    })

    const vapiCallId = response.data.id

    // Update database call record
    if (callId) {
      await prisma.call.update({
        where: { id: callId },
        data: {
          callId: vapiCallId,
          status: "calling",
          message: `Call initiated for ${contact.name}`,
          timestamp: new Date(),
          assistantId,
          phoneNumberId
        }
      })
    }

    console.log(`✅ VAPI call successful for ${contact.name}: ${vapiCallId}`)

    return {
      success: true,
      callId: vapiCallId
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Unknown error"
    console.error(`❌ Error making VAPI call for ${contact.name}:`, errorMessage)

    // Update database call record with error
    if (callId) {
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: "failed",
          message: `Failed to initiate call: ${errorMessage}`,
          timestamp: new Date()
        }
      }).catch(err => {
        console.error("Failed to update call status:", err)
      })
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}
