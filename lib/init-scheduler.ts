/**
 * Server-side scheduler initialization
 * 
 * This file is imported only on the server side to start the scheduler.
 * Import this in your app initialization code.
 */

import { initializeScheduler } from "./scheduler"

// Only run in production or when explicitly enabled
const shouldRun = 
  process.env.NODE_ENV === "production" || 
  process.env.ENABLE_IN_APP_SCHEDULER === "true"

if (shouldRun) {
  // Initialize scheduler after a short delay to ensure app is ready
  setTimeout(() => {
    initializeScheduler()
  }, 2000) // 2 second delay
}

