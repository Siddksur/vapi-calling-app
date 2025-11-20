# Production Cron Job Options - Complete Guide

When deploying to production, you have **multiple options** for running the call scheduler. Here are all the ways, ranked by ease and reliability.

---

## Option 1: Railway Cron Service (Recommended for Railway)

**Best if:** You're deploying on Railway

Railway has built-in cron job support! You configure it by adding a "Cron Schedule" to a service in the Settings tab.

### How to Set It Up:

**Method A: Using the API Endpoint (Easiest)**

1. **Create a new service**:
   - In your Railway dashboard, click **"+ Create"** (top right)
   - Select **"Empty Service"**
   - Name it: `call-processor`

2. **Configure the service**:
   - **Source**: Connect it to the same GitHub repo as your main app
   - **Root Directory**: Leave as root (same as main app)
   - **Start Command**: 
     ```bash
     curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/cron/process-calls -H "Authorization: Bearer $CRON_SECRET"
     ```
   - **Environment Variables**: 
     - Add `CRON_SECRET` (same value as your main app)
     - Add `DATABASE_URL` (same as your main app)
     - Add `RAILWAY_PUBLIC_DOMAIN` (your app's public domain)

3. **Set the Cron Schedule**:
   - Click on the `call-processor` service
   - Go to the **"Settings"** tab
   - Scroll down to **"Cron Schedule"** section
   - Enter: `* * * * *` (every minute)
   - Save

4. **Deploy!** Railway will automatically run this service every minute.

**Method B: Using the Script Directly (More Reliable)**

1. **Create a new service**:
   - Click **"+ Create"** → **"Empty Service"**
   - Name it: `call-processor`

2. **Configure the service**:
   - **Source**: Same GitHub repo
   - **Root Directory**: Root (same as main app)
   - **Start Command**: `npm run process-calls`
   - **Environment Variables**: 
     - Add all your app's env vars (`DATABASE_URL`, `CRON_SECRET`, etc.)

3. **Set the Cron Schedule**:
   - Go to **Settings** tab
   - **Cron Schedule**: `* * * * *`
   - Save

4. **Deploy!** Railway will run the script every minute.

**Pros:**
- ✅ Built into Railway (no external service needed)
- ✅ Free tier available
- ✅ Automatic scaling
- ✅ Easy to set up

**Cons:**
- ❌ Railway-specific (can't use if you switch platforms)

---

## Option 2: In-App Scheduler (Node-Cron) ✅ **CURRENTLY IMPLEMENTED**

**Best if:** You want everything self-contained in your app

Run the scheduler **inside your Next.js app** using `node-cron`. No external services needed!

### Status: ✅ Already Set Up!

The in-app scheduler is **already implemented** and enabled by default. It will automatically start when you deploy to production.

### How It Works:

1. **`instrumentation.ts`** initializes the scheduler when Next.js starts
2. **`lib/scheduler.ts`** contains the cron logic (runs every minute)
3. **Automatically enabled** in production (or when `ENABLE_IN_APP_SCHEDULER=true`)

### To Disable (When Switching to Worker Service):

Set environment variable:
```bash
ENABLE_IN_APP_SCHEDULER=false
```

### To Switch to Separate Worker Service:

1. Set `ENABLE_IN_APP_SCHEDULER=false` in your main app
2. Create a new Railway service
3. Set start command: `npm run worker`
4. Copy all environment variables
5. Deploy!

See `SCHEDULER_SETUP.md` for detailed migration guide.

**Pros:**
- ✅ No external services needed
- ✅ Works on any platform
- ✅ Self-contained
- ✅ Easy to debug

**Cons:**
- ❌ Requires your app to be running 24/7
- ❌ If app restarts, scheduler restarts (but that's usually fine)

---

## Option 3: External Cron Services

**Best if:** You want separation of concerns or your platform doesn't support cron

### EasyCron (Free tier available)
- Go to: https://www.easycron.com
- Set up as described in `CRON_SETUP_GUIDE.md`
- **Cost**: Free for basic usage, paid for advanced

### GitHub Actions (Free for public repos)
- Create `.github/workflows/process-calls.yml`
- Runs on GitHub's servers
- **Cost**: Free for public repos, free tier for private

### Other Options:
- **Cron-job.org** (Free)
- **Cronitor** (Paid, but has monitoring)
- **Uptime Robot** (Free tier)

**Pros:**
- ✅ Works with any hosting platform
- ✅ Some have monitoring/alerting
- ✅ Separation of concerns

**Cons:**
- ❌ External dependency
- ❌ Some services have rate limits
- ❌ Need to manage another service

---

## Option 4: Vercel Cron (If using Vercel)

**Best if:** You're deploying on Vercel

Vercel has built-in cron support via `vercel.json`.

### How to Set It Up:

1. **Create `vercel.json`** in your project root:
   ```json
   {
     "crons": [{
       "path": "/api/cron/process-calls",
       "schedule": "* * * * *"
     }]
   }
   ```

2. **Deploy to Vercel** - cron jobs are automatically set up!

**Pros:**
- ✅ Built into Vercel
- ✅ Automatic setup
- ✅ Free tier available

**Cons:**
- ❌ Vercel-specific
- ❌ Requires Pro plan for frequent cron jobs (every minute)

---

## Option 5: Separate Worker Service

**Best if:** You want maximum control and scalability

Run the scheduler as a **separate service/container** alongside your Next.js app.

### Railway Setup:

1. **In Railway dashboard**, add a **new service**
2. **Connect it to the same codebase**
3. **Set the start command**: `npm run worker` (or `npm run process-calls`)
4. **Set environment variables** (same as main app)
5. **Deploy!**

This service will:
- Run continuously
- Process calls every minute (or on a schedule)
- Scale independently from your web app

**Pros:**
- ✅ Can scale independently
- ✅ Doesn't affect web app performance
- ✅ Easy to monitor separately

**Cons:**
- ❌ Uses more resources
- ❌ More complex setup

---

## Option 6: API Route + External Pinger

**Best if:** You want the simplest external solution

Use a service that just "pings" your API endpoint regularly.

### Services:
- **Uptime Robot** (Free) - Can ping URLs every 5 minutes
- **Pingdom** - Monitoring service that can ping URLs
- **Simple cron on a VPS** - Your own server running cron

**Pros:**
- ✅ Very simple
- ✅ Works with any hosting

**Cons:**
- ❌ Less frequent (usually 5+ minute intervals)
- ❌ Less reliable than dedicated cron

---

## 🏆 Recommended Approach by Platform

### Railway (Your Case)
**Best Option**: Railway Cron Service (Option 1) or Separate Worker Service (Option 5)

### Vercel
**Best Option**: Vercel Cron (Option 4) or In-App Scheduler (Option 2)

### Any Platform
**Best Option**: In-App Scheduler (Option 2) - Most flexible, works everywhere

### Maximum Reliability
**Best Option**: Separate Worker Service (Option 5) + External Monitoring

---

## Quick Comparison

| Option | Setup Difficulty | Cost | Reliability | Platform Specific |
|--------|-----------------|------|-------------|-------------------|
| Railway Cron | ⭐ Easy | Free | ⭐⭐⭐⭐⭐ | Railway only |
| In-App Scheduler | ⭐⭐ Medium | Free | ⭐⭐⭐⭐ | Any platform |
| External Service | ⭐ Easy | Free-Paid | ⭐⭐⭐ | Any platform |
| Vercel Cron | ⭐ Easy | Free-Paid | ⭐⭐⭐⭐⭐ | Vercel only |
| Separate Worker | ⭐⭐⭐ Harder | Free | ⭐⭐⭐⭐⭐ | Any platform |

---

## My Recommendation for Railway

Since you're using Railway, I'd recommend:

1. **Current**: Use **In-App Scheduler** (Option 2) ✅ **ALREADY IMPLEMENTED**
   - Works immediately after deployment
   - No additional setup needed
   - Free and reliable
   - Can switch to worker service later easily

2. **Future (50+ clients)**: Switch to **Separate Worker Service** (Option 5)
   - Better isolation and scalability
   - Just set `ENABLE_IN_APP_SCHEDULER=false` and deploy worker

**Note**: Railway's cron has a 5-minute minimum, so In-App Scheduler is the best option for every-minute processing.

---

## Setting Up Railway Cron (Step-by-Step)

1. **Go to Railway**: https://railway.app
2. **Select your project** (sincere-eagerness)
3. **Click "+ Create"** button (top right)
4. **Select "Empty Service"**
5. **Name it**: `call-processor`
6. **Configure the service**:
   - **Source**: Connect to the same GitHub repo (leadcallr-calling-app)
   - **Root Directory**: Leave as root
   - **Start Command**: 
     ```bash
     npm run process-calls
     ```
   - **Environment Variables**: 
     - Click on the service → **Variables** tab
     - Add all your app's env vars (copy from your main service):
       - `DATABASE_URL`
       - `CRON_SECRET`
       - `NEXTAUTH_SECRET`
       - `NEXTAUTH_URL`
       - Any VAPI keys, etc.
7. **Set Cron Schedule**:
   - Click on `call-processor` service
   - Go to **Settings** tab
   - Scroll to **"Cron Schedule"** section
   - Enter: `* * * * *` (every minute)
   - Click **Save**
8. **Deploy!** Railway will automatically run this service every minute.

**Important**: Railway cron services must exit after completing their task. The `process-calls` script does this automatically.

---

## Need Help Choosing?

- **Want simplest?** → Railway Cron (Option 1)
- **Want most flexible?** → In-App Scheduler (Option 2)
- **Want separation?** → Separate Worker Service (Option 5)
- **Using Vercel?** → Vercel Cron (Option 4)

All options work! Choose based on your preferences and platform.



