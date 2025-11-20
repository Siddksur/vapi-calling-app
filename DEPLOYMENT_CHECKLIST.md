# Quick Deployment Checklist

Use this checklist when deploying to production.

## Before Committing

- [ ] Test app locally: `npm run dev`
- [ ] Verify all features work
- [ ] Check for console errors
- [ ] Review `.gitignore` (make sure `.env` is excluded)

## Git Commands

```bash
# 1. Check status
git status

# 2. Add files (review first!)
git add .

# 3. Commit
git commit -m "feat: Complete Next.js migration with full feature set"

# 4. Push to GitHub
git push origin main
```

## Railway Setup

- [ ] Create PostgreSQL database on Railway
- [ ] Copy DATABASE_URL
- [ ] Create new service from GitHub repo
- [ ] Set all environment variables
- [ ] Deploy

## Environment Variables (Railway)

```bash
DATABASE_URL=postgresql://...  # From Railway PostgreSQL
NEXTAUTH_SECRET=...  # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://your-app.railway.app
OWNER_EMAIL=admin@yourdomain.com
OWNER_PASSWORD=your-secure-password
CRON_SECRET=...  # Generate: openssl rand -base64 32
ENABLE_IN_APP_SCHEDULER=true
```

## Post-Deployment

- [ ] Run database migrations
- [ ] Create owner account
- [ ] Configure VAPI webhook URL
- [ ] Verify scheduler is running
- [ ] Test login
- [ ] Test campaign creation
- [ ] Test CSV upload
- [ ] Monitor logs

## Quick Test

1. Visit: `https://your-app.railway.app/login`
2. Login with owner credentials
3. Create a test campaign
4. Upload CSV
5. Wait 1 minute
6. Check calls are processing

Done! ✅

