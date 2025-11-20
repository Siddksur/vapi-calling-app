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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const contactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().optional(),
  notes: z.string().optional(),
  leadSource: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
})

type ContactFormData = z.infer<typeof contactSchema>

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
}

interface ContactDialogProps {
  open: boolean
  onClose: (saved: boolean) => void
  contact: Contact | null
}

export function ContactDialog({ open, onClose, contact }: ContactDialogProps) {
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string | null }>>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      leadSource: "",
      tagIds: [],
    },
  })

  const selectedTagIds = watch("tagIds") || []

  // Fetch available tags
  useEffect(() => {
    if (open) {
      fetch("/api/tags")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch tags")
          return res.json()
        })
        .then((data) => {
          if (data.tags) {
            setTags(data.tags)
          }
        })
        .catch((error) => {
          console.error("Error fetching tags:", error)
          // Tags might not exist yet, that's okay
        })
    }
  }, [open])

  // Reset form when contact changes
  useEffect(() => {
    if (contact) {
      reset({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        email: contact.email || "",
        phone: contact.phone,
        address: contact.address || "",
        notes: contact.notes || "",
        leadSource: contact.leadSource || "",
        tagIds: contact.tags.map((t) => t.id),
      })
    } else {
      reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        leadSource: "",
        tagIds: [],
      })
    }
  }, [contact, reset])

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true)
    try {
      const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts"
      const method = contact ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          email: data.email || null,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          address: data.address || null,
          notes: data.notes || null,
          leadSource: data.leadSource === "none" || !data.leadSource ? null : data.leadSource,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save contact")
      }

      toast.success(contact ? "Contact updated successfully" : "Contact created successfully")
      onClose(true)
    } catch (error: any) {
      toast.error(error.message || "Failed to save contact")
    } finally {
      setLoading(false)
    }
  }

  const toggleTag = (tagId: string) => {
    const current = selectedTagIds
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    setValue("tagIds", updated)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
          <DialogDescription>
            {contact
              ? "Update contact information below."
              : "Fill in the contact information below. Phone number is required."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...register("firstName")}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...register("lastName")}
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+1234567890"
              required
            />
            {errors.phone && (
              <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Main St, City, State"
            />
          </div>

          <div>
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select
              value={watch("leadSource") || "none"}
              onValueChange={(value) => setValue("leadSource", value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select lead source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="CSV Import">CSV Import</SelectItem>
                <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="Referral">Referral</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-accent"
                    }`}
                    style={
                      selectedTagIds.includes(tag.id) && tag.color
                        ? { backgroundColor: tag.color, borderColor: tag.color }
                        : {}
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes about this contact..."
              rows={3}
            />
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
              {loading ? "Saving..." : contact ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

