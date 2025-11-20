"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Phone, Clock, DollarSign, CheckCircle2, XCircle, Eye } from "lucide-react"
import { CallDialog } from "./call-dialog"
import { toast } from "sonner"
import Link from "next/link"

interface Call {
  id: number
  contactName: string
  contactPhone: string
  contactAddress: string | null
  callId: string | null
  status: string | null
  callOutcome: string | null
  duration: number | null
  cost: number | null
  summary: string | null
  recordingUrl: string | null
  endedReason: string | null
  successEvaluation: string | null
  structuredData: any
  timestamp: Date | null
  scheduledTime: Date | null
  actualCallTime: string | null
  campaign: { id: string; name: string | null } | null
  assistant: { id: string; name: string } | null
  phoneNumber: { id: string; displayName: string; phoneNumber: string | null } | null
  contact: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null
}

interface CallsListProps {
  initialCalls: Call[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  initialStats: {
    total: number
    completed: number
    successful: number
    avgDuration: number | null
    totalCost: number | null
  }
  campaigns: Array<{ id: string; name: string | null }>
}

export function CallsList({ initialCalls, initialPagination, initialStats, campaigns }: CallsListProps) {
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [pagination, setPagination] = useState(initialPagination)
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  const fetchCalls = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(search && { search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(campaignFilter !== "all" && { campaignId: campaignFilter }),
        ...(outcomeFilter !== "all" && { callOutcome: outcomeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })

      const response = await fetch(`/api/calls?${params}`)
      if (!response.ok) throw new Error("Failed to fetch calls")

      const data = await response.json()
      setCalls(data.calls)
      setPagination(data.pagination)
      setStats(data.stats)
    } catch (error) {
      toast.error("Failed to load calls")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCalls(1)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [search, statusFilter, campaignFilter, outcomeFilter, startDate, endDate])

  const handleView = (call: Call) => {
    setSelectedCall(call)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setSelectedCall(null)
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return null
    
    const statusColors: Record<string, string> = {
      scheduled: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      in_progress: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
      completed: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      failed: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      cancelled: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
    }

    return (
      <span className={`px-2 py-1 text-xs rounded ${statusColors[status] || "bg-gray-100 dark:bg-gray-800"}`}>
        {status}
      </span>
    )
  }

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="text-gray-400">—</span>
    
    if (outcome.toLowerCase() === "success") {
      return (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          <span className="text-xs">Success</span>
        </span>
      )
    }
    
    return (
      <span className="flex items-center gap-1 text-red-600">
        <XCircle className="h-3 w-3" />
        <span className="text-xs">{outcome}</span>
      </span>
    )
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatCost = (cost: number | null) => {
    if (!cost) return "—"
    return `$${cost.toFixed(4)}`
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%"} completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successful}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed > 0 ? `${Math.round((stats.successful / stats.completed) * 100)}%` : "0%"} success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgDuration ? formatDuration(stats.avgDuration) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(stats.totalCost)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="relative flex-1 md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search calls..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name || campaign.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                placeholder="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
          <CardDescription>
            {pagination.total} total calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : calls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No calls found
                    </TableCell>
                  </TableRow>
                ) : (
                  calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{call.contactName}</div>
                          <div className="text-sm text-gray-500">{call.contactPhone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.campaign ? (
                          <Link
                            href={`/campaigns?campaign=${call.campaign.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {call.campaign.name || call.campaign.id}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell>{getOutcomeBadge(call.callOutcome)}</TableCell>
                      <TableCell>{formatDuration(call.duration)}</TableCell>
                      <TableCell>{formatCost(call.cost)}</TableCell>
                      <TableCell>
                        {call.timestamp
                          ? new Date(call.timestamp).toLocaleDateString() + " " +
                            new Date(call.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(call)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} calls
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCalls(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCalls(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Call Detail Dialog */}
      {selectedCall && (
        <CallDialog
          open={isDialogOpen}
          onClose={handleDialogClose}
          call={selectedCall}
        />
      )}
    </div>
  )
}




