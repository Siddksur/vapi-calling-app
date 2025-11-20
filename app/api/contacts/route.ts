import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/contacts - List contacts with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const leadSource = searchParams.get("leadSource") || ""
    const tagId = searchParams.get("tagId") || ""
    
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      ...tenantFilter,
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    if (leadSource) {
      where.leadSource = leadSource
    }

    if (tagId) {
      where.tags = {
        some: {
          tagId: tagId
        }
      }
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          tags: {
            include: {
              tag: true
            }
          },
          _count: {
            select: { calls: true }
          }
        }
      }),
      prisma.contact.count({ where })
    ])

    return NextResponse.json({
      contacts: contacts.map(contact => ({
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
        callCount: contact._count.calls,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error("Error fetching contacts:", error)
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    )
  }
}

// POST /api/contacts - Create new contact
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
    const { firstName, lastName, email, phone, address, notes, leadSource, tagIds } = body

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    // Check if contact with same phone already exists
    const existing = await prisma.contact.findFirst({
      where: {
        tenantId: tenantId,
        phone: phone
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Contact with this phone number already exists" },
        { status: 400 }
      )
    }

    // Create contact with tags
    const contact = await prisma.contact.create({
      data: {
        tenantId: tenantId as string,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone,
        address: address || null,
        notes: notes || null,
        leadSource: leadSource || null,
        tags: tagIds && tagIds.length > 0 ? {
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
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating contact:", error)
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    )
  }
}

