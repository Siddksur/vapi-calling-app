# Updating Existing Railway Deployment

Since you already have Railway and GitHub set up, here's how to update your existing deployment to the new Next.js stack.

---

## 🔄 What's Changing

### Old Stack (Current)
- Express.js server (`server.js`)
- Direct PostgreSQL queries
- Old frontend in `public/` folder

### New Stack (Next.js)
- Next.js 14 with TypeScript
- Prisma ORM
- React components
- New API routes

---

## 📋 Pre-Deployment Checklist

### ✅ Before You Deploy

- [ ] **Backup your database** (Railway PostgreSQL has backups, but verify)
- [ ] **Note your current environment variables** (you'll need to update some)
- [ ] **Test locally** to make sure everything works
- [ ] **Review what will change** (old server.js will be replaced)

---

## 🚀 Step 1: Update Railway Configuration

### 1.1 Verify Railway Settings

Your `railway.json` is already configured correctly:
- ✅ Build Command: `npm run build`
- ✅ Start Command: `npm start` (Next.js, not old server.js)

**Important**: Railway will automatically use the new `package.json` scripts, so `npm start` will run Next.js, not the old Express server.

### 1.2 Update Environment Variables

Go to Railway Dashboard → Your Service → Variables tab

**Add/Update these variables:**

```bash
# Database (should already exist)
DATABASE_URL=postgresql://...  # Keep existing value

# NextAuth (NEW - required)
NEXTAUTH_SECRET=your-secret-here  # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://leadcallr-calling-app-production.up.railway.app  # Your Railway URL

# Owner Account (NEW - required)
OWNER_EMAIL=admin@yourdomain.com
OWNER_PASSWORD=your-secure-password

# Scheduler (NEW - optional but recommended)
CRON_SECRET=your-cron-secret  # Generate: openssl rand -base64 32
ENABLE_IN_APP_SCHEDULER=true

# VAPI (if you had these, keep them; if not, add them)
# These can also be set per-tenant in the database
VAPI_PRIVATE_KEY=your-vapi-key
VAPI_ORGANIZATION_ID=your-vapi-org-id
VAPI_BASE_URL=https://api.vapi.ai

# Stripe (if you had these, keep them)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Remove/Old variables (if they exist):**
- `APP_LOGIN_USERNAME` (replaced by OWNER_EMAIL)
- `APP_LOGIN_PASSWORD` (replaced by OWNER_PASSWORD)
- `APP_SESSION_SECRET` (replaced by NEXTAUTH_SECRET)
- `DATABASE_PATH` (if using SQLite - you're using PostgreSQL now)

---

## 📦 Step 2: Commit and Push Code

### 2.1 Review Changes

```bash
# See what's changed
git status

# Review important files
git diff package.json
git diff railway.json
```

### 2.2 Add and Commit

```bash
# Add all new files
git add .

# Commit
git commit -m "feat: Migrate to Next.js 14 with TypeScript and Prisma

- Replace Express.js with Next.js 14
- Migrate to Prisma ORM
- Add TypeScript support
- Implement new multi-tenant architecture
- Add CRM features (contacts, tags, lead sources)
- Implement campaign management with scheduling
- Add CSV upload functionality
- Integrate VAPI call processing
- Add in-app scheduler for call processing
- Implement call history and analytics
- Add admin and client dashboards"
```

### 2.3 Push to GitHub

```bash
git push origin main
```

**Railway will automatically deploy** when you push! 🚀

---

## 🗄️ Step 3: Database Migration

### 3.1 Run Prisma Migrations

After Railway deploys, you need to run migrations to create the new schema:

**Option A: Using Railway CLI (Recommended)**

```bash
# Install Railway CLI if you haven't
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npm run db:migrate
```

**Option B: One-Time Service**

1. Railway Dashboard → "+ New" → "Empty Service"
2. Name: `run-migrations`
3. Start Command: `npm run db:migrate`
4. Copy all environment variables from main service
5. Deploy (runs once, then stops)
6. Delete the service after migrations complete

**Option C: Manual Migration Script**

Create a temporary script that runs migrations, or use Railway's console.

### 3.2 Migrate Existing Data (If Needed)

If you have existing data in your PostgreSQL database:

```bash
# Run the migration script
railway run npm run migrate:legacy
```

This will:
- Create a default tenant
- Create an OWNER user account
- Migrate existing campaigns, calls, assistants, phone numbers

---

## 🔧 Step 4: Post-Deployment Verification

### 4.1 Check Deployment Logs

In Railway Dashboard → Logs tab, look for:

```
✅ Database connection successful
✅ Prisma client generated
✅ Next.js build completed
✅ Server started on port 3000
✅ In-app call scheduler started
```

### 4.2 Test the App

1. **Visit your app**: `https://leadcallr-calling-app-production.up.railway.app`
2. **Login page should load**: `/login`
3. **Try logging in** with your owner credentials
4. **Check dashboard**: `/dashboard`
5. **Test admin panel**: `/admin`

### 4.3 Verify Scheduler

Check logs for:
```
✅ In-app call scheduler started (runs every minute)
[timestamp] [Scheduler] Processing scheduled calls...
```

---

## 🔄 Step 5: Handle Old Files (Optional)

### Old Server.js

The old `server.js` file will still be in your repo but **won't run** because:
- Railway uses `npm start` which runs Next.js (`next start`)
- The old Express server is not started

**Options:**
1. **Keep it** as backup (recommended for now)
2. **Move it** to `server-backup.js` (already exists)
3. **Delete it** later once you're confident everything works

### Old Public Files

The old `public/index.html`, `public/admin.html` etc. won't be used because Next.js serves from `app/` directory.

**Options:**
1. **Keep them** for reference
2. **Delete them** once you're confident

---

## ⚠️ Important Notes

### Port Configuration

- **Old**: Express server used `PORT` env var (default 3000)
- **New**: Next.js also uses `PORT` env var (Railway sets this automatically)
- ✅ **No changes needed** - Railway handles this

### Database

- **Old**: Direct PostgreSQL queries
- **New**: Prisma ORM
- ✅ **Same database** - just different access method
- ✅ **Data preserved** - migrations add new tables, don't delete old ones

### Environment Variables

- Some old variables are replaced (see Step 1.2)
- Add new NextAuth variables
- Keep database and VAPI variables

### Routes

- **Old**: Express routes in `server.js`
- **New**: Next.js API routes in `app/api/`
- ✅ **URLs stay the same** - `/api/...` routes still work

---

## 🐛 Troubleshooting

### Problem: Build Fails

**Check:**
- Railway logs for build errors
- `package.json` has all dependencies
- Node.js version (should be 18+)

### Problem: Database Connection Fails

**Check:**
- `DATABASE_URL` is correct in Railway variables
- PostgreSQL service is running
- Network access is configured

### Problem: Old Data Not Showing

**Solution:**
- Run `npm run migrate:legacy` to migrate existing data
- Check if data exists in old tables
- Verify migration script ran successfully

### Problem: Can't Login

**Solution:**
- Check `OWNER_EMAIL` and `OWNER_PASSWORD` are set
- Run migration script to create owner account
- Or create manually via API/script

---

## ✅ Deployment Checklist

- [ ] Committed all new code
- [ ] Pushed to GitHub
- [ ] Updated environment variables in Railway
- [ ] Railway deployment completed successfully
- [ ] Database migrations run
- [ ] Legacy data migrated (if needed)
- [ ] App loads correctly
- [ ] Login works
- [ ] Scheduler is running
- [ ] Old functionality still works (or migrated)

---

## 🎉 You're Done!

Once all steps are complete:

1. ✅ Your app is running on Next.js
2. ✅ Old data is preserved
3. ✅ New features are available
4. ✅ Scheduler is running automatically

**Next Steps:**
- Test all features
- Configure VAPI webhook URL
- Create your first client tenant
- Monitor logs for any issues

---

## 📝 Quick Reference

**Railway URL**: `https://leadcallr-calling-app-production.up.railway.app`

**Generate Secrets:**
```bash
openssl rand -base64 32  # For NEXTAUTH_SECRET and CRON_SECRET
```

**Run Migrations:**
```bash
railway run npm run db:migrate
```

**Check Logs:**
Railway Dashboard → Your Service → Logs tab

---

Good luck with your deployment! 🚀

