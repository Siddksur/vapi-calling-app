import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function createCampaignTemplatesTable() {
  try {
    console.log('🔍 Creating campaign_templates table...')

    // Create campaign_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_templates (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "assistantId" VARCHAR(255),
        "phoneNumberId" VARCHAR(255),
        "isActive" BOOLEAN DEFAULT true,
        "scheduleDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
        "scheduleFrequency" VARCHAR(50),
        "timeZone" VARCHAR(100) DEFAULT 'UTC',
        "startTime" VARCHAR(10),
        "endTime" VARCHAR(10),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "campaign_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE
      );
    `)
    console.log('✅ campaign_templates table created')

    // Create index on tenantId
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "campaign_templates_tenantId_idx" ON campaign_templates("tenantId");
    `)
    console.log('✅ Index created on tenantId')

    console.log('\n✅ Campaign templates table created successfully!')

  } catch (error: any) {
    console.error('❌ Error creating campaign_templates table:', error.message)
  } finally {
    await pool.end()
  }
}

createCampaignTemplatesTable()




