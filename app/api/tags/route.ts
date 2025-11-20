import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/tags - List tags for current tenant
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()

    const tags = await prisma.tag.findMany({
      where: tenantFilter,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    })

    return NextResponse.json({
      tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        contactCount: tag._count.contacts
      }))
    })
  } catch (error: any) {
    console.error("Error fetching tags:", error)
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    )
  }
}

// POST /api/tags - Create new tag
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
    const { name, color } = body

    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      )
    }

    // Check if tag with same name already exists for this tenant
    const existing = await prisma.tag.findFirst({
      where: {
        tenantId,
        name: name.trim()
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 400 }
      )
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: name.trim(),
        color: color || null
      }
    })

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating tag:", error)
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    )
  }
}




