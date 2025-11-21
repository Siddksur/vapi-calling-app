/**
 * VAPI Status Checker
 * 
 * Fallback mechanism to check call status directly from VAPI API
 * if webhooks aren't working or calls are stuck in "calling" status
 */

import axios from "axios"
import { prisma } from "./prisma"
import { getVAPIConfig } from "./vapi"

/**
 * Check status of a single call from VAPI API
 */
export async function checkVAPICallStatus(vapiCallId: string, tenantId: string) {
  try {
    const config = await getVAPIConfig(tenantId)
    if (!config) {
      return { error: "VAPI configuration not found" }
    }

    const response = await axios.get(`${config.baseUrl}/call/${vapiCallId}`, {
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json"
      }
    })

    return { success: true, data: response.data }
  } catch (error: any) {
    return {
      error: error.response?.data?.message || error.message || "Unknown error"
    }
  }
}

/**
 * Update stuck calls by checking their status from VAPI
 * Finds calls stuck in "calling" or "in_progress" status for more than 5 minutes
 */
export async function updateStuckCalls() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    // Find calls stuck in "calling" or "in_progress" status
    // Check calls older than 2 minutes (reduced from 5 minutes for faster updates)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    const stuckCalls = await prisma.call.findMany({
      where: {
        status: {
          in: ["calling", "in_progress"]
        },
        timestamp: {
          lte: twoMinutesAgo // Stuck for more than 2 minutes
        },
        callId: {
          not: null // Must have VAPI call ID
        }
      },
      include: {
        campaign: {
          include: {
            tenant: true
          }
        }
      },
      take: 50 // Limit to prevent overload
    })

    console.log(`🔍 Found ${stuckCalls.length} stuck calls (older than 2 minutes), checking status from VAPI...`)

    for (const call of stuckCalls) {
      if (!call.callId) {
        continue
      }

      // Get tenantId from campaign or directly from call
      const tenantId = call.campaign?.tenantId || call.tenantId
      if (!tenantId) {
        console.error(`⚠️ Call ${call.id} has no tenantId`)
        continue
      }

      try {
        const statusCheck = await checkVAPICallStatus(call.callId, tenantId)

        if (statusCheck.error) {
          console.error(`❌ Error checking call ${call.callId}:`, statusCheck.error)
          continue
        }

        const vapiData = statusCheck.data
        const vapiStatus = vapiData.status

        // Map VAPI status to our status
        let mappedStatus = call.status
        let callOutcome = call.callOutcome

        // Extract call outcome from structured data if available
        const structuredData = vapiData.analysis?.structuredData || vapiData.structuredData
        const callOutcomeFromData = structuredData?.CallOutcome

        switch (vapiStatus) {
          case "queued":
          case "ringing":
            mappedStatus = "calling"
            break
          case "in-progress":
            mappedStatus = "in_progress"
            break
          case "ended":
            mappedStatus = "completed"
            const endedReason = vapiData.endedReason
            // Use callOutcome from structured data (preserve original format: voicemail, interested, callback, etc.)
            if (callOutcomeFromData) {
              callOutcome = callOutcomeFromData // Keep original format (lowercase with underscores)
            } else if (endedReason) {
              // Fallback to endedReason if CallOutcome not available
              const reasonLower = endedReason.toLowerCase()
              if (reasonLower.includes("voicemail")) {
                callOutcome = "voicemail"
              } else if (reasonLower.includes("no-answer") || reasonLower.includes("busy")) {
                callOutcome = "no_answer"
              } else if (reasonLower.includes("failed")) {
                callOutcome = "failed"
              } else {
                callOutcome = "completed"
              }
            }
            break
          case "failed":
            mappedStatus = "failed"
            callOutcome = "FAILED"
            break
        }

        // Update call record
        const updateData: any = {
          status: mappedStatus,
          timestamp: new Date()
        }

        if (callOutcome) updateData.callOutcome = callOutcome
        if (vapiData.endedReason) updateData.endedReason = vapiData.endedReason
        if (vapiData.recording?.url) updateData.recordingUrl = vapiData.recording.url
        if (vapiData.analysis?.summary || vapiData.summary) {
          updateData.summary = vapiData.analysis?.summary || vapiData.summary
        }
        if (vapiData.durationSeconds !== undefined) {
          updateData.duration = vapiData.durationSeconds
        } else if (vapiData.duration !== undefined) {
          updateData.duration = vapiData.duration
        }
        if (vapiData.cost !== undefined) updateData.cost = vapiData.cost

        // Store structured data if available
        if (structuredData || vapiData.transcript) {
          updateData.structuredData = {
            transcript: vapiData.transcript || null,
            ...(structuredData && typeof structuredData === 'object' ? structuredData : {}),
            ...(call.structuredData && typeof call.structuredData === 'object' ? call.structuredData : {})
          }
        }

        await prisma.call.update({
          where: { id: call.id },
          data: updateData
        })

        console.log(`✅ Updated stuck call ${call.id} (VAPI: ${call.callId}): ${mappedStatus}`)
      } catch (error: any) {
        console.error(`❌ Error updating call ${call.id}:`, error.message)
      }
    }

    return { updated: stuckCalls.length }
  } catch (error: any) {
    console.error("Error updating stuck calls:", error)
    return { error: error.message }
  }
}

