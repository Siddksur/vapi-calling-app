import axios from "axios"
import { prisma } from "./prisma"

interface VAPIConfig {
  privateKey: string
  organizationId: string | null
  baseUrl: string
  customVariables?: Record<string, string> | null
}

interface Contact {
  name: string
  phone: string
  address?: string | null
  email?: string | null
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
      vapiBaseUrl: true,
      vapiCustomVariables: true
    }
  })

  if (!tenant || !tenant.vapiPrivateKey) {
    return null
  }

  return {
    privateKey: tenant.vapiPrivateKey,
    organizationId: tenant.vapiOrganizationId,
    baseUrl: tenant.vapiBaseUrl || "https://api.vapi.ai",
    customVariables: tenant.vapiCustomVariables as Record<string, string> | null
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

    // Build default variable values
    const defaultVariables: Record<string, string> = {
      name: contact.name || "",
      "customer.number": formattedPhone,
      address: contact.address || "",
      email: contact.email || ""
    }

    // Merge with tenant's custom variables (custom variables override defaults if same key)
    const customVariables = config.customVariables || {}
    const variableValues = {
      ...defaultVariables,
      ...customVariables
    }

    // Build call data - DO NOT include organizationId in the body
    // The API key in the Authorization header identifies the organization
    // NOTE: serverUrl should be configured in VAPI assistant settings, not sent per call
    const callData: any = {
      assistantId,
      phoneNumberId,
      customer: {
        number: formattedPhone
      },
      assistantOverrides: {
        variableValues
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

/**
 * Get assistant details from VAPI
 */
export async function getVAPIAssistant(
  assistantId: string,
  tenantId: string
): Promise<{
  success: boolean
  assistant?: {
    id: string
    name: string
    description?: string | null
    systemPrompt?: string | null
    firstMessage?: string | null
  }
  error?: string
}> {
  try {
    const config = await getVAPIConfig(tenantId)
    if (!config) {
      return {
        success: false,
        error: "VAPI configuration not found for tenant"
      }
    }

    const response = await axios.get(`${config.baseUrl}/assistant/${assistantId}`, {
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json"
      }
    })

    const assistant = response.data

    // Extract system prompt from model.messages array
    let systemPrompt: string | null = null
    if (assistant.model?.messages && Array.isArray(assistant.model.messages)) {
      const systemMessage = assistant.model.messages.find(
        (msg: any) => msg.role === "system"
      )
      if (systemMessage?.content) {
        systemPrompt = systemMessage.content
      }
    }

    // Extract first message
    const firstMessage = assistant.firstMessage || null

    return {
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name || assistant.firstMessage || "Unnamed Assistant",
        description: assistant.description || assistant.model?.provider || null,
        systemPrompt,
        firstMessage
      }
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Unknown error"
    console.error(`❌ Error fetching VAPI assistant ${assistantId}:`, errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Update assistant in VAPI
 */
export async function updateVAPIAssistant(
  assistantId: string,
  tenantId: string,
  updates: {
    systemPrompt?: string
    firstMessage?: string
  }
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const config = await getVAPIConfig(tenantId)
    if (!config) {
      return {
        success: false,
        error: "VAPI configuration not found for tenant"
      }
    }

    // First, fetch current assistant to preserve existing structure
    const currentResponse = await axios.get(`${config.baseUrl}/assistant/${assistantId}`, {
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json"
      }
    })

    const currentAssistant = currentResponse.data

    // Build update payload
    const updatePayload: any = {}

    // Update first message if provided
    if (updates.firstMessage !== undefined) {
      updatePayload.firstMessage = updates.firstMessage
    }

    // Update system prompt if provided
    if (updates.systemPrompt !== undefined) {
      // Preserve existing model structure
      const existingModel = currentAssistant.model || {}
      const existingMessages = existingModel.messages || []
      
      // Find and update system message, or add it if it doesn't exist
      const systemMessageIndex = existingMessages.findIndex(
        (msg: any) => msg.role === "system"
      )

      if (systemMessageIndex >= 0) {
        // Update existing system message
        existingMessages[systemMessageIndex] = {
          ...existingMessages[systemMessageIndex],
          content: updates.systemPrompt
        }
      } else {
        // Add new system message at the beginning
        existingMessages.unshift({
          role: "system",
          content: updates.systemPrompt
        })
      }

      updatePayload.model = {
        ...existingModel,
        messages: existingMessages
      }
    }

    // Update assistant in VAPI
    await axios.patch(`${config.baseUrl}/assistant/${assistantId}`, updatePayload, {
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json"
      }
    })

    console.log(`✅ Successfully updated VAPI assistant ${assistantId}`)

    return {
      success: true
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || "Unknown error"
    console.error(`❌ Error updating VAPI assistant ${assistantId}:`, errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}
