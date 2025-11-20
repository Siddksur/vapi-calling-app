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
    const metadata = webhookData.analysis?.structuredData || webhookData.metadata || payload.metadata || {}
    const callOutcome = webhookData.analysis?.structuredData?.CallOutcome || metadata?.CallOutcome

    if (!vapiCallId) {
      console.error("⚠️ Webhook missing call ID:", payload)
      return NextResponse.json({ error: "Missing call ID" }, { status: 400 })
    }

    // Find the call in our database by VAPI call ID
    const call = await prisma.call.findFirst({
      where: {
        callId: vapiCallId
      }
    })

    if (!call) {
      console.log(`⚠️ Webhook received for unknown call: ${vapiCallId}`)
      return NextResponse.json({ success: true, message: "Call not found in database" })
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
        // Determine outcome based on callOutcome from structured data, or endedReason
        if (callOutcome) {
          finalCallOutcome = callOutcome.toUpperCase()
        } else if (endedReason) {
          const reasonLower = endedReason.toLowerCase()
          if (reasonLower.includes("success") || reasonLower.includes("completed")) {
            finalCallOutcome = "SUCCESS"
          } else if (reasonLower.includes("no-answer") || reasonLower.includes("busy")) {
            finalCallOutcome = "NO_ANSWER"
          } else if (reasonLower.includes("voicemail")) {
            finalCallOutcome = "VOICEMAIL"
          } else if (reasonLower.includes("failed")) {
            finalCallOutcome = "FAILED"
          } else {
            finalCallOutcome = "COMPLETED"
          }
        } else {
          finalCallOutcome = "COMPLETED"
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

    // Store structured data if available
    if (transcript || metadata) {
      updateData.structuredData = {
        transcript,
        ...(metadata && typeof metadata === 'object' ? metadata : {}), // Use metadata directly (it's already structured data)
        ...(call.structuredData && typeof call.structuredData === 'object' ? call.structuredData : {}) // Preserve existing data
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

