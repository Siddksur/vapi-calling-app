import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantId } from "@/lib/tenant"
import { makeVAPICall } from "@/lib/vapi"

// POST /api/calls/manual - Create and initiate a manual call
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

    const body = await request.json()
    const {
      contactId,
      contactName,
      contactPhone,
      contactAddress,
      contactEmail,
      assistantId,
      phoneNumberId
    } = body

    if (!assistantId || !phoneNumberId || !contactPhone) {
      return NextResponse.json(
        { error: "Assistant, phone number, and contact phone are required" },
        { status: 400 }
      )
    }

    // Verify assistant and phone number belong to tenant
    const [assistant, phoneNumber] = await Promise.all([
      prisma.assistant.findFirst({
        where: { id: assistantId, tenantId }
      }),
      prisma.phoneNumber.findFirst({
        where: { id: phoneNumberId, tenantId }
      })
    ])

    if (!assistant || !assistant.isActive) {
      return NextResponse.json(
        { error: "Selected assistant is not available" },
        { status: 400 }
      )
    }

    if (!phoneNumber || !phoneNumber.isActive) {
      return NextResponse.json(
        { error: "Selected phone number is not available" },
        { status: 400 }
      )
    }

    // Verify contact exists and belongs to tenant (if contactId provided)
    let finalContactEmail = contactEmail || null
    if (contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          tenantId
        }
      })

      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        )
      }
      
      // Use contact's email if not provided in request
      if (!finalContactEmail && contact.email) {
        finalContactEmail = contact.email
      }
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        tenantId,
        contactId: contactId || null,
        contactName: contactName || contactPhone,
        contactPhone,
        contactAddress: contactAddress || null,
        assistantId,
        phoneNumberId,
        status: "scheduled",
        scheduledTime: new Date(),
        message: "Manual call initiated by user"
      }
    })

    // Immediately initiate the VAPI call
    const vapiResult = await makeVAPICall({
      tenantId,
      contact: {
        name: contactName || contactPhone,
        phone: contactPhone,
        address: contactAddress || null,
        email: finalContactEmail || null
      },
      assistantId,
      phoneNumberId,
      callId: call.id
    })

    if (!vapiResult.success) {
      // Update call status to failed
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: "failed",
          message: `Failed to initiate call: ${vapiResult.error}`
        }
      })

      return NextResponse.json(
        { error: vapiResult.error || "Failed to initiate call" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        callId: vapiResult.callId,
        status: "calling"
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating manual call:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create manual call" },
      { status: 500 }
    )
  }
}



