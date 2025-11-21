"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Save, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Variable {
  key: string
  value: string
}

export function VAPIVariablesManager() {
  const [variables, setVariables] = useState<Variable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchVariables()
  }, [])

  const fetchVariables = async () => {
    try {
      const response = await fetch("/api/settings/vapi-variables")
      if (!response.ok) throw new Error("Failed to fetch variables")
      
      const data = await response.json()
      const vars = data.variables || {}
      
      // Convert object to array
      const varsArray: Variable[] = Object.entries(vars).map(([key, value]) => ({
        key,
        value: value as string
      }))
      
      setVariables(varsArray)
    } catch (error: any) {
      console.error("Error fetching variables:", error)
      toast.error("Failed to load variables")
    } finally {
      setIsLoading(false)
    }
  }

  const addVariable = () => {
    setVariables([...variables, { key: "", value: "" }])
  }

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index))
  }

  const updateVariable = (index: number, field: "key" | "value", value: string) => {
    const updated = [...variables]
    updated[index][field] = value
    setVariables(updated)
  }

  const handleSave = async () => {
    // Validate variables
    const invalidVars = variables.filter(v => !v.key.trim() || !v.value.trim())
    if (invalidVars.length > 0) {
      toast.error("Please fill in all variable keys and values")
      return
    }

    // Check for duplicate keys
    const keys = variables.map(v => v.key.trim().toLowerCase())
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index)
    if (duplicates.length > 0) {
      toast.error("Duplicate variable keys are not allowed")
      return
    }

    // Check for reserved keys
    const reservedKeys = ["name", "customer.number", "address", "email"]
    const hasReserved = variables.some(v => reservedKeys.includes(v.key.trim().toLowerCase()))
    if (hasReserved) {
      toast.error("Cannot override reserved variables (name, customer.number, address, email)")
      return
    }

    setIsSaving(true)

    try {
      // Convert array to object
      const varsObject: Record<string, string> = {}
      variables.forEach(v => {
        varsObject[v.key.trim()] = v.value.trim()
      })

      const response = await fetch("/api/settings/vapi-variables", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ variables: varsObject })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save variables")
      }

      toast.success("Custom variables saved successfully")
    } catch (error: any) {
      console.error("Error saving variables:", error)
      toast.error(error.message || "Failed to save variables")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Variables</CardTitle>
        <CardDescription>
          Add custom variables that will be sent to your VAPI assistant. Use these variables in your assistant prompts with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{"{{variableName}}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Default variables (name, customer.number, address, email) are automatically included and cannot be overridden.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {variables.map((variable, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <Label htmlFor={`key-${index}`} className="text-xs text-gray-500">
                  Variable Name
                </Label>
                <Input
                  id={`key-${index}`}
                  placeholder="e.g., company, region, customField"
                  value={variable.key}
                  onChange={(e) => updateVariable(index, "key", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`value-${index}`} className="text-xs text-gray-500">
                  Value
                </Label>
                <Input
                  id={`value-${index}`}
                  placeholder="e.g., Acme Corp, West Coast"
                  value={variable.value}
                  onChange={(e) => updateVariable(index, "value", e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeVariable(index)}
                className="mt-7"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addVariable}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Variables"}
          </Button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Available Variables:</h4>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <div><code className="text-xs bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{"{{name}}"}</code> - Contact name</div>
            <div><code className="text-xs bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{"{{customer.number}}"}</code> - Formatted phone number</div>
            <div><code className="text-xs bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{"{{address}}"}</code> - Contact address</div>
            <div><code className="text-xs bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{"{{email}}"}</code> - Contact email</div>
            {variables.map((v, i) => (
              <div key={i}>
                <code className="text-xs bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{"{{" + v.key + "}}"}</code> - {v.value || "Custom variable"}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

