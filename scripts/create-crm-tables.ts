import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function createCRMTables() {
  try {
    console.log('🔍 Creating CRM tables and columns...')

    // 1. Create contacts table
    console.log('📋 Creating contacts table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId" TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        email TEXT,
        phone TEXT NOT NULL,
        address TEXT,
        notes TEXT,
        "leadSource" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE
      )
    `)

    // Create indexes for contacts
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contacts_tenantId_idx" ON contacts("tenantId")
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contacts_phone_idx" ON contacts(phone)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON contacts(email)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contacts_leadSource_idx" ON contacts("leadSource")
    `)
    console.log('✅ Contacts table created')

    // 2. Create tags table
    console.log('📋 Creating tags table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "tenantId" TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT "tags_tenantId_name_key" UNIQUE ("tenantId", name)
      )
    `)

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "tags_tenantId_idx" ON tags("tenantId")
    `)
    console.log('✅ Tags table created')

    // 3. Create contact_tags junction table
    console.log('📋 Creating contact_tags table...')
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_tags (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "contactId" TEXT NOT NULL,
        "tagId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE CASCADE,
        CONSTRAINT "contact_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES tags(id) ON DELETE CASCADE,
        CONSTRAINT "contact_tags_contactId_tagId_key" UNIQUE ("contactId", "tagId")
      )
    `)

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contact_tags_contactId_idx" ON contact_tags("contactId")
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "contact_tags_tagId_idx" ON contact_tags("tagId")
    `)
    console.log('✅ Contact_tags table created')

    // 4. Add contactId column to calls table
    console.log('📋 Adding contactId column to calls table...')
    await pool.query(`
      ALTER TABLE calls 
      ADD COLUMN IF NOT EXISTS "contactId" TEXT
    `)

    // Add foreign key constraint if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE calls 
        ADD CONSTRAINT "calls_contactId_fkey" 
        FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE SET NULL
      `)
    } catch (err: any) {
      if (err.code !== '42710' && !err.message.includes('already exists')) {
        throw err
      }
      console.log('   Foreign key constraint already exists or column already has constraint')
    }

    await pool.query(`
      CREATE INDEX IF NOT EXISTS "calls_contactId_idx" ON calls("contactId")
    `)
    console.log('✅ contactId column added to calls table')

    console.log('\n✅ All CRM tables and columns created successfully!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await pool.end()
  }
}

createCRMTables()




