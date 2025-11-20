import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function createClientUser() {
  try {
    console.log('🔍 Checking for Default Tenant...')
    
    const defaultTenant = await prisma.tenant.findFirst({
      where: { slug: 'default-tenant' }
    })

    if (!defaultTenant) {
      console.error('❌ Default tenant not found!')
      return
    }

    console.log(`✅ Found Default Tenant: ${defaultTenant.name} (${defaultTenant.id})`)

    // Check if CLIENT user already exists using raw SQL
    const existingClientResult = await pool.query(
      `SELECT * FROM users WHERE "tenantId" = $1 AND role = $2 LIMIT 1`,
      [defaultTenant.id, 'CLIENT']
    )
    
    const existingClient = existingClientResult.rows[0]

    if (existingClient) {
      console.log(`✅ CLIENT user already exists: ${existingClient.email}`)
      console.log(`   You can log in with:`)
      console.log(`   Email: ${existingClient.email}`)
      console.log(`   Password: (check your .env for CLIENT_PASSWORD or use the one you set)`)
      await pool.end()
      return
    }

    // Create CLIENT user for Default Tenant
    const clientEmail = process.env.CLIENT_EMAIL || `client@${defaultTenant.slug.replace('-', '.')}`
    const clientPassword = process.env.CLIENT_PASSWORD || 'client123!'
    const clientName = process.env.CLIENT_NAME || 'Default Client User'

    console.log(`\n📋 Creating CLIENT user for Default Tenant...`)
    console.log(`   Email: ${clientEmail}`)
    console.log(`   Name: ${clientName}`)

    const hashedPassword = await bcrypt.hash(clientPassword, 10)
    const userId = require('crypto').randomUUID()

    // Create user using raw SQL to avoid enum issues
    await pool.query(
      `INSERT INTO users (id, email, name, password, role, "tenantId", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [userId, clientEmail, clientName, hashedPassword, 'CLIENT', defaultTenant.id, true]
    )

    console.log(`\n✅ CLIENT user created successfully!`)
    console.log(`\n📋 Login Credentials:`)
    console.log(`   Email: ${clientEmail}`)
    console.log(`   Password: ${clientPassword}`)
    console.log(`\n⚠️  IMPORTANT: Change the default password after first login!`)
    console.log(`\n💡 You can set custom credentials in .env:`)
    console.log(`   CLIENT_EMAIL="your-client@email.com"`)
    console.log(`   CLIENT_PASSWORD="your-secure-password"`)
    console.log(`   CLIENT_NAME="Client Name"`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

createClientUser()

