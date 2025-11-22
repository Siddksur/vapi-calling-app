import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Legacy webhook endpoint for backward compatibility
 * This route maintains the old Express.js path: /webhook/call-ended
 * It uses the same logic as /api/vapi/webhook
 * 
 * VAPI webhook handler for call status updates
 * VAPI will POST to this endpoint when call status changes
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    // Log webhook received for debugging
    console.log("📥 VAPI webhook received (legacy endpoint):", JSON.stringify(payload, null, 2))
    console.log("🔍 Webhook headers:", Object.fromEntries(request.headers.entries()))

    // VAPI webhooks can have different structures
    // Handle both direct payload and nested message structure
    let webhookData = payload
    
    // Check if it's the nested structure (end-of-call-report)
    if (payload.message?.type === "end-of-call-report") {
      webhookData = payload.message
    }

    // Extract VAPI call data
    const vapiCallId = webhookData.call?.id || webhookData.id || payload.callId || payload.id
    const status = webhookData.status || payload.status // e.g., "queued", "ringing", "in-progress", "ended"
    const endedReason = webhookData.endedReason || payload.endedReason
    const recordingUrl = webhookData.recording?.url || payload.recording?.url || payload.recordingUrl
    const summary = webhookData.analysis?.summary || webhookData.summary || payload.summary
    const transcript = webhookData.transcript || payload.transcript
    const duration = webhookData.durationSeconds || webhookData.duration || payload.duration
    const cost = webhookData.cost || payload.cost
    const structuredData = webhookData.analysis?.structuredData || webhookData.structuredData || payload.structuredData || {}
    // Extract CallOutcome from structured data (preserve original format: voicemail, interested, callback, etc.)
    const callOutcome = structuredData?.CallOutcome || webhookData.analysis?.structuredData?.CallOutcome
    
    // Extract assistantId and phoneNumberId to help identify tenant in fallback
    const assistantId = webhookData.call?.assistantId || webhookData.assistantId || payload.assistantId
    const phoneNumberId = webhookData.call?.phoneNumberId || webhookData.phoneNumberId || payload.phoneNumberId

    if (!vapiCallId) {
      console.error("⚠️ Webhook missing call ID:", payload)
      return NextResponse.json({ error: "Missing call ID" }, { status: 400 })
    }

    // Find the call in our database by VAPI call ID (primary method - globally unique)
    let call = await prisma.call.findFirst({
      where: {
        callId: vapiCallId
      }
    })

    if (!call) {
      console.log(`⚠️ Webhook received for unknown call: ${vapiCallId}`)
      console.log(`🔍 Searching for call with callId: ${vapiCallId}`)
      
      // Try to identify tenant from assistantId or phoneNumberId
      let tenantId: string | null = null
      if (assistantId) {
        const assistant = await prisma.assistant.findUnique({
          where: { id: assistantId },
          select: { tenantId: true }
        })
        if (assistant?.tenantId) {
          tenantId = assistant.tenantId
          console.log(`🔍 Identified tenant from assistantId: ${tenantId}`)
        }
      }
      
      if (!tenantId && phoneNumberId) {
        const phoneNumberRecord = await prisma.phoneNumber.findUnique({
          where: { id: phoneNumberId },
          select: { tenantId: true }
        })
        if (phoneNumberRecord?.tenantId) {
          tenantId = phoneNumberRecord.tenantId
          console.log(`🔍 Identified tenant from phoneNumberId: ${tenantId}`)
        }
      }
      
      // Extract customer phone number for matching (available for both inbound and outbound)
      const phoneNumber = webhookData.call?.customer?.number || webhookData.customer?.number
      
      // Try to find by contact phone and recent timestamp as fallback
      // Now with tenantId filtering to prevent cross-tenant matches
      if (phoneNumber) {
        const phoneDigits = phoneNumber.replace(/\D/g, "")
        const last10Digits = phoneDigits.slice(-10)
        
        const fallbackWhere: any = {
          OR: [
            { contactPhone: { contains: last10Digits } },
            { contactPhone: { contains: phoneDigits } }
          ],
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          status: {
            in: ["calling", "in_progress", "scheduled"]
          }
        }
        
        // Add tenantId filter if we identified it
        if (tenantId) {
          fallbackWhere.tenantId = tenantId
        }
        
        // Also try matching by assistantId or phoneNumberId if available
        if (assistantId) {
          fallbackWhere.assistantId = assistantId
        } else if (phoneNumberId) {
          fallbackWhere.phoneNumberId = phoneNumberId
        }
        
        const fallbackCall = await prisma.call.findFirst({
          where: fallbackWhere,
          orderBy: {
            timestamp: "desc"
          }
        })
        
        if (fallbackCall) {
          console.log(`✅ Found call by fallback (tenantId: ${fallbackCall.tenantId || 'unknown'}): ${fallbackCall.id}`)
          // Update the call with the VAPI callId for future webhooks
          await prisma.call.update({
            where: { id: fallbackCall.id },
            data: { callId: vapiCallId }
          })
          // Re-fetch the call with updated callId
          call = await prisma.call.findUnique({
            where: { id: fallbackCall.id }
          })
        }
      }
      
      // If still no call found, this might be an inbound call (contact calling back)
      // Create a new call record for inbound calls
      if (!call && tenantId && phoneNumber) {
        console.log(`📞 Creating call record for inbound call: ${vapiCallId}`)
        
        const phoneDigits = phoneNumber.replace(/\D/g, "")
        const last10Digits = phoneDigits.slice(-10)
        
        // Try to find the contact by phone number within this tenant
        let contactId: string | null = null
        let contactName: string | null = null
        
        const contact = await prisma.contact.findFirst({
          where: {
            tenantId,
            phone: {
              contains: last10Digits
            }
          }
        })
        
        if (contact) {
          contactId = contact.id
          contactName = contact.firstName && contact.lastName
            ? `${contact.firstName} ${contact.lastName}`.trim()
            : contact.firstName || contact.lastName || phoneNumber
        } else {
          // Use phone number as name if contact not found
          contactName = phoneNumber
        }
        
        // Create inbound call record
        call = await prisma.call.create({
          data: {
            tenantId,
            contactId,
            contactName: contactName || phoneNumber,
            contactPhone: phoneNumber,
            callId: vapiCallId,
            assistantId: assistantId || null,
            phoneNumberId: phoneNumberId || null,
            status: "calling",
            message: "Inbound call from contact",
            timestamp: new Date()
          }
        })
        
        console.log(`✅ Created inbound call record: ${call.id} for contact: ${contactName || phoneNumber}`)
      }
      
      if (!call) {
        console.log(`❌ Could not find or create call for VAPI callId: ${vapiCallId}`)
        return NextResponse.json({ success: true, message: "Call not found in database and unable to create inbound call record" })
      }
    }

    // Map VAPI status to our status
    let mappedStatus = call.status
    let finalCallOutcome = callOutcome || call.callOutcome

    switch (status) {
      case "queued":
      case "ringing":
        mappedStatus = "calling"
        break
      case "in-progress":
        mappedStatus = "in_progress"
        break
      case "ended":
        mappedStatus = "completed"
        // Use CallOutcome from structured data (preserve original format: voicemail, interested, callback, not_interested, etc.)
        if (callOutcome) {
          finalCallOutcome = callOutcome // Keep original format (lowercase with underscores)
        } else if (endedReason) {
          // Fallback to endedReason if CallOutcome not available
          const reasonLower = endedReason.toLowerCase()
          if (reasonLower.includes("voicemail")) {
            finalCallOutcome = "voicemail"
          } else if (reasonLower.includes("no-answer") || reasonLower.includes("busy")) {
            finalCallOutcome = "no_answer"
          } else if (reasonLower.includes("failed")) {
            finalCallOutcome = "failed"
          } else {
            finalCallOutcome = "completed"
          }
        }
        break
      case "failed":
        mappedStatus = "failed"
        finalCallOutcome = "FAILED"
        break
    }

    // Update call record
    const updateData: any = {
      status: mappedStatus,
      timestamp: new Date()
    }

    if (finalCallOutcome) updateData.callOutcome = finalCallOutcome
    if (endedReason) updateData.endedReason = endedReason
    if (recordingUrl) updateData.recordingUrl = recordingUrl
    if (summary) updateData.summary = summary
    if (duration !== undefined) updateData.duration = duration
    if (cost !== undefined) updateData.cost = cost

    // Store structured data and transcript
    if (transcript || structuredData) {
      updateData.structuredData = {
        transcript: transcript || null,
        ...(structuredData && typeof structuredData === 'object' ? structuredData : {}), // Store all structured data
        ...(call.structuredData && typeof call.structuredData === 'object' ? call.structuredData : {}) // Preserve existing data
      }
    } else if (transcript) {
      // If only transcript is available, store it
      updateData.structuredData = {
        transcript,
        ...(call.structuredData && typeof call.structuredData === 'object' ? call.structuredData : {})
      }
    }

    await prisma.call.update({
      where: { id: call.id },
      data: updateData
    })

    console.log(`✅ Updated call ${call.id} (VAPI: ${vapiCallId}): ${mappedStatus}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error processing VAPI webhook:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}

