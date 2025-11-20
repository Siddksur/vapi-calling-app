import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { ContactsList } from "@/components/contacts/contacts-list"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"

export default async function ContactsPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  // Fetch initial contacts and tags
  const tenantFilter = await getTenantFilter()
  
  const [contacts, total, tags] = await Promise.all([
    prisma.contact.findMany({
      where: tenantFilter,
      take: 20,
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
    prisma.contact.count({ where: tenantFilter }),
    prisma.tag.findMany({
      where: tenantFilter,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true
      }
    })
  ])

  const formattedContacts = contacts.map(contact => ({
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
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString()
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your CRM contacts and leads
          </p>
        </div>

        <ContactsList
          initialContacts={formattedContacts}
          initialPagination={{
            page: 1,
            limit: 20,
            total,
            totalPages: Math.ceil(total / 20)
          }}
          initialTags={tags}
        />
      </div>
    </DashboardLayout>
  )
}
