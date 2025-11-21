import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantId } from "@/lib/tenant"

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

// Helper function to format phone number
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

// POST /api/contacts/import-csv - Import contacts from CSV with column mapping
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = await getTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const mappingJson = formData.get("mapping") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    if (!mappingJson) {
      return NextResponse.json(
        { error: "Column mapping is required" },
        { status: 400 }
      )
    }

    const mapping = JSON.parse(mappingJson) as {
      firstName: string
      lastName: string
      phone: string
      email: string
      address: string
    }

    if (!mapping.phone) {
      return NextResponse.json(
        { error: "Phone column mapping is required" },
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
    const text = fileBuffer.toString("utf-8")
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    
    if (lines.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      )
    }

    // Parse header
    const header = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim())
    
    // Find column indices based on mapping
    const firstNameIndex = mapping.firstName ? header.indexOf(mapping.firstName) : -1
    const lastNameIndex = mapping.lastName ? header.indexOf(mapping.lastName) : -1
    const phoneIndex = header.indexOf(mapping.phone)
    const emailIndex = mapping.email ? header.indexOf(mapping.email) : -1
    const addressIndex = mapping.address ? header.indexOf(mapping.address) : -1

    if (phoneIndex === -1) {
      return NextResponse.json(
        { error: `Phone column "${mapping.phone}" not found in CSV` },
        { status: 400 }
      )
    }

    // Parse rows and create contacts
    const contacts: Array<{
      firstName: string | null
      lastName: string | null
      phone: string
      email: string | null
      address: string | null
    }> = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, "").trim())
      
      if (values.length > phoneIndex && values[phoneIndex]) {
        const phone = formatPhoneNumber(values[phoneIndex])
        
        // Handle name field - if firstName is mapped to a "name" column, split it
        let firstName: string | null = null
        let lastName: string | null = null
        
        if (firstNameIndex >= 0 && values[firstNameIndex]) {
          if (lastNameIndex >= 0 && values[lastNameIndex]) {
            // Both first and last name columns exist
            firstName = values[firstNameIndex] || null
            lastName = values[lastNameIndex] || null
          } else {
            // Only firstName column exists - check if it contains full name
            const nameValue = values[firstNameIndex]
            const nameParts = nameValue.split(" ").filter(Boolean)
            if (nameParts.length > 1) {
              firstName = nameParts[0]
              lastName = nameParts.slice(1).join(" ")
            } else {
              firstName = nameValue
            }
          }
        }

        contacts.push({
          firstName,
          lastName,
          phone,
          email: emailIndex >= 0 && values[emailIndex] ? values[emailIndex] : null,
          address: addressIndex >= 0 && values[addressIndex] ? values[addressIndex] : null
        })
      }
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No valid contacts found in CSV file" },
        { status: 400 }
      )
    }

    // Import contacts (create or update)
    let imported = 0
    let updated = 0
    let errors = 0
    const errorMessages: string[] = []

    for (const contact of contacts) {
      try {
        // Check if contact exists
        const existing = await prisma.contact.findFirst({
          where: {
            tenantId: tenantId as string,
            phone: contact.phone
          }
        })

        if (existing) {
          // Update existing contact
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName: contact.firstName || existing.firstName,
              lastName: contact.lastName || existing.lastName,
              email: contact.email || existing.email,
              address: contact.address || existing.address,
              leadSource: existing.leadSource || "CSV Import"
            }
          })
          updated++
        } else {
          // Create new contact
          await prisma.contact.create({
            data: {
              tenantId: tenantId as string,
              firstName: contact.firstName,
              lastName: contact.lastName,
              phone: contact.phone,
              email: contact.email,
              address: contact.address,
              leadSource: "CSV Import"
            }
          })
          imported++
        }
      } catch (error: any) {
        errors++
        errorMessages.push(`Failed to import ${contact.phone}: ${error.message}`)
        console.error(`Error importing contact ${contact.phone}:`, error)
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${imported} contacts${updated > 0 ? ` and updated ${updated} existing contacts` : ""}`,
      imported,
      updated,
      errors,
      total: contacts.length,
      errorMessages: errors > 0 ? errorMessages.slice(0, 10) : [] // Limit error messages
    })
  } catch (error: any) {
    console.error("Error importing CSV:", error)
    return NextResponse.json(
      { error: `Failed to import CSV: ${error.message}` },
      { status: 500 }
    )
  }
}

