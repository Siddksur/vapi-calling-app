import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('ssl') ? { rejectUnauthorized: false } : false
})

const prisma = new PrismaClient()

async function checkUser() {
  try {
    const ownerEmail = process.env.OWNER_EMAIL || 'admin@leadcallr.ai'
    const ownerPassword = process.env.OWNER_PASSWORD || 'leadcallr123!'
    
    console.log('🔍 Checking user...')
    console.log(`Email: ${ownerEmail}`)
    console.log(`Password: ${ownerPassword}`)
    
    // Check via Prisma
    const user = await prisma.user.findUnique({
      where: { email: ownerEmail },
      include: { tenant: true }
    })
    
    if (!user) {
      console.log('❌ User not found in database!')
      console.log('\n📋 Creating user now...')
      
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
      
      console.log('✅ User created:', newUser.email)
      console.log('✅ User ID:', newUser.id)
      console.log('✅ Role:', newUser.role)
    } else {
      console.log('✅ User found!')
      console.log('  - ID:', user.id)
      console.log('  - Email:', user.email)
      console.log('  - Name:', user.name)
      console.log('  - Role:', user.role)
      console.log('  - Is Active:', user.isActive)
      console.log('  - Tenant ID:', user.tenantId)
      
      // Test password
      console.log('\n🔐 Testing password...')
      const isValid = await bcrypt.compare(ownerPassword, user.password)
      console.log('  Password match:', isValid ? '✅ YES' : '❌ NO')
      
      if (!isValid) {
        console.log('\n⚠️  Password doesn\'t match! Updating password...')
        const newHash = await bcrypt.hash(ownerPassword, 10)
        await prisma.user.update({
          where: { id: user.id },
          data: { password: newHash }
        })
        console.log('✅ Password updated!')
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

checkUser()




