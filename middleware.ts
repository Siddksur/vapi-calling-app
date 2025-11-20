import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const session = req.auth
  const pathname = req.nextUrl.pathname

  // Public routes
  if (pathname === "/login" || pathname === "/" || pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  // Protected routes require authentication
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Owner routes - only accessible by OWNER role
  if (pathname.startsWith("/admin") || pathname.startsWith("/owner")) {
    if (session.user?.role !== "OWNER") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  // Client routes - require tenantId for CLIENT role
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/campaigns") || pathname.startsWith("/calls")) {
    if (session.user?.role === "CLIENT" && !session.user?.tenantId) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
