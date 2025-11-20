import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function fixCampaignsSchema() {
  const client = await pool.connect()
  
  try {
    console.log('📋 Adding missing columns to campaigns table...')
    
    // Check and add columns
    const columns = [
      { name: 'deletedAt', type: 'TIMESTAMP(3)', default: null },
      { name: 'isActive', type: 'BOOLEAN', default: 'true' },
      { name: 'createdAt', type: 'TIMESTAMP(3)', default: 'CURRENT_TIMESTAMP' },
      { name: 'updatedAt', type: 'TIMESTAMP(3)', default: 'CURRENT_TIMESTAMP' },
      { name: 'name', type: 'TEXT', default: null },
      { name: 'description', type: 'TEXT', default: null },
      { name: 'scheduleDays', type: 'INTEGER[]', default: null },
      { name: 'scheduleFrequency', type: 'TEXT', default: null },
      { name: 'timeZone', type: 'TEXT', default: "'UTC'" },
      { name: 'startTime', type: 'TEXT', default: null },
      { name: 'endTime', type: 'TEXT', default: null },
    ]
    
    for (const col of columns) {
      const check = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' AND column_name = $1
      `, [col.name])
      
      if (check.rows.length === 0) {
        const defaultClause = col.default ? `DEFAULT ${col.default}` : ''
        await client.query(`
          ALTER TABLE campaigns 
          ADD COLUMN "${col.name}" ${col.type} ${defaultClause}
        `)
        console.log(`  ✅ Added column: ${col.name}`)
      } else {
        console.log(`  ⏭️  Column already exists: ${col.name}`)
      }
    }
    
    // Map existing snake_case columns to camelCase
    // Update deletedAt from deleted_at
    await client.query(`
      UPDATE campaigns 
      SET "deletedAt" = deleted_at 
      WHERE "deletedAt" IS NULL AND deleted_at IS NOT NULL
    `)
    
    // Update createdAt from created_at
    await client.query(`
      UPDATE campaigns 
      SET "createdAt" = created_at 
      WHERE "createdAt" IS NULL AND created_at IS NOT NULL
    `)
    
    // Set defaults for new columns
    await client.query(`
      UPDATE campaigns 
      SET "isActive" = true,
          "updatedAt" = COALESCE(created_at, NOW())
      WHERE "isActive" IS NULL
    `)
    
    console.log('✅ Campaigns table schema updated!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixCampaignsSchema()




