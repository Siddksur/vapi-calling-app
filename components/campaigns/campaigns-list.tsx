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
import { Plus, Search, Edit, Trash2, Play, Pause, Calendar, Clock, Upload } from "lucide-react"
import { CampaignDialog } from "./campaign-dialog"
import { CsvUploadDialog } from "./csv-upload-dialog"
import { toast } from "sonner"
import Link from "next/link"

interface Campaign {
  id: string
  name: string | null
  description: string | null
  assistantId: string
  assistant: { id: string; name: string }
  phoneNumberId: string
  phoneNumber: { id: string; displayName: string; phoneNumber: string | null }
  isActive: boolean
  scheduleDays: number[]
  scheduleFrequency: string | null
  timeZone: string
  startTime: string | null
  endTime: string | null
  retryAttempts: number | null
  callCount: number
  createdAt: Date | null
  updatedAt: Date | null
}

interface CampaignsListProps {
  initialCampaigns: Campaign[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function CampaignsList({ initialCampaigns, initialPagination }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [pagination, setPagination] = useState(initialPagination)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false)
  const [csvCampaign, setCsvCampaign] = useState<Campaign | null>(null)

  const fetchCampaigns = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter !== "all" && { isActive: statusFilter === "active" ? "true" : "false" }),
      })

      const response = await fetch(`/api/campaigns?${params}`)
      if (!response.ok) throw new Error("Failed to fetch campaigns")

      const data = await response.json()
      setCampaigns(data.campaigns)
      setPagination(data.pagination)
    } catch (error) {
      toast.error("Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCampaigns(1)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [search, statusFilter])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return

    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete campaign")

      toast.success("Campaign deleted successfully")
      fetchCampaigns(pagination.page)
    } catch (error) {
      toast.error("Failed to delete campaign")
    }
  }

  const handleToggleActive = async (campaign: Campaign) => {
    // If stopping, use the stop endpoint which cancels scheduled calls
    if (campaign.isActive) {
      if (!confirm("Stop this campaign? This will cancel all scheduled calls. Active calls will complete.")) {
        return
      }

      try {
        const response = await fetch(`/api/campaigns/${campaign.id}/stop`, {
          method: "POST",
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to stop campaign")
        }

        const data = await response.json()
        toast.success(`Campaign stopped. ${data.cancelledCalls || 0} scheduled calls cancelled.`)
        fetchCampaigns(pagination.page)
      } catch (error: any) {
        toast.error(error.message || "Failed to stop campaign")
      }
    } else {
      // Reactivating - just update isActive
      try {
        const response = await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: true
          }),
        })

        if (!response.ok) throw new Error("Failed to activate campaign")

        toast.success("Campaign activated")
        fetchCampaigns(pagination.page)
      } catch (error) {
        toast.error("Failed to activate campaign")
      }
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setIsDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingCampaign(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = (saved: boolean) => {
    setIsDialogOpen(false)
    setEditingCampaign(null)
    if (saved) {
      fetchCampaigns(pagination.page)
    }
  }

  const handleCsvUpload = (campaign: Campaign) => {
    setCsvCampaign(campaign)
    setIsCsvDialogOpen(true)
  }

  const handleCsvDialogClose = (saved: boolean) => {
    setIsCsvDialogOpen(false)
    setCsvCampaign(null)
    if (saved) {
      fetchCampaigns(pagination.page)
    }
  }

  const getScheduleDisplay = (campaign: Campaign) => {
    if (!campaign.scheduleDays || campaign.scheduleDays.length === 0) {
      return <span className="text-gray-400">Not scheduled</span>
    }

    const days = campaign.scheduleDays.map(d => DAYS_OF_WEEK[d]?.slice(0, 3)).join(", ")
    const time = campaign.startTime && campaign.endTime
      ? `${campaign.startTime} - ${campaign.endTime}`
      : ""

    return (
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-3 w-3 text-gray-400" />
        <span>{days}</span>
        {time && (
          <>
            <Clock className="h-3 w-3 text-gray-400 ml-2" />
            <span>{time}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Assistant</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                      <div>
                        <div>{campaign.name || "Unnamed Campaign"}</div>
                        {campaign.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                            {campaign.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{campaign.assistant.name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{campaign.phoneNumber.displayName}</div>
                      {campaign.phoneNumber.phoneNumber && (
                        <div className="text-xs text-gray-500">{campaign.phoneNumber.phoneNumber}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getScheduleDisplay(campaign)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/calls?campaign=${campaign.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {campaign.callCount}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {campaign.isActive ? (
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCsvUpload(campaign)}
                        title="Upload CSV"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(campaign)}
                        title={campaign.isActive ? "Stop Campaign" : "Start Campaign"}
                      >
                        {campaign.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(campaign)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} campaigns
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCampaigns(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCampaigns(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <CampaignDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        campaign={editingCampaign}
      />

      {/* CSV Upload Dialog */}
      {csvCampaign && (
        <CsvUploadDialog
          open={isCsvDialogOpen}
          onClose={handleCsvDialogClose}
          campaignId={csvCampaign.id}
          campaignName={csvCampaign.name}
        />
      )}
    </div>
  )
}

