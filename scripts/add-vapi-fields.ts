import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function addVAPIFields() {
  const client = await pool.connect()
  
  try {
    console.log('📋 Adding VAPI configuration fields to tenants table...')
    
    // Add VAPI configuration columns
    const columns = [
      { name: 'vapi_private_key', type: 'TEXT', nullable: true },
      { name: 'vapi_organization_id', type: 'VARCHAR(255)', nullable: true },
      { name: 'vapi_base_url', type: 'VARCHAR(255)', nullable: true, default: "'https://api.vapi.ai'" },
      { name: 'vapi_default_assistant_id', type: 'VARCHAR(255)', nullable: true },
      { name: 'vapi_default_phone_number_id', type: 'VARCHAR(255)', nullable: true },
    ]
    
    for (const col of columns) {
      const check = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = $1
      `, [col.name])
      
      if (check.rows.length === 0) {
        const defaultClause = col.default ? `DEFAULT ${col.default}` : ''
        const nullableClause = col.nullable ? '' : 'NOT NULL'
        await client.query(`
          ALTER TABLE tenants 
          ADD COLUMN "${col.name}" ${col.type} ${defaultClause} ${nullableClause}
        `)
        console.log(`  ✅ Added column: ${col.name}`)
      } else {
        console.log(`  ⏭️  Column already exists: ${col.name}`)
      }
    }
    
    // If default tenant exists and has no VAPI config, optionally migrate from env vars
    const defaultTenant = await client.query(`
      SELECT id, vapi_private_key, vapi_organization_id 
      FROM tenants 
      WHERE slug = 'default-tenant' 
      LIMIT 1
    `)
    
    if (defaultTenant.rows.length > 0 && !defaultTenant.rows[0].vapi_private_key) {
      const envPrivateKey = process.env.VAPI_PRIVATE_KEY
      const envOrgId = process.env.VAPI_ORGANIZATION_ID
      
      if (envPrivateKey && envOrgId) {
        await client.query(`
          UPDATE tenants 
          SET vapi_private_key = $1,
              vapi_organization_id = $2,
              vapi_base_url = COALESCE(vapi_base_url, 'https://api.vapi.ai')
          WHERE id = $3
        `, [envPrivateKey, envOrgId, defaultTenant.rows[0].id])
        console.log('  ✅ Migrated VAPI config from environment variables to default tenant')
      }
    }
    
    console.log('✅ VAPI configuration fields added successfully!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

addVAPIFields()




