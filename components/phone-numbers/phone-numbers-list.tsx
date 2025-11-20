"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, PhoneCall, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface PhoneNumber {
  id: string
  displayName: string
  phoneNumber: string | null
  isActive: boolean
}

export function PhoneNumbersList() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const fetchPhoneNumbers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/phone-numbers")
      
      if (!response.ok) {
        throw new Error("Failed to fetch phone numbers")
      }

      const data = await response.json()
      setPhoneNumbers(data.phoneNumbers || [])
    } catch (error: any) {
      console.error("Error fetching phone numbers:", error)
      toast.error("Failed to load phone numbers")
    } finally {
      setIsLoading(false)
    }
  }

  const syncPhoneNumbers = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch("/api/phone-numbers/sync", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync phone numbers")
      }

      toast.success(data.message || `Synced ${data.synced} phone number(s)`)
      
      // Refresh the list
      await fetchPhoneNumbers()
    } catch (error: any) {
      console.error("Error syncing phone numbers:", error)
      toast.error(error.message || "Failed to sync phone numbers from VAPI")
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    fetchPhoneNumbers()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">Loading phone numbers...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {phoneNumbers.length === 0
              ? "No phone numbers found. Sync from VAPI to get started."
              : `${phoneNumbers.length} phone number(s) available`}
          </p>
        </div>
        <Button
          onClick={syncPhoneNumbers}
          disabled={isSyncing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync from VAPI"}
        </Button>
      </div>

      {phoneNumbers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <PhoneCall className="h-12 w-12 mx-auto text-gray-400" />
              <div>
                <h3 className="text-lg font-semibold">No Phone Numbers Found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sync phone numbers from your VAPI organization to get started.
                </p>
              </div>
              <Button onClick={syncPhoneNumbers} disabled={isSyncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                Sync from VAPI
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {phoneNumbers.map((phoneNumber) => (
            <Card key={phoneNumber.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{phoneNumber.displayName}</CardTitle>
                  </div>
                  <Badge
                    variant={phoneNumber.isActive ? "default" : "secondary"}
                    className={
                      phoneNumber.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : ""
                    }
                  >
                    {phoneNumber.isActive ? (
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
                {phoneNumber.phoneNumber && (
                  <CardDescription className="mt-2 font-mono">
                    {phoneNumber.phoneNumber}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 font-mono">
                  ID: {phoneNumber.id}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}



