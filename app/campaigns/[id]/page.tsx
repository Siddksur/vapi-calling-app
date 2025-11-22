import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { prisma } from "@/lib/prisma"
import { getTenantFilter } from "@/lib/tenant"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function CampaignDetailPage({
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

  // Fetch campaign with all calls
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: id,
      ...tenantFilter,
      deletedAt: null
    },
    include: {
      assistant: {
        select: { id: true, name: true, description: true }
      },
      phoneNumber: {
        select: { id: true, displayName: true, phoneNumber: true }
      },
      calls: {
        orderBy: { timestamp: "desc" },
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      _count: {
        select: { calls: true }
      }
    }
  })

  if (!campaign) {
    notFound()
  }

  // Group calls by contact to show unique leads
  const leadsMap = new Map<string, {
    contactId: string | null
    contactName: string
    contactPhone: string
    contactAddress: string | null
    calls: Array<{
      id: number
      status: string | null
      callOutcome: string | null
      duration: number | null
      cost: number | null
      timestamp: Date | null
      scheduledTime: Date | null
    }>
  }>()

  campaign.calls.forEach(call => {
    const key = call.contactPhone
    if (!leadsMap.has(key)) {
      leadsMap.set(key, {
        contactId: call.contactId,
        contactName: call.contactName,
        contactPhone: call.contactPhone,
        contactAddress: call.contactAddress,
        calls: []
      })
    }
    leadsMap.get(key)!.calls.push({
      id: call.id,
      status: call.status,
      callOutcome: call.callOutcome,
      duration: call.duration ? Number(call.duration) : null,
      cost: call.cost ? Number(call.cost) : null,
      timestamp: call.timestamp,
      scheduledTime: call.scheduledTime
    })
  })

  const leads = Array.from(leadsMap.values())

  // Calculate statistics
  const totalCalls = campaign.calls.length
  const completedCalls = campaign.calls.filter(c => c.status === "completed").length
  const successfulCalls = campaign.calls.filter(c => c.callOutcome === "SUCCESS").length
  const avgDuration = campaign.calls
    .filter(c => c.duration)
    .reduce((sum, c) => sum + Number(c.duration || 0), 0) / campaign.calls.filter(c => c.duration).length || 0

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>
      case "calling":
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>
      case "scheduled":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Scheduled</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>
    }
  }

  const getOutcomeIcon = (outcome: string | null) => {
    switch (outcome) {
      case "SUCCESS":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "NO_ANSWER":
      case "BUSY":
      case "VOICEMAIL":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{campaign.name || "Unnamed Campaign"}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {campaign.description || "Campaign details and lead call status"}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Info */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Assistant</p>
                <p className="font-medium">{campaign.assistant.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="font-medium">{campaign.phoneNumber.displayName}</p>
                {campaign.phoneNumber.phoneNumber && (
                  <p className="text-xs text-gray-400">{campaign.phoneNumber.phoneNumber}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Retry Attempts</p>
                <p className="font-medium">{campaign.retryAttempts || 1}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {campaign.isActive ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </div>
            </div>
            {(campaign.startTime || campaign.endTime) && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Calling Hours</p>
                <p className="text-sm">
                  {campaign.startTime || "00:00"} - {campaign.endTime || "23:59"} ({campaign.timeZone || "UTC"})
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
              <p className="text-xs text-muted-foreground">Unique contacts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground">{completedCalls} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">{successfulCalls} successful</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {avgDuration > 0 ? `${Math.round(avgDuration)}s` : "—"}
              </div>
              <p className="text-xs text-muted-foreground">Per call</p>
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Leads & Call Status</CardTitle>
            <CardDescription>
              All leads uploaded for this campaign and their call history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No leads found for this campaign</p>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Calls Made</TableHead>
                      <TableHead>Latest Status</TableHead>
                      <TableHead>Latest Outcome</TableHead>
                      <TableHead>Latest Call Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, idx) => {
                      const latestCall = lead.calls[0]
                      const callCount = lead.calls.length
                      const maxAttempts = campaign.retryAttempts || 1
                      const attemptsRemaining = Math.max(0, maxAttempts - callCount)

                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {lead.contactName || "Unknown"}
                            {lead.contactId && (
                              <Link href={`/contacts/${lead.contactId}`}>
                                <span className="text-xs text-blue-600 hover:underline ml-2">View Contact</span>
                              </Link>
                            )}
                          </TableCell>
                          <TableCell>{lead.contactPhone}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{callCount}</span>
                              {maxAttempts > 1 && (
                                <span className="text-xs text-gray-500">
                                  / {maxAttempts} ({attemptsRemaining} remaining)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {latestCall ? getStatusBadge(latestCall.status) : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell>
                            {latestCall?.callOutcome ? (
                              <div className="flex items-center gap-2">
                                {getOutcomeIcon(latestCall.callOutcome)}
                                <span className="text-sm">{latestCall.callOutcome}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {latestCall?.timestamp ? (
                              <div>
                                <div className="text-sm">
                                  {new Date(latestCall.timestamp).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(latestCall.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/calls?campaign=${campaign.id}&contact=${lead.contactPhone}`}>
                              <Button variant="ghost" size="sm">
                                View All Calls
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}




