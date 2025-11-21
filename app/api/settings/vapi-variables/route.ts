import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantId } from "@/lib/tenant"

// GET /api/settings/vapi-variables - Get custom VAPI variables for tenant
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = await getTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 400 })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        vapiCustomVariables: true
      }
    })

    return NextResponse.json({
      variables: tenant?.vapiCustomVariables || {}
    })
  } catch (error: any) {
    console.error("Error fetching VAPI variables:", error)
    return NextResponse.json(
      { error: "Failed to fetch VAPI variables" },
      { status: 500 }
    )
  }
}

// PUT /api/settings/vapi-variables - Update custom VAPI variables for tenant
export async function PUT(request: NextRequest) {
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
    const { variables } = body

    // Validate variables is an object
    if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
      return NextResponse.json(
        { error: "Variables must be an object with key-value pairs" },
        { status: 400 }
      )
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Variable "${key}" must be a string value` },
          { status: 400 }
        )
      }
    }

    // Update tenant's custom variables
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        vapiCustomVariables: variables
      },
      select: {
        vapiCustomVariables: true
      }
    })

    return NextResponse.json({
      success: true,
      variables: tenant.vapiCustomVariables
    })
  } catch (error: any) {
    console.error("Error updating VAPI variables:", error)
    return NextResponse.json(
      { error: "Failed to update VAPI variables" },
      { status: 500 }
    )
  }
}

