"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, Clock, DollarSign, Phone, Calendar, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"

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

interface CallDialogProps {
  open: boolean
  onClose: () => void
  call: Call
}

export function CallDialog({ open, onClose, call }: CallDialogProps) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  
  // Extract transcript from structuredData
  const transcript = call.structuredData?.transcript || null
  
  // Split transcript into lines for preview
  const transcriptLines = transcript ? transcript.split('\n') : []
  const previewLines = 3
  const showPreview = transcriptLines.length > previewLines && !transcriptExpanded
  const displayTranscript = showPreview 
    ? transcriptLines.slice(0, previewLines).join('\n') + '\n...'
    : transcript

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const formatCost = (cost: number | null) => {
    if (!cost) return "N/A"
    return `$${cost.toFixed(4)}`
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A"
    const d = new Date(date)
    return d.toLocaleString()
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
    if (!outcome) return <span className="text-gray-400">N/A</span>
    
    const outcomeLower = outcome.toLowerCase()
    
    // Map VAPI outcomes to display format
    const outcomeMap: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
      voicemail: { label: "Voicemail", color: "text-blue-600", icon: CheckCircle2 },
      interested: { label: "Interested", color: "text-green-600", icon: CheckCircle2 },
      callback: { label: "Callback", color: "text-yellow-600", icon: Clock },
      not_interested: { label: "Not Interested", color: "text-red-600", icon: XCircle },
      do_not_call: { label: "Do Not Call", color: "text-red-600", icon: XCircle },
      unclear: { label: "Unclear", color: "text-gray-600", icon: Clock },
      send_listings: { label: "Send Listings", color: "text-green-600", icon: CheckCircle2 },
    }
    
    const outcomeInfo = outcomeMap[outcomeLower]
    const Icon = outcomeInfo?.icon || CheckCircle2
    const color = outcomeInfo?.color || "text-gray-600"
    const label = outcomeInfo?.label || outcome
    
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call Details</DialogTitle>
          <DialogDescription>
            Detailed information about this call
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Outcome */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-gray-500">Status</Label>
              <div className="mt-1">{getStatusBadge(call.status)}</div>
            </div>
            <div className="text-right">
              <Label className="text-sm text-gray-500">Outcome</Label>
              <div className="mt-1">{getOutcomeBadge(call.callOutcome)}</div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Name</Label>
                <div className="font-medium">{call.contactName}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Phone</Label>
                <div className="font-medium">{call.contactPhone}</div>
              </div>
              {call.contactAddress && (
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Address</Label>
                  <div>{call.contactAddress}</div>
                </div>
              )}
              {call.contact && (
                <>
                  {(call.contact.firstName || call.contact.lastName) && (
                    <div>
                      <Label className="text-sm text-gray-500">Full Name</Label>
                      <div>
                        {[call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")}
                      </div>
                    </div>
                  )}
                  {call.contact.email && (
                    <div>
                      <Label className="text-sm text-gray-500">Email</Label>
                      <div>{call.contact.email}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Call Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Call Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Call ID</Label>
                <div className="font-mono text-sm">{call.callId || "N/A"}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Duration</Label>
                <div className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(call.duration)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Cost</Label>
                <div className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {formatCost(call.cost)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Actual Call Time</Label>
                <div className="font-medium">{call.actualCallTime || "N/A"}</div>
              </div>
              {call.endedReason && (
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Ended Reason</Label>
                  <div>{call.endedReason}</div>
                </div>
              )}
              {call.successEvaluation && (
                <div>
                  <Label className="text-sm text-gray-500">Success Evaluation</Label>
                  <div>{call.successEvaluation}</div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timing */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timing
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Timestamp</Label>
                <div>{formatDate(call.timestamp)}</div>
              </div>
              {call.scheduledTime && (
                <div>
                  <Label className="text-sm text-gray-500">Scheduled Time</Label>
                  <div>{formatDate(call.scheduledTime)}</div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Campaign and Configuration */}
          {(call.campaign || call.assistant || call.phoneNumber) && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-3">Campaign & Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  {call.campaign && (
                    <div>
                      <Label className="text-sm text-gray-500">Campaign</Label>
                      <div className="font-medium">{call.campaign.name || call.campaign.id}</div>
                    </div>
                  )}
                  {call.assistant && (
                    <div>
                      <Label className="text-sm text-gray-500">Assistant</Label>
                      <div className="font-medium">{call.assistant.name}</div>
                    </div>
                  )}
                  {call.phoneNumber && (
                    <div>
                      <Label className="text-sm text-gray-500">Phone Number</Label>
                      <div className="font-medium">
                        {call.phoneNumber.displayName}
                        {call.phoneNumber.phoneNumber && ` (${call.phoneNumber.phoneNumber})`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Transcript */}
          {transcript && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Transcript
                </h3>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{displayTranscript}</p>
                  {transcriptLines.length > previewLines && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                      className="mt-2 w-full"
                    >
                      {transcriptExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          See More
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Summary */}
          {call.summary && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Summary
                </h3>
                <p className="text-sm whitespace-pre-wrap">{call.summary}</p>
              </div>
              <Separator />
            </>
          )}


          {/* Recording */}
          {call.recordingUrl && (
            <div>
              <a
                href={call.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Recording</span>
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




