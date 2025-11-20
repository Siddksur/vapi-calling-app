import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'campaigns' 
      ORDER BY ordinal_position
    `)
    
    console.log('Campaigns table columns:')
    result.rows.forEach(r => {
      console.log(`  - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`)
    })
    
  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkSchema()




