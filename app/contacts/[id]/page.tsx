import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { ContactTimeline } from "@/components/contacts/contact-timeline"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  const { id } = await params
  const tenantFilter = await getTenantFilter()

  // Fetch contact with all related data
  const contact = await prisma.contact.findFirst({
    where: {
      id: id,
      ...tenantFilter
    },
    include: {
      tags: {
        include: {
          tag: true
        }
      },
      calls: {
        orderBy: { timestamp: "desc" },
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          },
          assistant: {
            select: {
              id: true,
              name: true
            }
          },
          phoneNumber: {
            select: {
              id: true,
              displayName: true,
              phoneNumber: true
            }
          }
        }
      },
      _count: {
        select: { calls: true }
      }
    }
  })

  if (!contact) {
    notFound()
  }

  const formattedContact = {
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
  }

  const formattedCalls = contact.calls.map(call => ({
    id: call.id,
    callId: call.callId,
    status: call.status,
    callOutcome: call.callOutcome,
    duration: call.duration ? Number(call.duration) : null,
    cost: call.cost ? Number(call.cost) : null,
    summary: call.summary,
    recordingUrl: call.recordingUrl,
    timestamp: call.timestamp,
    scheduledTime: call.scheduledTime,
    campaign: call.campaign,
    assistant: call.assistant,
    phoneNumber: call.phoneNumber,
    successEvaluation: call.successEvaluation,
    structuredData: call.structuredData
  }))

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/contacts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Button>
          </Link>
        </div>

        <ContactTimeline
          contact={formattedContact}
          calls={formattedCalls}
        />
      </div>
    </DashboardLayout>
  )
}




