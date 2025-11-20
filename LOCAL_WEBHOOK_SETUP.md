# Local Development - Webhook Setup Guide

## The Problem

When running locally (`npm run dev`), your app runs on `http://localhost:3000`, which is **not accessible from the internet**. VAPI webhooks need to POST to a **publicly accessible URL**, so they won't work with localhost.

## Solutions

### Option 1: Use Status Checker (Recommended for Local Dev) ✅

**Best for**: Local development and testing

The status checker I just created will automatically sync call statuses from VAPI API, so you don't need webhooks for local development!

**How it works:**
- Every time the scheduler runs, it checks for stuck calls
- Queries VAPI API directly to get real call status
- Updates your database automatically
- **No webhook configuration needed!**

**Pros:**
- ✅ Works immediately (no setup)
- ✅ No external services needed
- ✅ Automatically fixes stuck calls
- ✅ Perfect for local development

**Cons:**
- ⚠️ Slight delay (checks every minute when scheduler runs)
- ⚠️ Not real-time (but close enough for testing)

---

### Option 2: Use ngrok (For Real-Time Webhooks) 🔧

**Best for**: Testing webhooks in real-time locally

**Setup:**

1. **Install ngrok**:
   ```bash
   # Mac
   brew install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Start your local server**:
   ```bash
   npm run dev
   ```

3. **In a new terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (looks like: `https://abc123.ngrok.io`)

5. **Configure VAPI webhook**:
   - Go to VAPI dashboard
   - Set webhook URL to: `https://abc123.ngrok.io/api/vapi/webhook`
   - Save

6. **Now webhooks will work!** ✅

**Pros:**
- ✅ Real-time webhook updates
- ✅ Tests actual webhook flow
- ✅ Good for debugging webhook issues

**Cons:**
- ⚠️ Requires ngrok setup
- ⚠️ Free tier has limitations (URL changes on restart)
- ⚠️ Need to update VAPI config each time ngrok restarts

---

### Option 3: Use LocalTunnel (Free Alternative) 🔧

**Best for**: Free alternative to ngrok

**Setup:**

1. **Install localtunnel**:
   ```bash
   npm install -g localtunnel
   ```

2. **Start your local server**:
   ```bash
   npm run dev
   ```

3. **In a new terminal, start tunnel**:
   ```bash
   lt --port 3000
   ```

4. **Copy the URL** (looks like: `https://random-name.loca.lt`)

5. **Configure VAPI webhook**:
   - Set webhook URL to: `https://random-name.loca.lt/api/vapi/webhook`

**Pros:**
- ✅ Free
- ✅ No signup required
- ✅ Simple setup

**Cons:**
- ⚠️ URL changes each time
- ⚠️ Less reliable than ngrok

---

### Option 4: Test in Production Only 🚀

**Best for**: Quick testing without setup

**How it works:**
- Deploy to Railway/production
- Configure webhooks there
- Test webhooks in production environment
- Use status checker for local dev

**Pros:**
- ✅ No local setup needed
- ✅ Real production environment
- ✅ Webhooks work automatically

**Cons:**
- ⚠️ Slower feedback loop
- ⚠️ Need to deploy to test

---

## Recommended Approach

### For Local Development:
**Use Option 1 (Status Checker)** - It works automatically, no setup needed!

The status checker will:
- ✅ Sync call statuses every minute
- ✅ Update stuck calls automatically
- ✅ Extract outcomes and data
- ✅ Work perfectly for local testing

### For Production:
**Use Webhooks** - Configure webhook URL in VAPI dashboard:
```
https://your-domain.com/api/vapi/webhook
```

The status checker will still run as a **backup** to catch any missed webhooks!

---

## How Status Checker Works Locally

When running locally:

1. **Scheduler runs every minute**
2. **Status checker finds stuck calls** (calls in "calling" status for >5 minutes)
3. **Queries VAPI API** directly: `GET /api/call/{callId}`
4. **Updates database** with real status, outcome, duration, cost
5. **No webhook needed!** ✅

**Example flow:**
```
1. Call made → Status: "calling"
2. Call completes in VAPI
3. Webhook doesn't reach localhost (expected)
4. Scheduler runs (1 minute later)
5. Status checker queries VAPI API
6. Finds call is "ended"
7. Updates database: Status: "completed", Outcome: "SUCCESS"
```

---

## Testing Webhooks Locally

If you want to test webhooks locally (to debug webhook handler):

1. **Use ngrok** (Option 2)
2. **Set VAPI webhook URL** to ngrok URL
3. **Make a test call**
4. **Check logs** for webhook received messages
5. **Verify database** updates

**Check logs for:**
```
📥 VAPI webhook received: {...}
✅ Updated call X (VAPI: Y): completed
```

---

## Summary

**Local Development:**
- ✅ **Status checker works automatically** - No setup needed!
- ✅ Calls will update within 1 minute
- ✅ Perfect for testing

**Production:**
- ✅ **Webhooks work automatically** - Just configure URL in VAPI
- ✅ Status checker runs as backup
- ✅ Best of both worlds!

**You don't need webhooks for local development** - the status checker handles it! 🎉

