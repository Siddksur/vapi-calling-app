import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function checkAllSchemas() {
  try {
    const tables = ['campaigns', 'calls', 'assistants', 'phone_numbers']
    
    for (const table of tables) {
      console.log(`\n📋 ${table} table columns:`)
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table])
      
      result.rows.forEach(r => {
        console.log(`  - ${r.column_name} (${r.data_type})`)
      })
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkAllSchemas()




