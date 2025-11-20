/**
 * Health Check Endpoint
 * 
 * Railway and other platforms use this to check if the app is running.
 * This also ensures the scheduler initializes on server start.
 */

import { NextResponse } from "next/server"
import { initializeScheduler } from "@/lib/scheduler"

// Ensure this runs in Node.js runtime (not edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Initialize scheduler when this module loads (ensures it starts on server startup)
if (typeof window === "undefined") {
  setImmediate(() => {
    initializeScheduler()
  })
}

export async function GET() {
  // Also initialize scheduler on health check (idempotent)
  initializeScheduler()
  
  return NextResponse.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString()
  })
}

