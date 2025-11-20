import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { AssistantsList } from "@/components/assistants/assistants-list"

export default async function AssistantsPage() {
  const session = await auth()

  if (!session?.user) {
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
          <h1 className="text-3xl font-bold">Assistants</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your AI assistants from VAPI
          </p>
        </div>

        <AssistantsList />
      </div>
    </DashboardLayout>
  )
}



