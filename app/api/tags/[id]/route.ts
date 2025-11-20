import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter, getTenantId } from "@/lib/tenant"

// GET /api/tags/[id] - Get single tag
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

    const tag = await prisma.tag.findFirst({
      where: {
        id: id,
        ...tenantFilter
      },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    })

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        contactCount: tag._count.contacts
      }
    })
  } catch (error: any) {
    console.error("Error fetching tag:", error)
    return NextResponse.json(
      { error: "Failed to fetch tag" },
      { status: 500 }
    )
  }
}

// PUT /api/tags/[id] - Update tag
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
    const tenantId = await getTenantId()
    const tenantFilter = await getTenantFilter()

    // Verify tag exists and belongs to tenant
    const existing = await prisma.tag.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    const body = await request.json()
    const { name, color } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      )
    }

    // Check if another tag with same name exists for this tenant
    const duplicate = await prisma.tag.findFirst({
      where: {
        tenantId: tenantId as string,
        name: name.trim(),
        id: { not: id }
      }
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 400 }
      )
    }

    const tag = await prisma.tag.update({
      where: { id: id },
      data: {
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
    })
  } catch (error: any) {
    console.error("Error updating tag:", error)
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    )
  }
}

// DELETE /api/tags/[id] - Delete tag
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

    // Verify tag exists and belongs to tenant
    const existing = await prisma.tag.findFirst({
      where: {
        id: id,
        ...tenantFilter
      }
    })

    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Delete tag (ContactTag relations will be deleted via cascade)
    await prisma.tag.delete({
      where: { id: id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting tag:", error)
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    )
  }
}




