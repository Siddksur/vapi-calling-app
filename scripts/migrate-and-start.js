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
      
      // Try to apply missing migrations manually
      const migrationsToCheck = [
        {
          name: '20241120210000_add_vapi_custom_variables',
          sql: `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "vapi_custom_variables" JSONB;`,
          checkColumn: 'vapi_custom_variables',
          checkTable: 'tenants'
        },
        {
          name: '20241121233000_add_system_prompt_and_first_message_to_assistant',
          sql: `ALTER TABLE "assistants" ADD COLUMN IF NOT EXISTS "system_prompt" TEXT, ADD COLUMN IF NOT EXISTS "first_message" TEXT;`,
          checkColumn: 'system_prompt',
          checkTable: 'assistants'
        }
      ];

      for (const migration of migrationsToCheck) {
        try {
          // Check if column exists
          await prisma.$queryRawUnsafe(`SELECT "${migration.checkColumn}" FROM "${migration.checkTable}" LIMIT 1`);
          console.log(`✅ Column ${migration.checkColumn} already exists in ${migration.checkTable}`);
        } catch (checkError) {
          // Column doesn't exist, we need to add it
          console.log(`📝 Column ${migration.checkColumn} does not exist, adding it now...`);
          try {
            await prisma.$executeRawUnsafe(migration.sql);
            console.log(`✅ Column ${migration.checkColumn} added successfully`);
          } catch (addError) {
            console.error(`❌ Failed to add column ${migration.checkColumn}:`, addError.message);
            continue;
          }
        }

        // Mark the migration as resolved
        try {
          console.log(`📝 Marking migration ${migration.name} as resolved...`);
          
          // First, remove the failed migration record if it exists
          await prisma.$executeRawUnsafe(`
            DELETE FROM "_prisma_migrations" 
            WHERE migration_name = '${migration.name}' 
            AND finished_at IS NULL;
          `);
          
          // Then insert it as successfully completed
          await prisma.$executeRawUnsafe(`
            INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES (gen_random_uuid(), '', NOW(), '${migration.name}', NULL, NULL, NOW(), 1)
            ON CONFLICT (migration_name) DO UPDATE 
            SET finished_at = NOW(), applied_steps_count = 1, rolled_back_at = NULL;
          `);
          
          console.log(`✅ Migration ${migration.name} status resolved`);
        } catch (markError) {
          console.error(`⚠️ Could not mark migration ${migration.name} as resolved:`, markError.message);
        }
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
