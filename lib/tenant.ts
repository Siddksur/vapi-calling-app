import { auth } from "./auth"
import { prisma } from "./prisma"
import { UserRole } from "@prisma/client"

/**
 * Get the current user's tenant ID from session
 * Returns null for OWNER role (they can access all tenants)
 */
export async function getTenantId(): Promise<string | null> {
  const session = await auth()
  
  if (!session?.user) {
    return null
  }

  // OWNER can access all tenants (returns null to indicate no filter)
  if (session.user.role === UserRole.OWNER) {
    return null
  }

  // CLIENT must have a tenantId
  return session.user.tenantId || null
}

/**
 * Ensure the current user has access to a specific tenant
 * Throws an error if access is denied
 */
export async function ensureTenantAccess(tenantId: string): Promise<void> {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // OWNER can access any tenant
  if (session.user.role === UserRole.OWNER) {
    return
  }

  // CLIENT can only access their own tenant
  if (session.user.role === UserRole.CLIENT) {
    if (session.user.tenantId !== tenantId) {
      throw new Error("Access denied: You don't have access to this tenant")
    }
    return
  }

  throw new Error("Unauthorized")
}

/**
 * Get tenant-scoped Prisma query options
 * Returns an object with tenantId filter for CLIENT users
 */
export async function getTenantFilter() {
  const tenantId = await getTenantId()
  
  // If tenantId is null (OWNER), return empty object (no filter)
  // If tenantId is set (CLIENT), return filter object
  return tenantId ? { tenantId } : {}
}

