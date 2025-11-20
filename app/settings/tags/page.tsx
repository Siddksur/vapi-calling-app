import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { TagsManager } from "@/components/tags/tags-manager"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

export default async function TagsPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  // Fetch initial tags
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

  const formattedTags = tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    contactCount: tag._count.contacts
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage tags to organize and categorize your contacts
          </p>
        </div>

        <TagsManager initialTags={formattedTags} />
      </div>
    </DashboardLayout>
  )
}




