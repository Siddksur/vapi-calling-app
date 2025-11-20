# Call Scheduler Setup Guide

This guide explains how the call scheduler works and how to switch between different deployment modes.

---

## Current Setup: In-App Scheduler ✅

**Status**: Enabled by default

The scheduler runs **inside your Next.js app** using `node-cron`. It processes scheduled calls every minute automatically.

### How It Works

1. When your Next.js app starts, `instrumentation.ts` initializes the scheduler
2. The scheduler runs every minute using `node-cron`
3. It processes all scheduled calls that are due
4. Logs are visible in your main app logs

### Environment Variables

- **`ENABLE_IN_APP_SCHEDULER`**: 
  - Set to `"false"` to disable the in-app scheduler
  - Default: `"true"` (enabled)
  - When disabled, you must use a separate worker service or external cron

### Pros
- ✅ No additional services needed
- ✅ Works immediately after deployment
- ✅ Free (uses existing resources)
- ✅ Simple setup

### Cons
- ⚠️ Shares resources with web app
- ⚠️ If web app restarts, scheduler restarts (brief gap)

---

## Switching to Separate Worker Service

When you're ready to scale (50+ clients), you can switch to a separate worker service for better isolation.

### Step 1: Disable In-App Scheduler

Add to your `.env` (or Railway environment variables):

```bash
ENABLE_IN_APP_SCHEDULER=false
```

### Step 2: Create Worker Service on Railway

1. **In Railway dashboard**, click **"+ Create"** → **"Empty Service"**
2. **Name it**: `call-processor-worker`
3. **Connect to same GitHub repo**
4. **Start Command**: `npm run worker`
5. **Environment Variables**: Copy all from your main app:
   - `DATABASE_URL`
   - `CRON_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - All `VAPI_*` variables
   - Any other env vars
6. **Deploy!**

**Important**: Don't set a cron schedule - the worker runs continuously.

### Step 3: Verify

1. Check worker service logs - should see: `✅ Worker service started`
2. Check main app logs - should see: `⏸️ In-app scheduler is disabled`
3. Wait a minute - calls should process from the worker service

### Pros
- ✅ Isolated from web app
- ✅ Can scale independently
- ✅ Better resource management
- ✅ More reliable at scale

### Cons
- ⚠️ Uses additional resources (runs 24/7)
- ⚠️ Slightly more complex setup

---

## Switching to External Cron Service

If you want to use an external cron service (like EasyCron):

### Step 1: Disable In-App Scheduler

```bash
ENABLE_IN_APP_SCHEDULER=false
```

### Step 2: Set Up External Cron

Use any cron service to call your API endpoint:

```bash
curl -X POST https://your-app.railway.app/api/cron/process-calls \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Schedule: Every minute (`* * * * *`)

### Step 3: Verify

Check your app logs when the cron service calls the endpoint.

---

## Testing Locally

### Test In-App Scheduler

1. **Start your app**:
   ```bash
   npm run dev
   ```

2. **Check logs** - should see:
   ```
   ✅ In-app call scheduler started (runs every minute)
   ```

3. **Wait a minute** - should see:
   ```
   [timestamp] [Scheduler] Processing scheduled calls...
   ```

### Test Standalone Script

Run the processor manually:

```bash
npm run process-calls
```

This processes calls once and exits. Useful for testing.

### Test Worker Service

Run the worker locally:

```bash
npm run worker
```

This runs continuously and processes calls every minute. Press Ctrl+C to stop.

---

## Monitoring

### Check Scheduler Status

**In-App Scheduler**:
- Check main app logs for `[Scheduler]` messages
- Should see processing messages every minute

**Worker Service**:
- Check worker service logs separately
- Should see processing messages every minute

**External Cron**:
- Check main app logs for API calls to `/api/cron/process-calls`
- Should see processing messages when cron triggers

### Troubleshooting

**Problem**: Calls aren't being processed

1. Check if scheduler is running (look for logs)
2. Verify `ENABLE_IN_APP_SCHEDULER` is not set to `"false"` (if using in-app)
3. Check database connection
4. Verify campaigns are active
5. Check scheduled calls exist in database

**Problem**: Scheduler not starting

1. Check `instrumentation.ts` exists
2. Verify `instrumentationHook: true` in `next.config.ts`
3. Check logs for errors
4. Make sure you're in production mode (or set `ENABLE_IN_APP_SCHEDULER=true`)

**Problem**: Too many resources used

1. Switch to separate worker service
2. Or use external cron service

---

## Migration Checklist

When switching from In-App to Worker Service:

- [ ] Set `ENABLE_IN_APP_SCHEDULER=false` in main app
- [ ] Create new Railway service for worker
- [ ] Set start command: `npm run worker`
- [ ] Copy all environment variables
- [ ] Deploy worker service
- [ ] Verify worker logs show it's running
- [ ] Verify main app logs show scheduler disabled
- [ ] Test that calls are processing
- [ ] Monitor for 24 hours to ensure stability

---

## Files Reference

- **`lib/scheduler.ts`**: In-app scheduler logic
- **`lib/init-scheduler.ts`**: Scheduler initialization (legacy, not used)
- **`instrumentation.ts`**: Next.js hook that starts scheduler
- **`scripts/worker.ts`**: Standalone worker service script
- **`scripts/call-processor.ts`**: One-time call processor script
- **`lib/call-scheduler.ts`**: Core call processing logic

---

## Questions?

- **Which should I use?**: Start with In-App, switch to Worker at 50+ clients
- **Does it cost more?**: In-App is free, Worker uses more resources but still free on Railway
- **Can I test locally?**: Yes, use `npm run worker` or check dev logs
- **What if it breaks?**: Check logs, verify env vars, test with `npm run process-calls`

