import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { VAPIVariablesManager } from "@/components/settings/vapi-variables-manager"

export default async function VAPIVariablesPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Redirect OWNER to admin dashboard
  if (session.user.role === "OWNER") {
    redirect("/admin")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">VAPI Custom Variables</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Add custom variables that will be sent to your VAPI assistant with every call.
            These variables will be merged with default variables (name, customer.number, address, email).
          </p>
        </div>

        <VAPIVariablesManager />
      </div>
    </DashboardLayout>
  )
}

