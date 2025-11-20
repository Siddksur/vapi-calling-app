# Step-by-Step Guide: Setting Up Call Processing (Cron Job)

This guide will walk you through setting up the automatic call processing system step-by-step.

## What is a Cron Job?

A "cron job" is a task that runs automatically on a schedule (in our case, every minute). It's like an alarm clock that wakes up every minute to check if any calls need to be made.

## First: Set Up Your Secret Key

Before we start, we need to create a secret password to protect the cron endpoint.

### Step 1: Generate a Secret Key

1. **Open Terminal** (on Mac: Press `Cmd + Space`, type "Terminal", press Enter)
   - On Windows: Press `Win + R`, type "cmd", press Enter
   - On Linux: Press `Ctrl + Alt + T`

2. **Run this command**:
   ```bash
   openssl rand -base64 32
   ```

3. **Copy the output** (it will look something like: `xK9mP2qR8vN3tY7wZ5aB1cD4eF6gH0iJ=`)

### Step 2: Add Secret to Your Environment Variables

1. **Open your project folder** in your code editor (VS Code, Cursor, etc.)

2. **Find the `.env` file** in the root of your project
   - If you don't see it, it might be hidden. Look for `.env.example` and copy it to `.env`

3. **Open the `.env` file** and add this line:
   ```
   CRON_SECRET=your-secret-key-here
   ```
   Replace `your-secret-key-here` with the secret you copied in Step 1.

4. **Save the file**

---

## Option A: Running Locally (For Development/Testing)

If you're running the app on your computer (like `npm run dev`), use this method.

### Step 1: Test the Script Manually First

Before setting up automatic running, let's test it manually:

1. **Open Terminal** in your project folder

2. **Navigate to your project** (if not already there):
   ```bash
   cd "/Users/siddharthsur/Desktop/VAPI Calling App"
   ```

3. **Run the processor once**:
   ```bash
   npm run process-calls
   ```

4. **Check the output**:
   - If you see: `[timestamp] Starting call processor...` and `[timestamp] Call processor completed` ✅ It works!
   - If you see errors, check that your database connection is working

### Step 2: Set Up Automatic Running (Every Minute)

#### On Mac/Linux:

1. **Open Terminal**

2. **Open your crontab** (the file that stores scheduled tasks):
   ```bash
   crontab -e
   ```

3. **If prompted, choose an editor**:
   - Press `1` for nano (easiest)
   - Or `2` for vi (more advanced)

4. **Add this line** at the bottom of the file:
   ```bash
   * * * * * cd "/Users/siddharthsur/Desktop/VAPI Calling App" && npm run process-calls >> /tmp/call-processor.log 2>&1
   ```
   
   **Important**: Replace the path with your actual project path!

5. **Save and exit**:
   - If using nano: Press `Ctrl + X`, then `Y`, then `Enter`
   - If using vi: Press `Esc`, type `:wq`, press `Enter`

6. **Verify it was added**:
   ```bash
   crontab -l
   ```
   You should see your line listed.

#### On Windows:

Windows doesn't have cron built-in. You have two options:

**Option 1: Use Task Scheduler (Windows built-in)**

1. **Press `Win + R`**, type `taskschd.msc`, press Enter
2. **Click "Create Basic Task"** in the right panel
3. **Name it**: "Call Processor"
4. **Set trigger**: "Daily" → Check "Repeat task every" → Select "1 minute" → Duration: "Indefinitely"
5. **Action**: "Start a program"
6. **Program/script**: `npm`
7. **Arguments**: `run process-calls`
8. **Start in**: `C:\Users\YourName\Desktop\VAPI Calling App` (your actual path)
9. **Click "Finish"**

**Option 2: Use the API Endpoint (Recommended for Windows)**

Instead of cron, use the API endpoint method (see Option B below).

---

## Option B: Using the API Endpoint (For Production or Any Environment)

This method works everywhere - local, production, Railway, Vercel, etc.

### Step 1: Get Your Domain/URL

- **If running locally**: `http://localhost:3000`
- **If deployed**: Your deployment URL (e.g., `https://your-app.railway.app`)

### Step 2: Test the Endpoint Manually

1. **Make sure your app is running**:
   ```bash
   npm run dev
   ```

2. **Open a new Terminal window** and run:
   ```bash
   curl -X POST http://localhost:3000/api/cron/process-calls \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   Replace `YOUR_CRON_SECRET` with the secret you set in `.env`

3. **Check the response**:
   - If you see: `{"success":true,"message":"Call processing completed",...}` ✅ It works!
   - If you see: `{"error":"Unauthorized"}` → Check your `CRON_SECRET` in `.env` matches

### Step 3: Set Up Automatic Calls

#### Method 1: Using EasyCron (Easiest - Free Tier Available)

1. **Go to**: https://www.easycron.com
2. **Sign up** for a free account
3. **Click "Add New Cron Job"**
4. **Fill in**:
   - **Cron Job Name**: "Call Processor"
   - **URL**: `https://your-domain.com/api/cron/process-calls`
   - **HTTP Method**: POST
   - **HTTP Headers**: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```
   - **Schedule**: Select "Every 1 minute" or enter: `* * * * *`
5. **Click "Create"**

#### Method 2: Using GitHub Actions (If using GitHub)

1. **Create a file** in your project: `.github/workflows/process-calls.yml`
2. **Add this content**:
   ```yaml
   name: Process Calls
   on:
     schedule:
       - cron: '* * * * *'  # Every minute
   jobs:
     process:
       runs-on: ubuntu-latest
       steps:
         - name: Call API
           run: |
             curl -X POST ${{ secrets.API_URL }}/api/cron/process-calls \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
   ```
3. **In GitHub**: Go to Settings → Secrets → Add:
   - `API_URL`: Your deployment URL
   - `CRON_SECRET`: Your secret key

#### Method 3: Using Vercel Cron (If deployed on Vercel)

1. **Create file**: `vercel.json` in your project root
2. **Add this content**:
   ```json
   {
     "crons": [{
       "path": "/api/cron/process-calls",
       "schedule": "* * * * *"
     }]
   }
   ```
3. **Redeploy** your app on Vercel

#### Method 4: Using Railway Cron (If deployed on Railway)

1. **Go to your Railway dashboard**: https://railway.app
2. **Click on your project**
3. **Click "+ New"** → **"Cron Job"**
4. **Configure**:
   - **Schedule**: `* * * * *` (every minute)
   - **Command**: 
     ```bash
     curl -X POST https://your-app.railway.app/api/cron/process-calls \
       -H "Authorization: Bearer YOUR_CRON_SECRET"
     ```
5. **Add environment variable**:
   - **Name**: `CRON_SECRET`
   - **Value**: Your secret key
6. **Deploy**

---

## Step 4: Verify It's Working

### Check Logs

1. **If using the script locally**, check:
   ```bash
   tail -f /tmp/call-processor.log
   ```
   (Press Ctrl+C to exit)

2. **If using the API endpoint**, check your app logs:
   - In Terminal where you ran `npm run dev`, you should see:
     ```
     📞 Processed X calls for campaign...
     ```

### Check Your Database

1. **Open your database** (using Prisma Studio or your database client)
2. **Check the `calls` table**:
   - Look for records with `status = "scheduled"`
   - After a minute or two, some should change to `status = "calling"` or `"in_progress"`

### Check the Calls Page

1. **Go to**: http://localhost:3000/calls (or your deployed URL)
2. **You should see** new calls appearing as they're processed

---

## Troubleshooting

### Problem: "Unauthorized" Error

**Solution**: 
- Check your `.env` file has `CRON_SECRET` set
- Make sure you're using the same secret in the cron job command
- Restart your app after changing `.env`

### Problem: Cron Job Not Running

**Solution**:
- Check cron is running: `ps aux | grep cron` (Mac/Linux)
- Check crontab has the job: `crontab -l`
- Check log file: `cat /tmp/call-processor.log`

### Problem: Calls Not Being Made

**Solution**:
- Verify campaign `isActive = true`
- Check campaign has start/end times set
- Verify current time is within the time window
- Check tenant has VAPI credentials configured
- Verify VAPI credentials are correct

### Problem: "Database connection failed"

**Solution**:
- Check `DATABASE_URL` in `.env` is correct
- Make sure database is running (if local)
- Check database credentials are valid

---

## Quick Start Checklist

- [ ] Generated `CRON_SECRET` using `openssl rand -base64 32`
- [ ] Added `CRON_SECRET` to `.env` file
- [ ] Tested manually: `npm run process-calls`
- [ ] Set up cron job (chose one method above)
- [ ] Verified cron job is running
- [ ] Checked logs to see calls being processed
- [ ] Verified calls appear in database/calls page

---

## Need Help?

If you get stuck:
1. Check the error message carefully
2. Look at the console/logs for more details
3. Verify all environment variables are set correctly
4. Make sure your app is running and accessible




