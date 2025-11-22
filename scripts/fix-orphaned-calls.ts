import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixOrphanedCalls() {
  try {
    console.log('🔍 Checking for orphaned calls...')
    
    // Find calls with campaign_id that don't exist in campaigns table
    const orphanedCalls = await prisma.$queryRaw<Array<{ id: number; campaign_id: string }>>`
      SELECT c.id, c.campaign_id
      FROM calls c
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
      WHERE c.campaign_id IS NOT NULL
      AND camp.id IS NULL
    `
    
    if (orphanedCalls.length === 0) {
      console.log('✅ No orphaned calls found!')
      return
    }
    
    console.log(`⚠️  Found ${orphanedCalls.length} orphaned calls`)
    
    // Set campaign_id to NULL for orphaned calls
    const result = await prisma.$executeRaw`
      UPDATE calls
      SET campaign_id = NULL
      WHERE id IN (
        SELECT c.id
        FROM calls c
        LEFT JOIN campaigns camp ON c.campaign_id = camp.id
        WHERE c.campaign_id IS NOT NULL
        AND camp.id IS NULL
      )
    `
    
    console.log(`✅ Fixed ${result} orphaned calls (set campaign_id to NULL)`)
    
  } catch (error) {
    console.error('❌ Error fixing orphaned calls:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixOrphanedCalls()
  .then(() => {
    console.log('✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })




