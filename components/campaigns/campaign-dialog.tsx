"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

const campaignSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  assistantId: z.string().min(1, "Assistant is required"),
  phoneNumberId: z.string().min(1, "Phone number is required"),
  isActive: z.boolean().default(true),
  scheduleDays: z.array(z.number()).optional(),
  scheduleFrequency: z.string().optional(),
  timeZone: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  retryAttempts: z.number().min(1).max(10).default(1),
})

type CampaignFormData = z.infer<typeof campaignSchema>

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
}

interface CampaignDialogProps {
  open: boolean
  onClose: (saved: boolean) => void
  campaign: Campaign | null
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
]

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
]

export function CampaignDialog({ open, onClose, campaign }: CampaignDialogProps) {
  const [loading, setLoading] = useState(false)
  const [assistants, setAssistants] = useState<Array<{ id: string; name: string }>>([])
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; displayName: string; phoneNumber: string | null }>>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      assistantId: "",
      phoneNumberId: "",
      isActive: true,
      scheduleDays: [],
      scheduleFrequency: "weekly",
      timeZone: "UTC",
      startTime: "",
      endTime: "",
      retryAttempts: 1,
    },
  })

  const selectedDays = watch("scheduleDays") || []
  const scheduleFrequency = watch("scheduleFrequency") || "weekly"

  // Fetch assistants and phone numbers
  useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/assistants").then((res) => res.json()),
        fetch("/api/phone-numbers").then((res) => res.json())
      ])
        .then(([assistantsData, phoneNumbersData]) => {
          if (assistantsData.assistants) {
            setAssistants(assistantsData.assistants)
          }
          if (phoneNumbersData.phoneNumbers) {
            setPhoneNumbers(phoneNumbersData.phoneNumbers)
          }
        })
        .catch(() => {
          toast.error("Failed to load assistants or phone numbers")
        })
    }
  }, [open])

  // Reset form when campaign changes
  useEffect(() => {
    if (campaign) {
      reset({
        name: campaign.name || "",
        description: campaign.description || "",
        assistantId: campaign.assistantId,
        phoneNumberId: campaign.phoneNumberId,
        isActive: campaign.isActive,
        scheduleDays: campaign.scheduleDays || [],
        scheduleFrequency: campaign.scheduleFrequency || "weekly",
        timeZone: campaign.timeZone || "UTC",
        startTime: campaign.startTime || "",
        endTime: campaign.endTime || "",
        retryAttempts: campaign.retryAttempts || 1,
      })
    } else {
      reset({
        name: "",
        description: "",
        assistantId: "",
        phoneNumberId: "",
        isActive: true,
        scheduleDays: [],
        scheduleFrequency: "weekly",
        timeZone: "UTC",
        startTime: "",
        endTime: "",
      })
    }
  }, [campaign, reset])

  const onSubmit = async (data: CampaignFormData) => {
    setLoading(true)
    try {
      const url = campaign ? `/api/campaigns/${campaign.id}` : "/api/campaigns"
      const method = campaign ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          name: data.name || null,
          description: data.description || null,
          scheduleDays: data.scheduleDays || [],
          scheduleFrequency: data.scheduleFrequency || null,
          timeZone: data.timeZone || "UTC",
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          retryAttempts: data.retryAttempts || 1,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save campaign")
      }

      toast.success(campaign ? "Campaign updated successfully" : "Campaign created successfully")
      onClose(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to save campaign")
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day: number) => {
    const current = selectedDays
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort()
    setValue("scheduleDays", updated)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create New Campaign"}</DialogTitle>
          <DialogDescription>
            {campaign
              ? "Update campaign settings and scheduling below."
              : "Configure your campaign settings and scheduling preferences."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Information</h3>
            <div>
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="My Campaign"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Brief description of this campaign..."
                rows={3}
              />
            </div>
          </div>

          {/* Assistant & Phone Number */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assistantId">
                  Assistant <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch("assistantId") || ""}
                  onValueChange={(value) => setValue("assistantId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assistant" />
                  </SelectTrigger>
                  <SelectContent>
                    {assistants.map((assistant) => (
                      <SelectItem key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assistantId && (
                  <p className="text-sm text-red-500 mt-1">{errors.assistantId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phoneNumberId">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watch("phoneNumberId") || ""}
                  onValueChange={(value) => setValue("phoneNumberId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phoneNumber) => (
                      <SelectItem key={phoneNumber.id} value={phoneNumber.id}>
                        {phoneNumber.displayName}
                        {phoneNumber.phoneNumber && ` (${phoneNumber.phoneNumber})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.phoneNumberId && (
                  <p className="text-sm text-red-500 mt-1">{errors.phoneNumberId.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Scheduling */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Scheduling</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduleFrequency">Frequency</Label>
                <Select
                  value={scheduleFrequency}
                  onValueChange={(value) => setValue("scheduleFrequency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select
                  value={watch("timeZone") || "UTC"}
                  onValueChange={(value) => setValue("timeZone", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(scheduleFrequency === "weekly" || scheduleFrequency === "custom") && (
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  {...register("startTime")}
                />
              </div>

              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  {...register("endTime")}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="retryAttempts">Retry Attempts</Label>
              <Input
                id="retryAttempts"
                type="number"
                min="1"
                max="10"
                {...register("retryAttempts", { valueAsNumber: true })}
                placeholder="Number of times to call each contact"
              />
              <p className="text-sm text-gray-500 mt-1">
                How many times each contact should be called throughout the campaign lifetime
              </p>
              {errors.retryAttempts && (
                <p className="text-sm text-red-500 mt-1">{errors.retryAttempts.message}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(checked) => setValue("isActive", checked as boolean)}
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Active (Campaign will run according to schedule)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : campaign ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

