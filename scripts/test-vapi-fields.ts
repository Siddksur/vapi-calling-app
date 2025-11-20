import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    console.log('Testing VAPI fields in Prisma client...')
    
    // Try to query with VAPI fields
    const tenant = await prisma.tenant.findFirst({
      select: {
        id: true,
        name: true,
        vapiPrivateKey: true,
        vapiOrganizationId: true,
        vapiBaseUrl: true,
      }
    })
    
    console.log('✅ Prisma client recognizes VAPI fields!')
    console.log('Sample tenant:', tenant ? { id: tenant.id, name: tenant.name, hasVAPI: !!tenant.vapiPrivateKey } : 'No tenants found')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('vapiPrivateKey')) {
      console.error('The VAPI fields are not recognized by Prisma client')
      console.error('Try running: npm run db:generate')
    }
  } finally {
    await prisma.$disconnect()
  }
}

test()




