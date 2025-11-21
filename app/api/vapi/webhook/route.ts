import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * VAPI Webhook handler for call status updates
 * VAPI will POST to this endpoint when call status changes
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    // Log webhook received for debugging
    console.log("📥 VAPI webhook received:", JSON.stringify(payload, null, 2))

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




