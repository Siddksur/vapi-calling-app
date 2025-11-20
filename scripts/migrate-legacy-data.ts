/**
 * Migration script to transfer data from legacy PostgreSQL schema to new multi-tenant schema
 * 
 * This script:
 * 1. Creates a default tenant for existing data
 * 2. Creates an OWNER user account
 * 3. Migrates all existing campaigns, calls, assistants, and phone_numbers
 * 4. Preserves all existing data
 */

import { PrismaClient, UserRole, PlanType } from '@prisma/client'
import { Pool } from 'pg'
import 'dotenv/config'

const prisma = new PrismaClient()
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function migrateLegacyData() {
  console.log('🚀 Starting legacy data migration...\n')

  try {
    // Step 1: Create default tenant for existing data (using raw SQL since Prisma might not be synced)
    console.log('📋 Step 1: Creating default tenant...')
    
    // First check if tenant exists using raw SQL
    const tenantCheck = await pool.query(`
      SELECT id FROM tenants WHERE slug = 'default-tenant' LIMIT 1
    `)
    
    let defaultTenantId: string
    
    if (tenantCheck.rows.length > 0) {
      defaultTenantId = tenantCheck.rows[0].id
      console.log(`✅ Default tenant already exists: ${defaultTenantId}`)
    } else {
      // Create tenant using raw SQL
      defaultTenantId = '00000000-0000-0000-0000-000000000000'
      await pool.query(`
        INSERT INTO tenants (id, name, slug, "planType", "isActive", "createdAt", "updatedAt")
        VALUES ($1, 'Default Tenant', 'default-tenant', 'BASIC', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [defaultTenantId])
      console.log(`✅ Created default tenant: ${defaultTenantId}`)
    }
    
    // Now get it via Prisma for type safety
    const defaultTenant = await prisma.tenant.findUnique({
      where: { id: defaultTenantId }
    })
    
    if (!defaultTenant) {
      throw new Error('Failed to create or find default tenant')
    }

    // Step 2: Create OWNER user if it doesn't exist
    console.log('\n📋 Step 2: Creating/verifying OWNER user...')
    const ownerEmail = process.env.OWNER_EMAIL || 'admin@leadcallr.ai'
    const ownerPassword = process.env.OWNER_PASSWORD || 'changeme123'

    let ownerUser = await prisma.user.findUnique({
      where: { email: ownerEmail }
    })

    if (!ownerUser) {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(ownerPassword, 10)
      
      ownerUser = await prisma.user.create({
        data: {
          email: ownerEmail,
          name: 'Platform Owner',
          password: hashedPassword,
          role: UserRole.OWNER,
          isActive: true,
        }
      })
      console.log(`✅ Created OWNER user: ${ownerEmail}`)
      console.log(`⚠️  IMPORTANT: Change the default password for ${ownerEmail}`)
    } else {
      console.log(`✅ OWNER user already exists: ${ownerEmail}`)
    }

    // Step 3: Migrate assistants (using raw SQL since schema doesn't match yet)
    console.log('\n📋 Step 3: Migrating assistants...')
    const legacyAssistants = await pool.query(`
      SELECT id, name, description, is_active, created_at, updated_at, "tenantId"
      FROM assistants
    `)

    let assistantsMigrated = 0
    for (const assistant of legacyAssistants.rows) {
      // Check if already migrated (has tenantId)
      if (!assistant.tenantId) {
        await pool.query(`
          UPDATE assistants 
          SET "tenantId" = $1,
              "updatedAt" = COALESCE(updated_at, NOW())
          WHERE id = $2
        `, [defaultTenant.id, assistant.id])
        assistantsMigrated++
      }
    }
    console.log(`✅ Migrated ${assistantsMigrated} assistants (${legacyAssistants.rows.length} total)`)

    // Step 4: Migrate phone numbers (using raw SQL)
    console.log('\n📋 Step 4: Migrating phone numbers...')
    const legacyPhoneNumbers = await pool.query(`
      SELECT id, display_name, phone_number, is_active, created_at, updated_at, "tenantId"
      FROM phone_numbers
    `)

    let phoneNumbersMigrated = 0
    for (const phone of legacyPhoneNumbers.rows) {
      if (!phone.tenantId) {
        await pool.query(`
          UPDATE phone_numbers 
          SET "tenantId" = $1,
              "updatedAt" = COALESCE(updated_at, NOW())
          WHERE id = $2
        `, [defaultTenant.id, phone.id])
        phoneNumbersMigrated++
      }
    }
    console.log(`✅ Migrated ${phoneNumbersMigrated} phone numbers (${legacyPhoneNumbers.rows.length} total)`)

    // Step 5: Migrate campaigns (using raw SQL)
    console.log('\n📋 Step 5: Migrating campaigns...')
    const legacyCampaigns = await pool.query(`
      SELECT id, assistant_id, phone_number_id, created_at, deleted_at, "tenantId"
      FROM campaigns
      WHERE deleted_at IS NULL
    `)

    let campaignsMigrated = 0
    for (const campaign of legacyCampaigns.rows) {
      if (!campaign.tenantId) {
        // Ensure campaign has an id (UUID)
        const campaignId = campaign.id || require('crypto').randomUUID()
        await pool.query(`
          UPDATE campaigns 
          SET "tenantId" = $1,
              id = COALESCE(id, $2),
              "createdAt" = COALESCE(created_at, NOW()),
              "updatedAt" = NOW(),
              "isActive" = true
          WHERE id = $3 OR (id IS NULL AND assistant_id = $4 AND phone_number_id = $5)
        `, [defaultTenant.id, campaignId, campaign.id, campaign.assistant_id, campaign.phone_number_id])
        campaignsMigrated++
      }
    }
    console.log(`✅ Migrated ${campaignsMigrated} campaigns (${legacyCampaigns.rows.length} total)`)

    // Step 6: Migrate calls (just add tenantId using raw SQL)
    console.log('\n📋 Step 6: Migrating calls...')
    
    // Just update existing calls to have tenantId
    const callsUpdate = await pool.query(`
      UPDATE calls 
      SET "tenantId" = $1
      WHERE "tenantId" IS NULL
    `, [defaultTenant.id])
    
    const callsMigrated = callsUpdate.rowCount || 0
    console.log(`✅ Updated ${callsMigrated} calls with tenantId`)

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   - Default Tenant: ${defaultTenant.id}`)
    console.log(`   - OWNER User: ${ownerEmail}`)
    console.log(`   - Assistants: ${assistantsMigrated}`)
    console.log(`   - Phone Numbers: ${phoneNumbersMigrated}`)
    console.log(`   - Campaigns: ${campaignsMigrated}`)
    console.log(`   - Calls: ${callsMigrated}`)
    console.log('\n⚠️  Next steps:')
    console.log('   1. Run: npm run db:generate')
    console.log('   2. Create client tenants and users as needed')
    console.log('   3. Update OWNER password if using default')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

// Run migration
migrateLegacyData()
  .then(() => {
    console.log('\n✨ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error)
    process.exit(1)
  })

