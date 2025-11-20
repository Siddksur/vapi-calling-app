"use client"

import { Tenant, PlanType } from "@prisma/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Eye, Edit, Building2, Key, AlertCircle } from "lucide-react"

interface ClientTableProps {
  tenants: (Tenant & {
    _count: {
      users: number
      campaigns: number
      calls: number
    }
    subscription?: any // Optional until subscriptions table is created
  })[]
}

function VAPIConfigStatus({ tenant }: { tenant: Partial<Tenant> }) {
  // Safely check VAPI config with optional chaining
  const hasConfig = !!(tenant.vapiPrivateKey && tenant.vapiOrganizationId)
  
  if (hasConfig) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-green-700 border-green-300">
        <Key className="h-3 w-3" />
        VAPI Configured
      </Badge>
    )
  }
  
  return (
    <Badge variant="outline" className="flex items-center gap-1 text-amber-700 border-amber-300">
      <AlertCircle className="h-3 w-3" />
      VAPI Not Configured
    </Badge>
  )
}

export function ClientTable({ tenants }: ClientTableProps) {
  const planColors: Record<PlanType, string> = {
    BASIC: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    PRO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    ENTERPRISE: "bg-gold-100 text-gold-800 dark:bg-gold-900 dark:text-gold-200",
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>VAPI Config</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Campaigns</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                No clients found. Create your first client to get started.
              </TableCell>
            </TableRow>
          ) : (
            tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {tenant.name}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {tenant.slug}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge className={planColors[tenant.planType]}>
                    {tenant.planType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={tenant.isActive ? "default" : "secondary"}
                  >
                    {tenant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <VAPIConfigStatus tenant={tenant} />
                </TableCell>
                <TableCell>{tenant._count.users}</TableCell>
                <TableCell>{tenant._count.campaigns}</TableCell>
                <TableCell>{tenant._count.calls.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/admin/clients/${tenant.id}`}>
                      <Button variant="ghost" size="sm" title="View & Configure">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

