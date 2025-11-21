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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Phone } from "lucide-react"

const manualCallSchema = z.object({
  assistantId: z.string().min(1, "Assistant is required"),
  phoneNumberId: z.string().min(1, "Phone number is required"),
})

type ManualCallFormData = z.infer<typeof manualCallSchema>

interface Contact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  address: string | null
  email: string | null
}

interface ManualCallDialogProps {
  open: boolean
  onClose: (called: boolean) => void
  contact: Contact
}

export function ManualCallDialog({ open, onClose, contact }: ManualCallDialogProps) {
  const [loading, setLoading] = useState(false)
  const [assistants, setAssistants] = useState<Array<{ id: string; name: string }>>([])
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; displayName: string; phoneNumber: string | null }>>([])

  const {
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ManualCallFormData>({
    resolver: zodResolver(manualCallSchema),
    defaultValues: {
      assistantId: "",
      phoneNumberId: "",
    },
  })

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        assistantId: "",
        phoneNumberId: "",
      })
    }
  }, [open, reset])

  const onSubmit = async (data: ManualCallFormData) => {
    setLoading(true)
    try {
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.phone

      const response = await fetch("/api/calls/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contact.id,
          contactName,
          contactPhone: contact.phone,
          contactAddress: contact.address,
          contactEmail: contact.email,
          assistantId: data.assistantId,
          phoneNumberId: data.phoneNumberId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to initiate call")
      }

      const result = await response.json()
      toast.success(`Call initiated for ${contactName}`)
      onClose(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate call")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Manual Call</DialogTitle>
          <DialogDescription>
            Initiate a call for {[contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.phone}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <p className="text-sm font-medium mb-1">Calling:</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {contact.phone}
            </p>
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
              {loading ? (
                "Initiating..."
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Make Call
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}



