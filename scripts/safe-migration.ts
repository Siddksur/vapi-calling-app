import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function safeMigration() {
  const client = await pool.connect()
  
  try {
    console.log('📋 Step 0: Creating enum types...')
    
    // Create enum types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "UserRole" AS ENUM ('OWNER', 'CLIENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "CallStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "CallOutcome" AS ENUM ('SUCCESS', 'NO_ANSWER', 'BUSY', 'FAILED', 'VOICEMAIL', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    
    console.log('  ✅ Created enum types')
    
    console.log('📋 Step 1: Creating tenants table...')
    
    // Check if table exists first
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      try {
        await client.query(`
        CREATE TABLE tenants (
          id TEXT NOT NULL PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          "planType" "PlanType" NOT NULL DEFAULT 'BASIC',
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        `)
        console.log('  ✅ Created tenants table')
      } catch (err: any) {
        console.error('  ❌ Error creating tenants table:', err.message)
        throw err
      }
    } else {
      console.log('  ✅ Tenants table already exists')
    }
    
    await client.query('CREATE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug)')
    await client.query('CREATE INDEX IF NOT EXISTS tenants_isActive_idx ON tenants("isActive")')
    
    console.log('📋 Step 2: Creating default tenant...')
    await client.query(`
      INSERT INTO tenants (id, name, slug, "planType", "isActive", "createdAt", "updatedAt")
      VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default-tenant', 'BASIC', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `)
    
    console.log('📋 Step 3: Creating users table...')
    
    const usersTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `)
    
    if (!usersTableCheck.rows[0].exists) {
      await client.query(`
        CREATE TABLE users (
          id TEXT NOT NULL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          password TEXT NOT NULL,
          role "UserRole" NOT NULL DEFAULT 'CLIENT',
          "tenantId" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('  ✅ Created users table')
    } else {
      console.log('  ✅ Users table already exists')
    }
    
    await client.query('CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)')
    await client.query('CREATE INDEX IF NOT EXISTS users_tenantId_idx ON users("tenantId")')
    await client.query('CREATE INDEX IF NOT EXISTS users_role_idx ON users(role)')
    
    console.log('📋 Step 4: Adding tenantId to existing tables...')
    
    // Add tenantId to assistants
    const assistantsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assistants' AND column_name = 'tenantId'
    `)
    if (assistantsCheck.rows.length === 0) {
      await client.query('ALTER TABLE assistants ADD COLUMN "tenantId" TEXT')
      await client.query('ALTER TABLE assistants ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP')
      await client.query(`
        UPDATE assistants 
        SET "tenantId" = '00000000-0000-0000-0000-000000000000', 
            "updatedAt" = COALESCE(updated_at, NOW())
        WHERE "tenantId" IS NULL
      `)
    }
    
    // Add tenantId to phone_numbers
    const phoneCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'phone_numbers' AND column_name = 'tenantId'
    `)
    if (phoneCheck.rows.length === 0) {
      await client.query('ALTER TABLE phone_numbers ADD COLUMN "tenantId" TEXT')
      await client.query('ALTER TABLE phone_numbers ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP')
      await client.query(`
        UPDATE phone_numbers 
        SET "tenantId" = '00000000-0000-0000-0000-000000000000',
            "updatedAt" = COALESCE(updated_at, NOW())
        WHERE "tenantId" IS NULL
      `)
    }
    
    // Add tenantId to campaigns
    const campaignsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'tenantId'
    `)
    if (campaignsCheck.rows.length === 0) {
      await client.query('ALTER TABLE campaigns ADD COLUMN "tenantId" TEXT')
      await client.query(`
        UPDATE campaigns 
        SET "tenantId" = '00000000-0000-0000-0000-000000000000'
        WHERE "tenantId" IS NULL
      `)
    }
    
    // Add tenantId to calls
    const callsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'calls' AND column_name = 'tenantId'
    `)
    if (callsCheck.rows.length === 0) {
      await client.query('ALTER TABLE calls ADD COLUMN "tenantId" TEXT')
      await client.query(`
        UPDATE calls 
        SET "tenantId" = '00000000-0000-0000-0000-000000000000'
        WHERE "tenantId" IS NULL
      `)
    }
    
    // Add foreign key constraints
    console.log('📋 Step 5: Adding foreign key constraints...')
    await client.query(`
      ALTER TABLE users 
      ADD CONSTRAINT IF NOT EXISTS users_tenantId_fkey 
      FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE
    `).catch(() => {}) // Ignore if constraint already exists
    
    // Verify tables were created
    const verifyTenants = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      )
    `)
    const verifyUsers = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `)
    
    console.log(`✅ Tenants table exists: ${verifyTenants.rows[0].exists}`)
    console.log(`✅ Users table exists: ${verifyUsers.rows[0].exists}`)
    
    if (!verifyTenants.rows[0].exists || !verifyUsers.rows[0].exists) {
      throw new Error('Tables were not created successfully')
    }
    
    console.log('✅ Migration completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Run: npm run migrate:legacy')
    console.log('2. This will create an OWNER user and properly migrate your data')
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    console.error('Stack:', error.stack)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

safeMigration()

