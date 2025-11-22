import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()

async function fixAdminUser() {
  try {
    const ownerEmail = process.env.OWNER_EMAIL || 'admin@leadcallr.ai'
    
    console.log('🔍 Checking user:', ownerEmail)
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: ownerEmail }
    })
    
    if (!user) {
      console.log('❌ User not found!')
      console.log('📋 Creating OWNER user...')
      
      const ownerPassword = process.env.OWNER_PASSWORD || 'leadcallr123!'
      const hashedPassword = await bcrypt.hash(ownerPassword, 10)
      
      const newUser = await prisma.user.create({
        data: {
          email: ownerEmail,
          name: 'Platform Owner',
          password: hashedPassword,
          role: 'OWNER',
          isActive: true,
        }
      })
      
      console.log('✅ Created OWNER user:', newUser.email)
      console.log('✅ Role:', newUser.role)
      return
    }
    
    console.log('✅ User found!')
    console.log('  - Current role:', user.role)
    console.log('  - Is active:', user.isActive)
    
    if (user.role !== 'OWNER') {
      console.log('⚠️  User has wrong role. Updating to OWNER...')
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'OWNER',
          tenantId: null, // OWNER users don't have a tenant
        }
      })
      
      console.log('✅ Updated user role to OWNER')
    } else {
      console.log('✅ User already has OWNER role')
    }
    
    // Ensure tenantId is null for OWNER
    if (user.tenantId !== null) {
      console.log('⚠️  Removing tenantId from OWNER user...')
      await prisma.user.update({
        where: { id: user.id },
        data: {
          tenantId: null
        }
      })
      console.log('✅ Removed tenantId')
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixAdminUser()
  .then(() => {
    console.log('✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })




