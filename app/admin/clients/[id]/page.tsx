import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VAPIConfigForm } from "@/components/admin/vapi-config-form"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function ClientDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params

  if (!session || !session.user || session.user.role !== UserRole.OWNER) {
    redirect("/dashboard")
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          campaigns: true,
          calls: true,
          assistants: true,
          phoneNumbers: true,
        }
      }
    }
  })

  if (!tenant) {
    notFound()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage client configuration and VAPI credentials
          </p>
        </div>

        {/* Client Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenant._count.users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenant._count.campaigns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenant._count.calls.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Assistants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenant._count.assistants}</div>
            </CardContent>
          </Card>
        </div>

        {/* VAPI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>VAPI Configuration</CardTitle>
            <CardDescription>
              Configure VAPI credentials for this client. Each tenant uses their own VAPI organization
              and API keys to ensure complete data isolation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VAPIConfigForm tenant={tenant} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}




