# Railway Database Persistence Setup

## The Problem
Railway uses **ephemeral filesystems** - this means every time you deploy, the container is recreated and all files (including your SQLite database) are wiped clean.

## Solutions

### Option 1: Use Railway Persistent Volume (Recommended for SQLite)

1. **In Railway Dashboard:**
   - Go to your service
   - Click on "Volumes" tab
   - Click "Add Volume"
   - Name it `database-storage`
   - Mount it to `/data` (or any path you prefer)

2. **Update your code:**
   - Set environment variable: `DATABASE_PATH=/data/calls.db`
   - Or update `server.js` to use `/data/calls.db` as the path

3. **The database will now persist across deployments!**

### Option 2: Use Railway PostgreSQL (Recommended for Production)

1. **Add PostgreSQL Service:**
   - In Railway dashboard, click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically provide connection string in environment variables

2. **Update your code:**
   - Install: `npm install pg` (PostgreSQL driver)
   - Replace SQLite with PostgreSQL queries
   - Use `process.env.DATABASE_URL` for connection

3. **Benefits:**
   - Automatic backups
   - Better for production
   - Scales better
   - No data loss on deployments

### Option 3: Use External Database Service

Use services like:
- **Supabase** (free tier available)
- **PlanetScale** (MySQL, free tier)
- **Neon** (PostgreSQL, free tier)
- **Railway PostgreSQL** (easiest integration)

## Current Status

✅ **Fixed:** Removed `DROP TABLE` statement that was wiping data on every restart
⚠️ **Still Needed:** Set up persistent storage or external database

## Quick Fix for Now

If you want to keep using SQLite temporarily, you can:

1. Add a Railway Volume mounted to `/data`
2. Set environment variable: `DATABASE_PATH=/data/calls.db`
3. Redeploy

This will preserve your database across deployments.

