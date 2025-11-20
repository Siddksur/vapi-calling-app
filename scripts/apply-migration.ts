import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, '../prisma/migrations/0001_add_multi_tenant/migration.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    
    console.log('Applying migration...')
    await pool.query(sql)
    console.log('✅ Migration applied successfully!')
    console.log('\n📋 Next steps:')
    console.log('1. Run: npm run migrate:legacy')
    console.log('2. This will create an OWNER user and migrate your existing data')
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

applyMigration()




