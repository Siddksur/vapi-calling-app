"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tenant } from "@prisma/client"
import { toast } from "sonner"
import { Key, Building2, Phone, User } from "lucide-react"

interface VAPIConfigFormProps {
  tenant: Tenant
}

export function VAPIConfigForm({ tenant }: VAPIConfigFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    vapiPrivateKey: tenant.vapiPrivateKey || "",
    vapiOrganizationId: tenant.vapiOrganizationId || "",
    vapiBaseUrl: tenant.vapiBaseUrl || "https://api.vapi.ai",
    vapiDefaultAssistantId: tenant.vapiDefaultAssistantId || "",
    vapiDefaultPhoneNumberId: tenant.vapiDefaultPhoneNumberId || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}/vapi-config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to update VAPI configuration")
      }

      toast.success("VAPI configuration updated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to update VAPI configuration")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vapiOrganizationId" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            VAPI Organization ID *
          </Label>
          <Input
            id="vapiOrganizationId"
            type="text"
            value={formData.vapiOrganizationId}
            onChange={(e) =>
              setFormData({ ...formData, vapiOrganizationId: e.target.value })
            }
            placeholder="e.g., 9cf21e1b-4217-4272-8397-4b1cb6c4aefe"
            required
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            The VAPI organization ID for this client. This ensures all API calls are made
            using the client's own VAPI account.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vapiPrivateKey" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            VAPI Private Key *
          </Label>
          <Input
            id="vapiPrivateKey"
            type="password"
            value={formData.vapiPrivateKey}
            onChange={(e) =>
              setFormData({ ...formData, vapiPrivateKey: e.target.value })
            }
            placeholder="Enter VAPI private key"
            required
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            The VAPI private key (API key) for this client. This is used to authenticate
            all API requests on behalf of this tenant.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vapiBaseUrl">VAPI Base URL</Label>
          <Input
            id="vapiBaseUrl"
            type="url"
            value={formData.vapiBaseUrl}
            onChange={(e) =>
              setFormData({ ...formData, vapiBaseUrl: e.target.value })
            }
            placeholder="https://api.vapi.ai"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            The base URL for VAPI API requests. Defaults to https://api.vapi.ai
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vapiDefaultAssistantId" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Default Assistant ID
            </Label>
            <Input
              id="vapiDefaultAssistantId"
              type="text"
              value={formData.vapiDefaultAssistantId}
              onChange={(e) =>
                setFormData({ ...formData, vapiDefaultAssistantId: e.target.value })
              }
              placeholder="Optional default assistant ID"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Optional default assistant to use for campaigns if not specified
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vapiDefaultPhoneNumberId" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Default Phone Number ID
            </Label>
            <Input
              id="vapiDefaultPhoneNumberId"
              type="text"
              value={formData.vapiDefaultPhoneNumberId}
              onChange={(e) =>
                setFormData({ ...formData, vapiDefaultPhoneNumberId: e.target.value })
              }
              placeholder="Optional default phone number ID"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Optional default phone number to use for campaigns if not specified
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save VAPI Configuration"}
        </Button>
      </div>
    </form>
  )
}




