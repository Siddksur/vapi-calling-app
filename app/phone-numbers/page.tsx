import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PhoneNumbersList } from "@/components/phone-numbers/phone-numbers-list"

export default async function PhoneNumbersPage() {
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
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your phone numbers from VAPI
          </p>
        </div>

        <PhoneNumbersList />
      </div>
    </DashboardLayout>
  )
}




