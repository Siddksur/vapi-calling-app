import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

// PATCH /api/admin/tenants/[id]/vapi-config - Update VAPI configuration for a tenant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const {
      vapiPrivateKey,
      vapiOrganizationId,
      vapiBaseUrl,
      vapiDefaultAssistantId,
      vapiDefaultPhoneNumberId,
    } = body

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Update VAPI configuration
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        vapiPrivateKey: vapiPrivateKey || null,
        vapiOrganizationId: vapiOrganizationId || null,
        vapiBaseUrl: vapiBaseUrl || null,
        vapiDefaultAssistantId: vapiDefaultAssistantId || null,
        vapiDefaultPhoneNumberId: vapiDefaultPhoneNumberId || null,
      },
    })

    return NextResponse.json(updatedTenant)
  } catch (error) {
    console.error("Error updating VAPI configuration:", error)
    return NextResponse.json(
      { error: "Failed to update VAPI configuration" },
      { status: 500 }
    )
  }
}
