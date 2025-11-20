"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Bot, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface Assistant {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

export function AssistantsList() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchAssistants = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/assistants")
      
      if (!response.ok) {
        throw new Error("Failed to fetch assistants")
      }

      const data = await response.json()
      setAssistants(data.assistants || [])
    } catch (error: any) {
      console.error("Error fetching assistants:", error)
      toast.error("Failed to load assistants")
    } finally {
      setIsLoading(false)
    }
  }

  const syncAssistants = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch("/api/assistants/sync", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync assistants")
      }

      toast.success(data.message || `Synced ${data.synced} assistant(s)`)
      
      // Refresh the list
      await fetchAssistants()
    } catch (error: any) {
      console.error("Error syncing assistants:", error)
      toast.error(error.message || "Failed to sync assistants from VAPI")
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchAssistants()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">Loading assistants...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {assistants.length === 0
              ? "No assistants found. Sync from VAPI to get started."
              : `${assistants.length} assistant(s) available`}
          </p>
        </div>
        <Button
          onClick={syncAssistants}
          disabled={isSyncing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync from VAPI"}
        </Button>
      </div>

      {assistants.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Bot className="h-12 w-12 mx-auto text-gray-400" />
              <div>
                <h3 className="text-lg font-semibold">No Assistants Found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sync assistants from your VAPI organization to get started.
                </p>
              </div>
              <Button onClick={syncAssistants} disabled={isSyncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Sync from VAPI
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assistants.map((assistant) => (
            <Card key={assistant.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{assistant.name}</CardTitle>
                  </div>
                  <Badge
                    variant={assistant.isActive ? "default" : "secondary"}
                    className={
                      assistant.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : ""
                    }
                  >
                    {assistant.isActive ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </Badge>
                </div>
                {assistant.description && (
                  <CardDescription className="mt-2">
                    {assistant.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 font-mono">
                  ID: {assistant.id}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}



