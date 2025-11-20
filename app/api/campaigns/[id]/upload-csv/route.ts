import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// CSV parser - improved implementation with proper CSV handling
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

async function parseCSV(fileBuffer: Buffer): Promise<Array<{ name: string; phone: string; address?: string }>> {
  const contacts: Array<{ name: string; phone: string; address?: string }> = []
  const text = fileBuffer.toString("utf-8")
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length === 0) return contacts

  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim())
  const nameIndex = header.findIndex(h => /^name$/i.test(h.trim()))
  const phoneIndex = header.findIndex(h => /phone/i.test(h.trim()))
  const addressIndex = header.findIndex(h => /address/i.test(h.trim()))

  if (phoneIndex === -1) {
    throw new Error("CSV file must contain a 'Phone' column")
  }

  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, "").trim())
    
    if (values.length > phoneIndex && values[phoneIndex]) {
      contacts.push({
        name: nameIndex >= 0 && values[nameIndex] ? values[nameIndex] : "",
        phone: values[phoneIndex],
        address: addressIndex >= 0 && values[addressIndex] ? values[addressIndex] : undefined
      })
    }
  }

  return contacts
}

// Helper function to format phone number (simple version)
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "")
  
  // If it starts with 1 and has 11 digits, keep as is
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`
  }
  
  // If it has 10 digits, assume US number and add +1
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`
  }
  
  // Otherwise, add + if not present
  if (!phone.startsWith("+")) {
    return `+${digitsOnly}`
  }
  
  return phone
}

// POST /api/campaigns/[id]/upload-csv - Upload CSV and create calls for campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = await params
    const tenantId = await getTenantId()
    const tenantFilter = await getTenantFilter()

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    // Verify campaign exists and belongs to tenant
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ...tenantFilter,
        deletedAt: null
      },
      include: {
        assistant: true,
        phoneNumber: true
      }
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV file" },
        { status: 400 }
      )
    }

    // Parse CSV file
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    let contacts: Array<{ name: string; phone: string; address?: string }> = []

    try {
      const rawContacts = await parseCSV(fileBuffer)
      
      // Process and validate contacts
      for (const contact of rawContacts) {
        if (contact.phone && contact.phone.trim()) {
          contacts.push({
            name: contact.name.trim(),
            phone: formatPhoneNumber(contact.phone.trim()),
            address: contact.address?.trim() || undefined
          })
        }
      }
    } catch (parseError: any) {
      console.error("CSV parsing error:", parseError)
      return NextResponse.json(
        { error: `Failed to parse CSV: ${parseError.message}` },
        { status: 400 }
      )
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No valid contacts found in CSV file" },
        { status: 400 }
      )
    }

    // Create or update contacts and create call records
    const createdCalls = []
    const errors = []

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      
      try {
        // Find or create contact
        let contactRecord = await prisma.contact.findFirst({
          where: {
            tenantId: tenantId as string,
            phone: contact.phone
          }
        })

        if (!contactRecord) {
          // Parse name into first and last name if possible
          const nameParts = contact.name.split(" ").filter(Boolean)
          const firstName = nameParts.length > 0 ? nameParts[0] : null
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null

          contactRecord = await prisma.contact.create({
            data: {
              tenantId: tenantId as string,
              firstName,
              lastName,
              phone: contact.phone,
              address: contact.address || null,
              leadSource: "CSV Import"
            }
          })
        }

        // Calculate scheduled time based on campaign configuration
        // For now, schedule immediately (the scheduler will handle frequency)
        let scheduledTime = new Date()
        
        // If campaign has start/end times, schedule within that window
        if (campaign.startTime && campaign.endTime) {
          const now = new Date()
          const tz = campaign.timeZone || "UTC"
          const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }))
          
          // Parse start time
          const [startHour, startMin] = campaign.startTime.split(":").map(Number)
          const startDateTime = new Date(nowInTz)
          startDateTime.setHours(startHour, startMin, 0, 0)
          
          // If start time hasn't passed today, use it
          if (startDateTime > nowInTz) {
            scheduledTime = startDateTime
          } else {
            // Otherwise schedule for start time today or tomorrow
            if (nowInTz.getHours() * 60 + nowInTz.getMinutes() >= startHour * 60 + startMin) {
              // Start time has passed, schedule for tomorrow
              startDateTime.setDate(startDateTime.getDate() + 1)
            }
            scheduledTime = startDateTime
          }
        }

        // Create call record
        const call = await prisma.call.create({
          data: {
            tenantId: tenantId as string,
            campaignId: campaignId,
            contactName: contact.name || contactRecord.firstName && contactRecord.lastName
              ? `${contactRecord.firstName} ${contactRecord.lastName}`.trim()
              : contactRecord.firstName || contactRecord.lastName || contact.phone,
            contactPhone: contact.phone,
            contactAddress: contact.address || contactRecord.address || null,
            contactId: contactRecord.id,
            status: "scheduled",
            scheduledTime: scheduledTime,
            assistantId: campaign.assistantId,
            phoneNumberId: campaign.phoneNumberId,
            indexPosition: i,
            message: "Added via CSV upload"
          }
        })

        createdCalls.push(call)
      } catch (error: any) {
        errors.push({
          contact: contact.name || contact.phone,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${createdCalls.length} contacts`,
      totalContacts: contacts.length,
      createdCalls: createdCalls.length,
      errors: errors.length > 0 ? errors : undefined,
      campaignId: campaignId
    })
  } catch (error: any) {
    console.error("Error uploading CSV:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process CSV file" },
      { status: 500 }
    )
  }
}

