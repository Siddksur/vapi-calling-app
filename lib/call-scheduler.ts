import { prisma } from "./prisma"
import { makeVAPICall } from "./vapi"
import { updateStuckCalls } from "./vapi-status-checker"

/**
 * Check if a date/time falls within the campaign's time window (startTime - endTime)
 * considering the campaign's timezone
 */
function isWithinTimeWindow(
  now: Date,
  startTime: string | null,
  endTime: string | null,
  timeZone: string | null
): boolean {
  if (!startTime || !endTime) {
    return true // No time restrictions
  }

  // Get current time in campaign's timezone
  const tz = timeZone || "UTC"
  const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }))

  // Parse start and end times (HH:mm format)
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)

  const currentHour = nowInTz.getHours()
  const currentMin = nowInTz.getMinutes()
  const currentTimeMinutes = currentHour * 60 + currentMin
  const startTimeMinutes = startHour * 60 + startMin
  const endTimeMinutes = endHour * 60 + endMin

  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes
}

/**
 * Check if today is a scheduled day for the campaign (for weekly campaigns)
 */
function isScheduledDay(now: Date, scheduleDays: number[], timeZone: string | null): boolean {
  if (scheduleDays.length === 0) {
    return true // No day restrictions
  }

  // Get current day of week in campaign's timezone (0 = Sunday, 6 = Saturday)
  const tz = timeZone || "UTC"
  const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }))
  const dayOfWeek = nowInTz.getDay()

  return scheduleDays.includes(dayOfWeek)
}

/**
 * Check if a contact has reached the retry attempts limit for a campaign
 */
async function hasReachedRetryLimit(
  campaignId: string,
  contactPhone: string,
  retryAttempts: number | null
): Promise<boolean> {
  if (!retryAttempts || retryAttempts <= 0) {
    return false // No limit set
  }

  // Count completed calls for this contact in this campaign
  const callCount = await prisma.call.count({
    where: {
      campaignId,
      contactPhone,
      status: {
        in: ["completed", "calling", "in_progress"]
      }
    }
  })

  return callCount >= retryAttempts
}

/**
 * Check if a contact should be called based on campaign frequency
 */
async function shouldCallContact(
  campaignId: string,
  contactId: string | null,
  contactPhone: string,
  campaignFrequency: string | null,
  scheduleDays: number[],
  retryAttempts: number | null
): Promise<boolean> {
  // First check if we've reached the retry limit
  if (await hasReachedRetryLimit(campaignId, contactPhone, retryAttempts)) {
    return false
  }

  // IMPORTANT: Check for any active calls (calling/in_progress) first, regardless of timestamp
  // This prevents duplicate calls if a call is already in progress
  const activeCall = await prisma.call.findFirst({
    where: {
      campaignId,
      contactPhone,
      status: {
        in: ["calling", "in_progress"]
      }
    }
  })

  if (activeCall) {
    return false // Don't call if there's already an active call in progress
  }

  if (!campaignFrequency) {
    // No frequency set, check if there's already a call for this contact today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingCall = await prisma.call.findFirst({
      where: {
        campaignId,
        contactPhone,
        OR: [
          // Check by timestamp if set
          {
            timestamp: {
              gte: today,
              lt: tomorrow
            }
          },
          // OR check by createdAt if timestamp is null (for newly created calls)
          {
            createdAt: {
              gte: today,
              lt: tomorrow
            },
            timestamp: null
          }
        ],
        status: {
          in: ["completed", "calling", "in_progress"]
        }
      }
    })

    return !existingCall // Call if no call today
  }

  switch (campaignFrequency.toLowerCase()) {
    case "daily":
      // Check if already called today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const existingDailyCall = await prisma.call.findFirst({
        where: {
          campaignId,
          contactPhone,
          OR: [
            // Check by timestamp if set
            {
              timestamp: {
                gte: today,
                lt: tomorrow
              }
            },
            // OR check by createdAt if timestamp is null (for newly created calls)
            {
              createdAt: {
                gte: today,
                lt: tomorrow
              },
              timestamp: null
            }
          ],
          status: {
            in: ["completed", "calling", "in_progress"]
          }
        }
      })

      return !existingDailyCall // Call if no call today

    case "weekly":
      // Check if already called this week
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0)

      const existingWeeklyCall = await prisma.call.findFirst({
        where: {
          campaignId,
          contactPhone,
          OR: [
            // Check by timestamp if set
            {
              timestamp: {
                gte: weekStart
              }
            },
            // OR check by createdAt if timestamp is null (for newly created calls)
            {
              createdAt: {
                gte: weekStart
              },
              timestamp: null
            }
          ],
          status: {
            in: ["completed", "calling", "in_progress"]
          }
        }
      })

      return !existingWeeklyCall // Call if no call this week

    default:
      // Unknown frequency, default to once per day
      const todayDefault = new Date()
      todayDefault.setHours(0, 0, 0, 0)
      const tomorrowDefault = new Date(todayDefault)
      tomorrowDefault.setDate(tomorrowDefault.getDate() + 1)

      const existingDefaultCall = await prisma.call.findFirst({
        where: {
          campaignId,
          contactPhone,
          OR: [
            // Check by timestamp if set
            {
              timestamp: {
                gte: todayDefault,
                lt: tomorrowDefault
              }
            },
            // OR check by createdAt if timestamp is null (for newly created calls)
            {
              createdAt: {
                gte: todayDefault,
                lt: tomorrowDefault
              },
              timestamp: null
            }
          ],
          status: {
            in: ["completed", "calling", "in_progress"]
          }
        }
      })

      return !existingDefaultCall
  }
}

/**
 * Process scheduled calls and make VAPI calls
 */
export async function processScheduledCalls() {
  const now = new Date()

  try {
    // First, check for stuck calls and update their status from VAPI
    // This handles cases where webhooks didn't fire or were missed
    await updateStuckCalls()
    // Find all active campaigns
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      include: {
        tenant: {
          select: {
            id: true,
            vapiPrivateKey: true,
            vapiOrganizationId: true
          }
        },
        assistant: true,
        phoneNumber: true
      }
    })

    for (const campaign of activeCampaigns) {
      // Skip if campaign doesn't have required VAPI config
      if (!campaign.tenant.vapiPrivateKey) {
        console.log(`⚠️ Campaign ${campaign.id} skipped: No VAPI configuration for tenant`)
        continue
      }

      // For weekly campaigns, check if today is a scheduled day
      if (campaign.scheduleFrequency === "weekly") {
        if (!isScheduledDay(now, campaign.scheduleDays, campaign.timeZone)) {
          continue // Not a scheduled day
        }
      }

      // Find contacts associated with this campaign that need calls
      // Check both scheduled calls and contacts in the CRM
      const contactsToCall: Array<{
        contactId: string | null
        contactName: string
        contactPhone: string
        contactAddress: string | null
        callId?: number
      }> = []

      // Find scheduled calls that are due (allow up to 1 hour grace period past scheduled time)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const scheduledCalls = await prisma.call.findMany({
        where: {
          campaignId: campaign.id,
          status: "scheduled",
          scheduledTime: {
            lte: now,
            gte: oneHourAgo // Don't process calls scheduled more than 1 hour ago (they're too old)
          }
        },
        include: {
          contact: true
        },
        take: 50 // Limit to prevent overload
      })

      // If we have scheduled calls that are due, process them even if slightly outside time window
      // (This handles cases where scheduler runs a few minutes late)
      const hasDueCalls = scheduledCalls.length > 0
      
      // Check time window - but allow processing if we have due calls (within reason)
      const isWithinWindow = isWithinTimeWindow(now, campaign.startTime, campaign.endTime, campaign.timeZone)
      
      // If outside time window AND no due calls, skip this campaign
      if (!isWithinWindow && !hasDueCalls) {
        continue // Outside time window and no calls to process
      }
      
      // If outside time window BUT we have due calls, log a warning but still process them
      if (!isWithinWindow && hasDueCalls) {
        console.log(`⚠️ Campaign ${campaign.id} is outside time window but processing ${scheduledCalls.length} overdue scheduled calls`)
      }

      for (const call of scheduledCalls) {
        // Check if this call should still be made
        const shouldCall = await shouldCallContact(
          campaign.id,
          call.contactId,
          call.contactPhone,
          campaign.scheduleFrequency,
          campaign.scheduleDays,
          campaign.retryAttempts
        )

        if (shouldCall) {
          contactsToCall.push({
            contactId: call.contactId,
            contactName: call.contactName,
            contactPhone: call.contactPhone,
            contactAddress: call.contactAddress,
            callId: call.id
          })
        } else {
          // Update status to skipped
          await prisma.call.update({
            where: { id: call.id },
            data: {
              status: "cancelled",
              message: "Call skipped: Already called according to campaign frequency"
            }
          })
        }
      }

      // Also check for contacts in CRM that might need recurring calls
      // (for daily/weekly frequency campaigns)
      if (campaign.scheduleFrequency && contactsToCall.length < 20) {
        // Find contacts linked to this campaign's calls
        const campaignContacts = await prisma.contact.findMany({
          where: {
            tenantId: campaign.tenantId,
            calls: {
              some: {
                campaignId: campaign.id
              }
            }
          },
          take: 50
        })

        for (const contact of campaignContacts) {
          const shouldCall = await shouldCallContact(
            campaign.id,
            contact.id,
            contact.phone,
            campaign.scheduleFrequency,
            campaign.scheduleDays,
            campaign.retryAttempts
          )

          if (shouldCall && contactsToCall.length < 20) {
            // Check if there's already a scheduled call for today
            const existingCall = await prisma.call.findFirst({
              where: {
                campaignId: campaign.id,
                contactId: contact.id,
                status: "scheduled",
                scheduledTime: {
                  gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
                }
              }
            })

            if (!existingCall) {
              // Create a new call record and add to queue
              const newCall = await prisma.call.create({
                data: {
                  tenantId: campaign.tenantId,
                  campaignId: campaign.id,
                  contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.phone,
                  contactPhone: contact.phone,
                  contactAddress: contact.address,
                  contactId: contact.id,
                  status: "scheduled",
                  scheduledTime: now,
                  assistantId: campaign.assistantId,
                  phoneNumberId: campaign.phoneNumberId,
                  message: "Recurring call based on campaign frequency"
                }
              })

              contactsToCall.push({
                contactId: contact.id,
                contactName: newCall.contactName,
                contactPhone: contact.phone,
                contactAddress: contact.address,
                callId: newCall.id
              })
            }
          }
        }
      }

      // Make calls (limit concurrent calls)
      const maxConcurrent = 10
      let activeCalls = 0

      for (const contact of contactsToCall) {
        // Wait if we're at max concurrent calls
        while (activeCalls >= maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          // Recheck active calls count
          const activeCallCount = await prisma.call.count({
            where: {
              campaignId: campaign.id,
              status: {
                in: ["calling", "in_progress"]
              }
            }
          })
          activeCalls = activeCallCount
        }

        activeCalls++

        // Make the call (don't await to allow concurrent processing)
        makeVAPICall({
          tenantId: campaign.tenantId,
          contact: {
            name: contact.contactName,
            phone: contact.contactPhone,
            address: contact.contactAddress
          },
          assistantId: campaign.assistantId,
          phoneNumberId: campaign.phoneNumberId,
          callId: contact.callId,
          campaignId: campaign.id
        }).finally(() => {
          activeCalls--
        })
      }

      if (contactsToCall.length > 0) {
        console.log(`📞 Processed ${contactsToCall.length} calls for campaign ${campaign.name || campaign.id}`)
      }
    }
  } catch (error) {
    console.error("❌ Error processing scheduled calls:", error)
  }
}

