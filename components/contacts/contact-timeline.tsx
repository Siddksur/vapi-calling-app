"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Phone, Mail, MapPin, Calendar, Clock, DollarSign, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { ContactDialog } from "./contact-dialog"
import { ManualCallDialog } from "./manual-call-dialog"
import { CallDialog } from "../calls/call-dialog"
import Link from "next/link"

interface Contact {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  address: string | null
  notes: string | null
  leadSource: string | null
  tags: Array<{ id: string; name: string; color: string | null }>
  callCount: number
  createdAt: string
  updatedAt: string
}

interface Call {
  id: number
  callId: string | null
  status: string | null
  callOutcome: string | null
  duration: number | null
  cost: number | null
  summary: string | null
  recordingUrl: string | null
  timestamp: Date | null
  scheduledTime: Date | null
  campaign: { id: string; name: string | null } | null
  assistant: { id: string; name: string } | null
  phoneNumber: { id: string; displayName: string; phoneNumber: string | null } | null
  successEvaluation: string | null
  structuredData: any
}

interface ContactTimelineProps {
  contact: Contact
  calls: Call[]
}

export function ContactTimeline({ contact, calls }: ContactTimelineProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)
  const [isManualCallDialogOpen, setIsManualCallDialogOpen] = useState(false)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  const getFullName = () => {
    if (contact.firstName || contact.lastName) {
      return [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    }
    return "Unnamed Contact"
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
    if (!outcome) return null
    
    if (outcome.toLowerCase() === "success") {
      return (
        <span className="flex items-center gap-1 text-green-600 text-sm">
          <CheckCircle2 className="h-3 w-3" />
          <span>Success</span>
        </span>
      )
    }
    
    return (
      <span className="flex items-center gap-1 text-red-600 text-sm">
        <XCircle className="h-3 w-3" />
        <span>{outcome}</span>
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

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—"
    const d = new Date(date)
    return d.toLocaleString()
  }

  const handleViewCall = (call: Call) => {
    setSelectedCall(call)
    setIsCallDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Contact Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{getFullName()}</CardTitle>
              <CardDescription className="mt-1">
                Contact details and information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={() => setIsManualCallDialogOpen(true)}
              >
                <Phone className="h-4 w-4 mr-2" />
                Make Call
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Contact
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">Phone</div>
                    <div className="font-medium">{contact.phone}</div>
                  </div>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium">{contact.email}</div>
                    </div>
                  </div>
                )}
                {contact.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-500">Address</div>
                      <div className="font-medium">{contact.address}</div>
                    </div>
                  </div>
                )}
                {contact.leadSource && (
                  <div>
                    <div className="text-sm text-gray-500">Lead Source</div>
                    <Badge variant="outline" className="mt-1">
                      {contact.leadSource}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Tags and Stats */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Tags & Statistics</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 mb-2">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.length > 0 ? (
                      contact.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="px-2 py-1 text-xs rounded"
                          style={{
                            backgroundColor: tag.color
                              ? `${tag.color}20`
                              : "rgba(0,0,0,0.1)",
                            color: tag.color || "inherit",
                          }}
                        >
                          {tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No tags</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Calls</div>
                  <div className="font-medium text-lg">{contact.callCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Created</div>
                  <div className="font-medium">
                    {formatDate(contact.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-lg mb-2">Notes</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {contact.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
          <CardDescription>
            All calls and interactions with this contact
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No calls found for this contact
            </p>
          ) : (
            <div className="space-y-4">
              {calls.map((call, index) => (
                <div
                  key={call.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => handleViewCall(call)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {formatDate(call.timestamp)}
                          </span>
                        </div>
                        {getStatusBadge(call.status)}
                        {getOutcomeBadge(call.callOutcome)}
                      </div>
                      
                      {call.campaign && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Campaign:{" "}
                          <Link
                            href={`/campaigns`}
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {call.campaign.name || call.campaign.id}
                          </Link>
                        </div>
                      )}

                      {call.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                          {call.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        {call.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(call.duration)}</span>
                          </div>
                        )}
                        {call.cost && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>{formatCost(call.cost)}</span>
                          </div>
                        )}
                        {call.recordingUrl && (
                          <a
                            href={call.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Recording</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Contact Dialog */}
      <ContactDialog
        open={isEditDialogOpen}
        onClose={(saved) => {
          setIsEditDialogOpen(false)
          if (saved) {
            window.location.reload()
          }
        }}
        contact={contact}
      />

      {/* Manual Call Dialog */}
      <ManualCallDialog
        open={isManualCallDialogOpen}
        onClose={(called) => {
          setIsManualCallDialogOpen(false)
          if (called) {
            window.location.reload()
          }
        }}
        contact={contact}
      />

      {/* Call Detail Dialog */}
      {selectedCall && (
        <CallDialog
          open={isCallDialogOpen}
          onClose={() => {
            setIsCallDialogOpen(false)
            setSelectedCall(null)
          }}
          call={{
            id: selectedCall.id,
            contactName: getFullName(),
            contactPhone: contact.phone,
            contactAddress: contact.address,
            callId: selectedCall.callId,
            status: selectedCall.status,
            callOutcome: selectedCall.callOutcome,
            duration: selectedCall.duration,
            cost: selectedCall.cost,
            summary: selectedCall.summary,
            recordingUrl: selectedCall.recordingUrl,
            endedReason: null,
            successEvaluation: selectedCall.successEvaluation,
            structuredData: selectedCall.structuredData,
            timestamp: selectedCall.timestamp,
            scheduledTime: selectedCall.scheduledTime,
            actualCallTime: null,
            campaign: selectedCall.campaign,
            assistant: selectedCall.assistant,
            phoneNumber: selectedCall.phoneNumber,
            contact: {
              id: contact.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email
            }
          }}
        />
      )}
    </div>
  )
}

