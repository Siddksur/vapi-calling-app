/**
 * Standalone script to process scheduled calls
 * Can be run as a cron job or background service
 * 
 * Usage:
 *   npx tsx scripts/call-processor.ts
 * 
 * Or add to cron:
 *   * * * * * cd /path/to/app && npx tsx scripts/call-processor.ts
 */

import "dotenv/config"
import { processScheduledCalls } from "../lib/call-scheduler"

async function main() {
  console.log(`[${new Date().toISOString()}] Starting call processor...`)
  
  try {
    await processScheduledCalls()
    console.log(`[${new Date().toISOString()}] Call processor completed`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in call processor:`, error)
    process.exit(1)
  }
  
  process.exit(0)
}

main()




