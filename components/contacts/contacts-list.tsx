"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Eye } from "lucide-react"
import { ContactDialog } from "./contact-dialog"
import { ManualCallDialog } from "./manual-call-dialog"
import { toast } from "sonner"
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

interface ContactsListProps {
  initialContacts: Contact[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  initialTags?: Array<{ id: string; name: string; color: string | null }>
}

export function ContactsList({ initialContacts, initialPagination, initialTags = [] }: ContactsListProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [pagination, setPagination] = useState(initialPagination)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [leadSourceFilter, setLeadSourceFilter] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [tags, setTags] = useState(initialTags)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [isManualCallDialogOpen, setIsManualCallDialogOpen] = useState(false)
  const [callingContact, setCallingContact] = useState<Contact | null>(null)

  const fetchContacts = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(leadSourceFilter && { leadSource: leadSourceFilter }),
        ...(tagFilter && { tagId: tagFilter })
      })

      const response = await fetch(`/api/contacts?${params}`)
      if (!response.ok) throw new Error("Failed to fetch contacts")

      const data = await response.json()
      setContacts(data.contacts)
      setPagination(data.pagination)
    } catch (error) {
      toast.error("Failed to load contacts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts(1)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [search, leadSourceFilter, tagFilter])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete contact")

      toast.success("Contact deleted successfully")
      fetchContacts(pagination.page)
    } catch (error) {
      toast.error("Failed to delete contact")
    }
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setIsDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingContact(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = (saved: boolean) => {
    setIsDialogOpen(false)
    setEditingContact(null)
    if (saved) {
      fetchContacts(pagination.page)
    }
  }

  const handleManualCall = (contact: Contact) => {
    setCallingContact(contact)
    setIsManualCallDialogOpen(true)
  }

  const handleManualCallDialogClose = (called: boolean) => {
    setIsManualCallDialogOpen(false)
    setCallingContact(null)
    if (called) {
      fetchContacts(pagination.page)
    }
  }

  const getFullName = (contact: Contact) => {
    if (contact.firstName || contact.lastName) {
      return [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    }
    return "Unnamed Contact"
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select 
            value={leadSourceFilter === "" ? "all" : leadSourceFilter} 
            onValueChange={(value) => setLeadSourceFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Lead Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lead Sources</SelectItem>
              <SelectItem value="Manual">Manual</SelectItem>
              <SelectItem value="CSV Import">CSV Import</SelectItem>
              <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
            </SelectContent>
          </Select>
          {tags.length > 0 && (
            <Select 
              value={tagFilter === "" ? "all" : tagFilter} 
              onValueChange={(value) => setTagFilter(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Contacts Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Lead Source</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    {getFullName(contact)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="truncate max-w-xs">{contact.address}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.leadSource ? (
                      <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">
                        {contact.leadSource}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
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
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{contact.callCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualCall(contact)}
                        title="Make Call"
                      >
                        <Phone className="h-4 w-4 text-green-600" />
                      </Button>
                      <Link href={`/contacts/${contact.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Timeline"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} contacts
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchContacts(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchContacts(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <ContactDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        contact={editingContact}
      />

      {/* Manual Call Dialog */}
      {callingContact && (
        <ManualCallDialog
          open={isManualCallDialogOpen}
          onClose={handleManualCallDialogClose}
          contact={callingContact}
        />
      )}
    </div>
  )
}

