"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface EditAssistantDialogProps {
  assistantId: string
  assistantName: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditAssistantDialog({
  assistantId,
  assistantName,
  open,
  onClose,
  onSaved,
}: EditAssistantDialogProps) {
  const [systemPrompt, setSystemPrompt] = useState("")
  const [firstMessage, setFirstMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  // Fetch assistant details when dialog opens
  useEffect(() => {
    if (open && assistantId) {
      fetchAssistantDetails()
    }
  }, [open, assistantId])

  const fetchAssistantDetails = async () => {
    try {
      setIsFetching(true)
      const response = await fetch(`/api/assistants/${assistantId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch assistant details")
      }

      const data = await response.json()
      setSystemPrompt(data.assistant.systemPrompt || "")
      setFirstMessage(data.assistant.firstMessage || "")
    } catch (error: any) {
      console.error("Error fetching assistant:", error)
      toast.error("Failed to load assistant details")
    } finally {
      setIsFetching(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsLoading(true)

      const response = await fetch(`/api/assistants/${assistantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: systemPrompt || null,
          firstMessage: firstMessage || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update assistant")
      }

      toast.success("Assistant updated successfully")
      onSaved()
      onClose()
    } catch (error: any) {
      console.error("Error updating assistant:", error)
      toast.error(error.message || "Failed to update assistant")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assistant: {assistantName}</DialogTitle>
          <DialogDescription>
            Update the system prompt and first message for this assistant. Changes will be synced to VAPI.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading assistant details...</span>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">
                System Prompt
                <span className="text-xs text-gray-500 ml-2">
                  (Instructions for the AI assistant)
                </span>
              </Label>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter the system prompt that defines the assistant's behavior..."
                className="min-h-32 font-mono text-sm"
                rows={8}
              />
              <p className="text-xs text-gray-500">
                {systemPrompt.length} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-message">
                First Message
                <span className="text-xs text-gray-500 ml-2">
                  (The initial message the assistant says when a call starts)
                </span>
              </Label>
              <Textarea
                id="first-message"
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Enter the first message the assistant will say..."
                className="min-h-24 font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-gray-500">
                {firstMessage.length} characters
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isFetching}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isFetching}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

