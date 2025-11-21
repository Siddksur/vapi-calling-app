#!/usr/bin/env node

const { execSync } = require('child_process');
const { spawn } = require('child_process');

console.log('🔄 Running database migrations...');

try {
  // Run migrations
  execSync('npx prisma migrate deploy', { 
    stdio: 'inherit',
    env: process.env 
  });
  console.log('✅ Migrations completed successfully');
} catch (error) {
  // If migration fails, log but continue (might be already applied)
  console.log('⚠️ Migration failed or already applied, continuing...');
  console.error(error.message);
}

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

