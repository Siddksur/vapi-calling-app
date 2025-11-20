# Production Deployment Guide

Complete step-by-step guide to deploy your LeadCallr AI app to production on Railway.

---

## 📋 Pre-Deployment Checklist

### ✅ Code Ready
- [ ] All features tested locally
- [ ] No console errors
- [ ] Database migrations ready
- [ ] Environment variables documented

### ✅ Files to Commit
- [ ] All new Next.js app files (`app/`, `components/`, `lib/`)
- [ ] Prisma schema and migrations (`prisma/`)
- [ ] Configuration files (`next.config.ts`, `railway.json`, `package.json`)
- [ ] Documentation files (guides, README)
- [ ] Scripts (`scripts/`)

### ✅ Files NOT to Commit (Already in .gitignore)
- [ ] `.env` files (contains secrets)
- [ ] `node_modules/` (will be installed on Railway)
- [ ] `.next/` (build output)
- [ ] `calls.db` (local SQLite, not used in production)

---

## 🚀 Step 1: Prepare Git Repository

### 1.1 Review Changes

```bash
# See what files have changed
git status

# Review important changes
git diff package.json
git diff next.config.ts
```

### 1.2 Add Files to Git

```bash
# Add all new files
git add .

# Review what will be committed
git status
```

**Important**: Make sure `.env` files are NOT included (they should be in `.gitignore`)

### 1.3 Commit Changes

```bash
git commit -m "feat: Complete Next.js migration with TypeScript, Prisma, and full feature set

- Migrated to Next.js 14 with TypeScript
- Implemented multi-tenant architecture
- Added CRM features (contacts, tags, lead sources)
- Implemented campaign management with scheduling
- Added CSV upload functionality
- Integrated VAPI call processing
- Added in-app scheduler for call processing
- Implemented call history and analytics
- Added admin and client dashboards
- Configured Railway deployment"
```

---

## 🗄️ Step 2: Database Setup on Railway

### 2.1 Create PostgreSQL Database

1. **Go to Railway Dashboard**: https://railway.app
2. **Click "+ New"** → **"Database"** → **"Add PostgreSQL"**
3. **Copy the DATABASE_URL** from Railway (it will be in environment variables)

### 2.2 Run Migrations

**Option A: Run migrations locally (recommended)**

```bash
# Set DATABASE_URL to Railway database
export DATABASE_URL="postgresql://user:password@host:port/railway"

# Run migrations
npm run db:migrate
```

**Option B: Run migrations on Railway**

1. Add a one-time service that runs: `npm run db:migrate`
2. Or use Railway's CLI: `railway run npm run db:migrate`

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Required Environment Variables

Add these to your Railway service **Variables** tab:

#### Database
```bash
DATABASE_URL=postgresql://...  # From Railway PostgreSQL service
```

#### NextAuth
```bash
NEXTAUTH_SECRET=your-secret-key-here  # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://your-app.railway.app  # Your Railway app URL
```

#### Owner Account
```bash
OWNER_EMAIL=admin@yourdomain.com
OWNER_PASSWORD=your-secure-password
```

#### VAPI Configuration
```bash
# These will be set per-tenant in the database, but you can set defaults:
VAPI_PRIVATE_KEY=your-vapi-private-key
VAPI_ORGANIZATION_ID=your-vapi-org-id
VAPI_BASE_URL=https://api.vapi.ai
```

#### Scheduler (Optional)
```bash
CRON_SECRET=your-cron-secret  # Generate: openssl rand -base64 32
ENABLE_IN_APP_SCHEDULER=true  # Set to false if using separate worker
```

#### Stripe (Optional - for billing)
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🚂 Step 4: Deploy to Railway

### 4.1 Connect Repository

1. **Go to Railway Dashboard**
2. **Click "+ New"** → **"GitHub Repo"**
3. **Select your repository**: `leadcallr-calling-app` (or your repo name)
4. **Railway will automatically detect** Next.js and start building

### 4.2 Configure Build Settings

Railway should auto-detect from `railway.json`, but verify:

- **Build Command**: `npm run build` ✅
- **Start Command**: `npm start` ✅
- **Root Directory**: `/` (root) ✅

### 4.3 Set Environment Variables

1. **Go to your service** → **Variables** tab
2. **Add all variables** from Step 3
3. **Save**

### 4.4 Deploy

1. **Railway will automatically deploy** when you push to main branch
2. **Or click "Deploy"** manually
3. **Wait for build to complete** (2-5 minutes)

---

## 🔧 Step 5: Post-Deployment Setup

### 5.1 Create Owner Account

After first deployment, create the owner account:

**Option A: Use Railway CLI**
```bash
railway run npm run create:client-user
```

**Option B: Create via API/UI**
- Visit: `https://your-app.railway.app/login`
- First login will create owner account (if seed script runs)

### 5.2 Configure VAPI Webhook

1. **Go to VAPI Dashboard**: https://dashboard.vapi.ai
2. **Settings** → **Webhooks**
3. **Add webhook URL**: `https://your-app.railway.app/api/vapi/webhook`
4. **Save**

### 5.3 Verify Scheduler is Running

1. **Check Railway logs** for:
   ```
   ✅ In-app call scheduler started (runs every minute)
   ```

2. **Wait 1 minute**, check logs for:
   ```
   [timestamp] [Scheduler] Processing scheduled calls...
   ```

3. **If not running**, visit: `https://your-app.railway.app/api/scheduler/init`

---

## 🧪 Step 6: Test Production Deployment

### 6.1 Basic Checks

- [ ] **Homepage loads**: `https://your-app.railway.app`
- [ ] **Login works**: `https://your-app.railway.app/login`
- [ ] **Dashboard loads**: `https://your-app.railway.app/dashboard`
- [ ] **Admin panel works**: `https://your-app.railway.app/admin`

### 6.2 Feature Tests

- [ ] **Create a campaign**
- [ ] **Upload CSV**
- [ ] **Verify calls are scheduled**
- [ ] **Check scheduler processes calls** (wait 1 minute)
- [ ] **Verify call status updates**

### 6.3 Check Logs

```bash
# In Railway dashboard → Logs tab
# Look for:
- ✅ Database connection successful
- ✅ Scheduler started
- ✅ Calls being processed
- ❌ Any errors
```

---

## 🔄 Step 7: Set Up Scheduler (If Needed)

The in-app scheduler should work automatically, but if you want a separate worker:

### Option A: Keep In-App Scheduler (Recommended)

**Already configured!** Just verify it's running in logs.

### Option B: Separate Worker Service

1. **Create new Railway service**: `call-processor-worker`
2. **Start Command**: `npm run worker`
3. **Copy all environment variables** from main service
4. **Set**: `ENABLE_IN_APP_SCHEDULER=false` in main service
5. **Deploy**

---

## 📊 Step 8: Monitor Production

### 8.1 Check Railway Metrics

- **CPU Usage**: Should be low (< 50%)
- **Memory Usage**: Monitor for leaks
- **Network**: Check request rates

### 8.2 Monitor Logs

**Watch for:**
- ✅ Scheduler running every minute
- ✅ Calls being processed
- ✅ Webhooks being received
- ❌ Any errors or warnings

### 8.3 Database Monitoring

- **Check call records** are being created
- **Verify status updates** are happening
- **Monitor database size**

---

## 🐛 Troubleshooting

### Problem: Build Fails

**Solution:**
- Check Railway logs for errors
- Verify `package.json` has all dependencies
- Check Node.js version (should be 18+)

### Problem: Database Connection Fails

**Solution:**
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Verify network access

### Problem: Scheduler Not Running

**Solution:**
- Check logs for scheduler startup message
- Visit `/api/scheduler/init` endpoint
- Verify `ENABLE_IN_APP_SCHEDULER` is not set to `false`

### Problem: Calls Not Processing

**Solution:**
- Check scheduler logs
- Verify campaign is active
- Check time window settings
- Verify VAPI credentials

### Problem: Webhooks Not Working

**Solution:**
- Verify webhook URL in VAPI dashboard
- Check webhook endpoint logs
- Status checker will sync calls automatically

---

## 📝 Environment Variables Reference

### Required
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-app.railway.app
OWNER_EMAIL=...
OWNER_PASSWORD=...
```

### Optional (but recommended)
```bash
CRON_SECRET=...
ENABLE_IN_APP_SCHEDULER=true
VAPI_PRIVATE_KEY=...
VAPI_ORGANIZATION_ID=...
STRIPE_SECRET_KEY=...
STRIPE_PUBLIC_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

---

## ✅ Deployment Checklist Summary

- [ ] Code committed to Git
- [ ] PostgreSQL database created on Railway
- [ ] Database migrations run
- [ ] Environment variables set in Railway
- [ ] App deployed to Railway
- [ ] Owner account created
- [ ] VAPI webhook configured
- [ ] Scheduler verified running
- [ ] Basic functionality tested
- [ ] Logs monitored for errors

---

## 🎉 You're Live!

Once all steps are complete, your app is running in production!

**Next Steps:**
1. Create your first client tenant
2. Configure VAPI credentials for the tenant
3. Create a test campaign
4. Monitor call processing

**Support:**
- Check logs in Railway dashboard
- Review troubleshooting section above
- Check documentation files for specific features

---

## 🔐 Security Reminders

- ✅ Never commit `.env` files
- ✅ Use strong passwords for owner account
- ✅ Rotate secrets regularly
- ✅ Monitor logs for suspicious activity
- ✅ Keep dependencies updated
- ✅ Use HTTPS (Railway provides automatically)

---

Good luck with your deployment! 🚀

