import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole, PlanType } from "@prisma/client"
import bcrypt from "bcryptjs"

// GET /api/admin/tenants - List all tenants
export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            campaigns: true,
            calls: true
          }
        },
        subscription: true
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error("Error fetching tenants:", error)
    return NextResponse.json(
      { error: "Failed to fetch tenants" },
      { status: 500 }
    )
  }
}

// POST /api/admin/tenants - Create a new tenant with a user
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, planType, email, password, userName } = body

    if (!name || !slug || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug }
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      )
    }

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          planType: planType || PlanType.BASIC,
          isActive: true,
        }
      })

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create user for this tenant
      const user = await tx.user.create({
        data: {
          email,
          name: userName || name,
          password: hashedPassword,
          role: UserRole.CLIENT,
          tenantId: tenant.id,
          isActive: true,
        }
      })

      return { tenant, user }
    })

    return NextResponse.json({
      tenant: result.tenant,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating tenant:", error)
    return NextResponse.json(
      { error: "Failed to create tenant" },
      { status: 500 }
    )
  }
}

