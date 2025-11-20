/**
 * Standalone Worker Service
 * 
 * This script runs continuously and processes calls every minute.
 * Use this when you want to run the scheduler as a separate service.
 * 
 * Usage:
 *   npm run worker
 * 
 * Or in Railway/other platforms:
 *   Start Command: npm run worker
 *   (Don't set a cron schedule - this runs continuously)
 * 
 * Environment Variables:
 *   - Set ENABLE_IN_APP_SCHEDULER=false in your main app
 *   - Copy all env vars from main app to worker service
 */

import "dotenv/config"
import cron from "node-cron"
import { processScheduledCalls } from "../lib/call-scheduler"

console.log("🚀 Starting call processor worker service...")
console.log("   This service runs continuously and processes calls every minute")
console.log("   Press Ctrl+C to stop")

// Process calls every minute
cron.schedule("* * * * *", async () => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] Processing scheduled calls...`)
  
  try {
    await processScheduledCalls()
    console.log(`[${timestamp}] Call processing completed`)
  } catch (error) {
    console.error(`[${timestamp}] Error processing calls:`, error)
  }
})

// Keep the process alive
process.on("SIGINT", () => {
  console.log("\n⏸️  Shutting down worker service...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("\n⏸️  Shutting down worker service...")
  process.exit(0)
})

// Log that we're running
console.log("✅ Worker service started - processing calls every minute")

