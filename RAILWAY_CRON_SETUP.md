# Railway Cron Setup - Step-by-Step Guide

Railway doesn't have a separate "Cron Job" option. Instead, you configure cron schedules **in a service's Settings tab**. Here's exactly how to do it:

---

## Step 1: Create a New Service

1. **In your Railway dashboard**, click **"+ Create"** (top right)
2. **Select "Empty Service"** from the dropdown
3. **Name it**: `call-processor` (or any name you prefer)

---

## Step 2: Connect to Your Codebase

1. **Click on the new `call-processor` service** you just created
2. **In the "Source" section**, click **"Connect GitHub"** (or select your existing repo)
3. **Select your repository**: `leadcallr-calling-app` (or whatever your repo is called)
4. **Root Directory**: Leave as `/` (root, same as your main app)

---

## Step 3: Configure the Start Command

1. **Still in the `call-processor` service**, go to the **"Settings"** tab
2. **Scroll down to "Start Command"** section
3. **Enter**:
   ```bash
   npm run process-calls
   ```
   (This runs the script that processes scheduled calls)

---

## Step 4: Add Environment Variables

1. **Click on the "Variables" tab** (in the `call-processor` service)
2. **Click "+ New Variable"**
3. **Add all the same environment variables** from your main app:
   - `DATABASE_URL` (copy from your main service)
   - `CRON_SECRET` (copy from your main service)
   - `NEXTAUTH_SECRET` (copy from your main service)
   - `NEXTAUTH_URL` (copy from your main service)
   - Any `VAPI_*` variables (copy from your main service)
   - Any other env vars your app needs

**Quick way**: Railway might have a "Copy from Service" option - use that to copy all variables from your main app at once!

---

## Step 5: Set the Cron Schedule ⭐ (This is the key step!)

1. **Still in the `call-processor` service**, go to the **"Settings"** tab
2. **Scroll down** until you see **"Cron Schedule"** section
3. **Click in the "Cron Schedule" field**
4. **Enter**: `* * * * *` (this means "every minute")
5. **Click "Save"** or press Enter

**What this does**: Railway will now automatically start your service every minute, run the `npm run process-calls` command, and then stop it when done.

---

## Step 6: Deploy

1. **Railway should automatically deploy** when you save the cron schedule
2. **Check the "Deployments" tab** to see if it's deploying
3. **Wait for deployment to complete** (green checkmark)

---

## Step 7: Verify It's Working

1. **Go to the "Logs" tab** of your `call-processor` service
2. **Wait a minute** (since it runs every minute)
3. **You should see logs** like:
   ```
   [2024-01-15T10:30:00.000Z] Starting call processor...
   [2024-01-15T10:30:01.000Z] Call processor completed
   ```

4. **Check your main app's database** - scheduled calls should start processing!

---

## Troubleshooting

### Problem: I don't see "Cron Schedule" in Settings

**Solution**: 
- Make sure you're in the **Settings** tab (not Variables, not Deployments)
- Scroll down - it might be at the bottom
- If you still don't see it, Railway might require a paid plan. Check Railway's pricing.

### Problem: Service runs but exits immediately

**Solution**: 
- This is **normal**! Railway cron services are supposed to exit after completing their task
- Check the **Logs** tab to see if it actually processed calls before exiting

### Problem: "Command not found: npm"

**Solution**:
- Make sure your service is connected to your GitHub repo
- Railway needs to build your app first (it should do this automatically)
- Check the "Deployments" tab to see if the build succeeded

### Problem: Calls aren't being processed

**Solution**:
- Check the **Logs** tab for errors
- Verify all environment variables are set correctly
- Make sure `DATABASE_URL` is correct
- Check that your main app's `/api/cron/process-calls` endpoint works (test it manually)

---

## Alternative: Use API Endpoint Method

If you prefer to use the API endpoint instead of the script:

1. **Follow Steps 1-2** above (create service, connect repo)
2. **In Step 3** (Start Command), use:
   ```bash
   curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/cron/process-calls -H "Authorization: Bearer $CRON_SECRET"
   ```
3. **Add environment variable**: `RAILWAY_PUBLIC_DOMAIN` = your app's public URL
4. **Continue with Steps 4-7** above

**Note**: The script method (`npm run process-calls`) is more reliable because it doesn't depend on HTTP requests.

---

## What Happens Next?

Once set up:
- ✅ Railway will start your `call-processor` service every minute
- ✅ It runs `npm run process-calls`
- ✅ The script processes scheduled calls
- ✅ The service exits (this is normal!)
- ✅ Railway waits until the next minute, then repeats

This is **exactly** what you want - a cron job that runs every minute!

---

## Cost

**Free!** Railway cron jobs don't cost extra. You only pay for the compute time used (which is minimal since the service exits after each run).

---

## Need Help?

If you're stuck:
1. Check Railway's official docs: https://docs.railway.com/reference/cron-jobs
2. Check the Logs tab for error messages
3. Make sure your `scripts/call-processor.ts` file exists and works locally

