import { NextRequest, NextResponse } from "next/server"
import { processScheduledCalls } from "@/lib/call-scheduler"
import { initializeScheduler } from "@/lib/scheduler"

// Ensure this runs in Node.js runtime (not edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Cron job endpoint to process scheduled calls
 * Should be called periodically (every minute) by a cron service
 * 
 * Security: In production, you should add authentication/authorization
 * e.g., check for a secret token in headers
 */
export async function GET(request: NextRequest) {
  // Initialize scheduler on first API call (ensures it runs in Node.js runtime)
  // This ensures scheduler starts even if no users visit the site
  initializeScheduler()
  
  try {
    // Optional: Add authentication
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Process scheduled calls
    await processScheduledCalls()

    return NextResponse.json({
      success: true,
      message: "Call processing completed",
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error in call processing cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process calls"
      },
      { status: 500 }
    )
  }
}

// Also support POST for cron services that prefer POST
export async function POST(request: NextRequest) {
  return GET(request)
}
