import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

// GET /api/contacts/[id] - Get single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const tenantFilter = await getTenantFilter()

    const contact = await prisma.contact.findFirst({
      where: {
        id: id,
        ...tenantFilter
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        calls: {
          orderBy: { timestamp: "desc" },
          take: 10,
          include: {
            campaign: {
              select: { name: true }
            }
          }
        },
        _count: {
          select: { calls: true }
        }
      }
    })

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json({
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        notes: contact.notes,
        leadSource: contact.leadSource,
        tags: contact.tags.map(ct => ({
          id: ct.tag.id,
          name: ct.tag.name,
          color: ct.tag.color
        })),
        calls: contact.calls.map(call => ({
          id: call.id,
          status: call.status,
          callOutcome: call.callOutcome,
          duration: call.duration,
          timestamp: call.timestamp,
          campaign: call.campaign?.name || null
        })),
        callCount: contact._count.calls,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      }
    })
  } catch (error: any) {
    console.error("Error fetching contact:", error)
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    )
  }
}

// PUT /api/contacts/[id] - Update contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const tenantFilter = await getTenantFilter()

    // Verify contact exists and belongs to tenant
    const existing = await prisma.contact.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const body = await request.json()
    const { firstName, lastName, email, phone, address, notes, leadSource, tagIds } = body

    // If phone is being updated, check for duplicates
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.contact.findFirst({
        where: {
          ...tenantFilter,
          phone: phone,
          id: { not: id }
        }
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Contact with this phone number already exists" },
          { status: 400 }
        )
      }
    }

    // Update contact and tags
    const contact = await prisma.contact.update({
      where: { id: id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || existing.phone,
        address: address || null,
        notes: notes || null,
        leadSource: leadSource || null,
        tags: tagIds ? {
          deleteMany: {},
          create: tagIds.map((tagId: string) => ({
            tagId: tagId
          }))
        } : undefined
      },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    })

    return NextResponse.json({
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        notes: contact.notes,
        leadSource: contact.leadSource,
        tags: contact.tags.map(ct => ({
          id: ct.tag.id,
          name: ct.tag.name,
          color: ct.tag.color
        })),
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      }
    })
  } catch (error: any) {
    console.error("Error updating contact:", error)
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    )
  }
}

// DELETE /api/contacts/[id] - Delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const tenantFilter = await getTenantFilter()

    // Verify contact exists and belongs to tenant
    const existing = await prisma.contact.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await prisma.contact.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting contact:", error)
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    )
  }
}

