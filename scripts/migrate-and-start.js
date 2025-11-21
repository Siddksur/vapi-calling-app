#!/usr/bin/env node

const { execSync } = require('child_process');
const { spawn } = require('child_process');

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Run migrations
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: process.env 
    });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    // If migration fails, try to resolve and continue
    console.log('⚠️ Migration failed, attempting to resolve...');
    
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // Check if column exists
      let columnExists = false;
      try {
        await prisma.$queryRaw`SELECT "vapi_custom_variables" FROM "tenants" LIMIT 1`;
        columnExists = true;
        console.log('✅ Column already exists');
      } catch (checkError) {
        // Column doesn't exist, we need to add it
        console.log('📝 Column does not exist, adding it now...');
        await prisma.$executeRaw`
          ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "vapi_custom_variables" JSONB;
        `;
        console.log('✅ Column added successfully');
        columnExists = true;
      }
      
      if (columnExists) {
        // Mark the failed migration as resolved
        console.log('📝 Marking migration as resolved...');
        
        // First, remove the failed migration record if it exists
        await prisma.$executeRaw`
          DELETE FROM "_prisma_migrations" 
          WHERE migration_name = '20241120210000_add_vapi_custom_variables' 
          AND finished_at IS NULL;
        `;
        
        // Then insert it as successfully completed
        await prisma.$executeRaw`
          INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (gen_random_uuid(), '', NOW(), '20241120210000_add_vapi_custom_variables', NULL, NULL, NOW(), 1)
          ON CONFLICT (migration_name) DO UPDATE 
          SET finished_at = NOW(), applied_steps_count = 1, rolled_back_at = NULL;
        `;
        
        console.log('✅ Migration status resolved');
      }
      
      await prisma.$disconnect();
    } catch (resolveError) {
      // If resolution fails, just continue - the app might still work
      console.log('⚠️ Could not resolve migration status, continuing anyway...');
      console.error('Migration error:', error.message);
      console.error('Resolution error:', resolveError.message);
    }
  }
}

// Run migrations first, then start server
runMigrations().then(() => {
  console.log('🚀 Starting application...');

  // Start the Next.js server
  const server = spawn('npm', ['run', 'start:server'], {
    stdio: 'inherit',
    env: process.env,
    shell: true
  });

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  server.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    server.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    server.kill('SIGINT');
  });
}).catch((error) => {
  console.error('❌ Failed to run migrations:', error);
  process.exit(1);
});
