/**
 * Scheduler Initialization API Route
 * 
 * This route initializes the in-app scheduler.
 * The scheduler auto-initializes when this module loads (on first API call).
 * 
 * This ensures the scheduler runs in Node.js runtime, not edge runtime.
 */

import { NextResponse } from "next/server"
import { initializeScheduler } from "@/lib/scheduler"

// Ensure this runs in Node.js runtime (not edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Initialize scheduler when this module loads (only in Node.js runtime)
// This happens on first API call to any route that imports this
if (typeof window === "undefined") {
  // Lazy initialization - will only run once due to guard in initializeScheduler
  setImmediate(() => {
    initializeScheduler()
  })
}

export async function POST() {
  try {
    // Initialize the scheduler (idempotent - safe to call multiple times)
    initializeScheduler()
    
    return NextResponse.json({
      success: true,
      message: "Scheduler initialized",
    })
  } catch (error: any) {
    console.error("Error initializing scheduler:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initialize scheduler",
      },
      { status: 500 }
    )
  }
}

// Also support GET for easier testing
export async function GET() {
  return POST()
}

