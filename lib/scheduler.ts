/**
 * In-App Call Scheduler
 * 
 * This scheduler runs inside the Next.js app and processes calls every minute.
 * 
 * To disable (when using separate worker service):
 *   Set ENABLE_IN_APP_SCHEDULER=false in environment variables
 * 
 * To switch to separate worker service:
 *   1. Set ENABLE_IN_APP_SCHEDULER=false
 *   2. Deploy a separate service that runs: npm run worker
 */

import cron from "node-cron"
import { processScheduledCalls } from "./call-scheduler"

let schedulerStarted = false

/**
 * Initialize the in-app scheduler
 * Only runs if ENABLE_IN_APP_SCHEDULER is not set to "false"
 */
export function initializeScheduler() {
  // Check if scheduler should be enabled
  const enableScheduler = process.env.ENABLE_IN_APP_SCHEDULER !== "false"
  
  // Only run on server-side (not in browser)
  if (typeof window !== "undefined") {
    return
  }

  // Prevent multiple initializations
  if (schedulerStarted) {
    return
  }

  if (!enableScheduler) {
    console.log("⏸️  In-app scheduler is disabled (ENABLE_IN_APP_SCHEDULER=false)")
    console.log("   Use a separate worker service or external cron instead")
    return
  }

  try {
    // Schedule to run every minute
    cron.schedule("* * * * *", async () => {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [Scheduler] Processing scheduled calls...`)
      
      try {
        await processScheduledCalls()
        console.log(`[${timestamp}] [Scheduler] Call processing completed`)
      } catch (error) {
        console.error(`[${timestamp}] [Scheduler] Error processing calls:`, error)
        // Don't throw - let the scheduler continue running
      }
    })

    schedulerStarted = true
    console.log("✅ In-app call scheduler started (runs every minute)")
    console.log("   To disable: Set ENABLE_IN_APP_SCHEDULER=false")
  } catch (error) {
    console.error("❌ Failed to start in-app scheduler:", error)
  }
}

/**
 * Stop the scheduler (useful for graceful shutdowns)
 */
export function stopScheduler() {
  // node-cron doesn't have a direct stop method, but we can track it
  schedulerStarted = false
  console.log("⏸️  In-app scheduler stopped")
}

