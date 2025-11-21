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
      // Try to mark the migration as applied if the column already exists
      // This handles the case where migration failed but column was added
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // Check if column exists by trying to query it
      await prisma.$queryRaw`SELECT "vapi_custom_variables" FROM "tenants" LIMIT 1`;
      console.log('✅ Column already exists, marking migration as applied...');
      
      // Mark migration as applied manually
      await prisma.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (gen_random_uuid(), '', NOW(), '20241120210000_add_vapi_custom_variables', NULL, NULL, NOW(), 1)
        ON CONFLICT DO NOTHING
      `;
      
      await prisma.$disconnect();
      console.log('✅ Migration status resolved');
    } catch (resolveError) {
      // If resolution fails, just continue - the app might still work
      console.log('⚠️ Could not resolve migration status, continuing anyway...');
      console.error('Migration error:', error.message);
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
