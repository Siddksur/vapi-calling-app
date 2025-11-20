import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Missing credentials")
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        console.log(`🔍 Attempting login for: ${email}`)

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: true }
        })

        if (!user) {
          console.log(`❌ User not found: ${email}`)
          return null
        }

        if (!user.isActive) {
          console.log(`❌ User inactive: ${email}`)
          return null
        }

        // Check password
        const isValidPassword = await bcrypt.compare(
          password,
          user.password
        )

        if (!isValidPassword) {
          console.log(`❌ Invalid password for: ${email}`)
          return null
        }

        console.log(`✅ Login successful for: ${email} (${user.role})`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tenantId = user.tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.tenantId = token.tenantId as string | null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true, // Required for Railway/proxy environments
})

// Export authOptions for compatibility
export const authOptions = {
  // This is kept for reference but NextAuth v5 uses the auth() function
}

