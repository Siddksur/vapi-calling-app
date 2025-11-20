import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

// GET /api/phone-numbers - List phone numbers for current tenant
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role === "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantFilter = await getTenantFilter()

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        ...tenantFilter,
        isActive: true
      },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        isActive: true
      }
    })

    return NextResponse.json({ phoneNumbers })
  } catch (error: any) {
    console.error("Error fetching phone numbers:", error)
    return NextResponse.json(
      { error: "Failed to fetch phone numbers" },
      { status: 500 }
    )
  }
}




