# How the Call Scheduler Works - Complete Integration Guide

This document explains how the in-app scheduler integrates with all your app's features and functionality.

---

## 🎯 Overview

The **Call Scheduler** is the "brain" that automatically processes and makes phone calls based on your campaign configurations. It runs **every minute** in the background, checking for scheduled calls and making them via VAPI.

---

## 🔄 Complete Call Flow

### Step 1: Campaign Creation
**Where**: `/campaigns` page → "Create Campaign"

**What happens**:
- User creates a campaign with:
  - **Assistant** (AI voice agent)
  - **Phone Number** (outbound number)
  - **Schedule Frequency** (daily, weekly, or custom)
  - **Schedule Days** (for weekly: Mon, Tue, Wed, etc.)
  - **Time Window** (start time, end time, timezone)
  - **Retry Attempts** (how many times to call each contact)

**Result**: Campaign is saved to database with `isActive: true`

---

### Step 2: CSV Upload
**Where**: `/campaigns` → Click campaign → "Upload CSV"

**What happens**:
1. User uploads CSV with contacts (name, phone, address)
2. System parses CSV and creates/updates contacts in CRM
3. For each contact, creates a **Call record** with:
   - `status: "scheduled"`
   - `scheduledTime`: Calculated based on campaign's time window
   - Links to campaign, contact, assistant, phone number

**Result**: Multiple `Call` records created with `status: "scheduled"` in database

---

### Step 3: Scheduler Activation
**Where**: Runs automatically in background

**What happens**:
1. When app starts (or first API call), scheduler initializes
2. Uses `node-cron` to run every minute (`* * * * *`)
3. Calls `processScheduledCalls()` function

**Result**: Scheduler is running and checking every minute

---

### Step 4: Call Processing (Every Minute)
**Where**: `lib/call-scheduler.ts` → `processScheduledCalls()`

**What happens every minute**:

#### A. Find Active Campaigns
- Queries database for campaigns where:
  - `isActive: true`
  - `deletedAt: null`
  - Tenant has VAPI configuration

#### B. Check Campaign Time Window
- For each campaign, checks if **current time** is within:
  - `startTime` and `endTime` (e.g., 9:00 AM - 5:00 PM)
  - Respects campaign's `timeZone` (e.g., "America/New_York")
- **Skips** if outside time window

#### C. Check Schedule Days (Weekly Campaigns)
- For weekly campaigns, checks if **today** is in `scheduleDays` array
- Example: If `scheduleDays: [1, 2, 3]` (Mon, Tue, Wed), only runs on those days
- **Skips** if not a scheduled day

#### D. Find Scheduled Calls
- Queries for calls where:
  - `status: "scheduled"`
  - `scheduledTime <= now` (due to be called)
  - Belongs to this campaign
- Limits to 50 calls per campaign (prevents overload)

#### E. Check Frequency Rules
For each scheduled call, checks if contact should be called:

**Daily Frequency**:
- Checks if contact was already called **today**
- If yes → Skip (already called today)
- If no → Proceed to call

**Weekly Frequency**:
- Checks if contact was already called **this week**
- If yes → Skip (already called this week)
- If no → Proceed to call

**No Frequency Set**:
- Defaults to once per day
- Checks if called today

**Retry Limit**:
- Checks if contact has reached `retryAttempts` limit
- If yes → Skip (max retries reached)
- If no → Proceed to call

#### F. Create Recurring Calls (For Frequency-Based Campaigns)
- For campaigns with `scheduleFrequency` set:
- Finds contacts in CRM that have been called before
- Creates new scheduled calls for contacts that need recurring calls
- Respects frequency rules (daily/weekly)

#### G. Make VAPI Calls
- For each contact that should be called:
  1. Limits concurrent calls (max 10 at a time)
  2. Calls `makeVAPICall()` function
  3. Updates call status to `"calling"`
  4. Sends request to VAPI API
  5. Updates database with VAPI call ID

**Result**: Calls are initiated via VAPI API

---

### Step 5: VAPI Call Execution
**Where**: `lib/vapi.ts` → `makeVAPICall()`

**What happens**:
1. Gets tenant's VAPI credentials from database
2. Formats phone number to E.164 format (+1234567890)
3. Sends POST request to VAPI API with:
   - Assistant ID
   - Phone Number ID
   - Customer phone number
   - Contact info (name, address) as variables
4. VAPI initiates the actual phone call
5. Returns VAPI call ID

**Result**: Phone call is made to contact

---

### Step 6: Webhook Updates
**Where**: `/api/vapi/webhook` route

**What happens**:
- VAPI sends webhook when call status changes:
  - `"ringing"` → Call is ringing
  - `"in-progress"` → Call answered, conversation started
  - `"ended"` → Call completed
  - `"failed"` → Call failed
- Webhook handler updates call record in database:
  - Updates `status` field
  - Updates `message` field
  - Updates `timestamp` field

**Result**: Call history is updated in real-time

---

### Step 7: View Call History
**Where**: `/calls` page

**What happens**:
- User can see all calls:
  - Scheduled calls (waiting to be processed)
  - Calling calls (currently ringing)
  - In-progress calls (conversation happening)
  - Completed calls (finished)
  - Failed calls (errors)
- Can filter by:
  - Campaign
  - Status
  - Date range
  - Contact name/phone

**Result**: User sees complete call history

---

## 🔗 Integration Points

### 1. Campaign Management
- **Scheduler reads**: Campaign `isActive`, `scheduleFrequency`, `scheduleDays`, `startTime`, `endTime`, `timeZone`, `retryAttempts`
- **Scheduler respects**: All campaign scheduling settings
- **User can**: Stop campaign → Sets `isActive: false` → Scheduler skips it

### 2. CSV Upload
- **Creates**: Call records with `status: "scheduled"`
- **Sets**: `scheduledTime` based on campaign time window
- **Scheduler finds**: These scheduled calls and processes them

### 3. CRM (Contacts)
- **Scheduler uses**: Contacts for recurring calls (daily/weekly frequency)
- **Scheduler creates**: New scheduled calls for contacts that need recurring calls
- **Scheduler links**: Calls to contacts via `contactId`

### 4. Call History
- **Scheduler updates**: Call status as calls are processed
- **Webhook updates**: Call status as VAPI sends updates
- **User views**: All call history in `/calls` page

### 5. VAPI Integration
- **Scheduler calls**: `makeVAPICall()` function
- **Function uses**: Tenant's VAPI credentials from database
- **Function sends**: Request to VAPI API
- **VAPI sends**: Webhook updates back to app

---

## ⚙️ Key Features & How Scheduler Handles Them

### Feature: Campaign Time Windows
**Example**: Campaign set to call 9 AM - 5 PM EST

**How scheduler handles**:
- Checks current time in campaign's timezone
- Only processes calls if current time is between 9 AM and 5 PM
- Skips all calls outside this window
- Resumes automatically when time window opens

### Feature: Daily Frequency
**Example**: Campaign set to call each contact once per day

**How scheduler handles**:
- Before calling, checks if contact was called today
- If yes → Skips (already called today)
- If no → Makes call
- Tomorrow, contact becomes eligible again

### Feature: Weekly Frequency
**Example**: Campaign set to call each contact once per week on Mon/Wed/Fri

**How scheduler handles**:
- Checks if today is Mon, Wed, or Fri
- If not → Skips entire campaign
- If yes → Checks if contact was called this week
- If yes → Skips (already called this week)
- If no → Makes call

### Feature: Retry Attempts
**Example**: Campaign set to retry each contact up to 3 times

**How scheduler handles**:
- Counts how many completed calls exist for this contact in this campaign
- If count >= 3 → Skips (max retries reached)
- If count < 3 → Makes call

### Feature: Campaign Stop/Pause
**Example**: User clicks "Stop Campaign"

**How scheduler handles**:
- Campaign's `isActive` is set to `false`
- Scheduler skips this campaign entirely
- All scheduled calls remain in database but aren't processed
- User can reactivate campaign to resume

---

## 📊 Database Flow

### Call Status Lifecycle

```
1. "scheduled" → Created when CSV uploaded
   ↓
2. "calling" → Scheduler initiates VAPI call
   ↓
3. "in_progress" → VAPI webhook: call answered
   ↓
4. "completed" → VAPI webhook: call ended successfully
   OR
4. "failed" → VAPI webhook: call failed/error
```

### Scheduler Decision Tree

```
Every Minute:
├─ Find active campaigns
│  ├─ Check time window → Skip if outside
│  ├─ Check schedule days → Skip if not scheduled day
│  ├─ Find scheduled calls (status: "scheduled", scheduledTime <= now)
│  │  ├─ Check frequency → Skip if already called
│  │  ├─ Check retry limit → Skip if max retries reached
│  │  └─ Add to call queue
│  └─ For frequency campaigns, create recurring calls
│     └─ Add to call queue
└─ Process call queue (max 10 concurrent)
   └─ Make VAPI calls
      └─ Update status to "calling"
```

---

## 🎛️ User Controls

### What Users Can Control

1. **Campaign Active Status**
   - Toggle `isActive` on/off
   - Scheduler respects this immediately

2. **Campaign Schedule**
   - Set frequency (daily/weekly)
   - Set schedule days (for weekly)
   - Set time window
   - Scheduler uses these settings every minute

3. **Stop Campaign**
   - Sets `isActive: false`
   - Cancels all scheduled calls
   - Scheduler stops processing immediately

4. **CSV Upload**
   - Creates new scheduled calls
   - Scheduler picks them up automatically

### What Happens Automatically

- ✅ Scheduler runs every minute
- ✅ Processes scheduled calls
- ✅ Respects campaign settings
- ✅ Creates recurring calls (for frequency campaigns)
- ✅ Limits concurrent calls
- ✅ Updates call status
- ✅ Handles errors gracefully

---

## 🔍 Example Scenarios

### Scenario 1: Daily Campaign
**Setup**:
- Campaign: "Daily Follow-up"
- Frequency: Daily
- Time Window: 9 AM - 5 PM EST
- CSV uploaded with 100 contacts

**What happens**:
1. CSV upload creates 100 scheduled calls
2. Scheduler runs every minute
3. At 9:00 AM EST, scheduler starts processing
4. Makes calls (max 10 concurrent)
5. Each contact gets called once today
6. Tomorrow, scheduler creates new scheduled calls for all contacts
7. Process repeats daily

### Scenario 2: Weekly Campaign
**Setup**:
- Campaign: "Weekly Check-in"
- Frequency: Weekly
- Schedule Days: Monday, Wednesday, Friday
- Time Window: 10 AM - 2 PM PST
- CSV uploaded with 50 contacts

**What happens**:
1. CSV upload creates 50 scheduled calls
2. On Monday 10 AM PST, scheduler processes calls
3. Each contact gets called once
4. On Tuesday → Scheduler skips (not a scheduled day)
5. On Wednesday 10 AM PST → Scheduler processes again
6. Each contact gets called (if not already called this week)
7. Process repeats on Mon/Wed/Fri only

### Scenario 3: Campaign Stop
**Setup**:
- Active campaign with 200 scheduled calls
- User clicks "Stop Campaign"

**What happens**:
1. Campaign `isActive` set to `false`
2. All scheduled calls updated to `status: "cancelled"`
3. Scheduler skips this campaign (checks `isActive`)
4. No more calls are made
5. User can reactivate later to resume

---

## 🚀 Performance & Limits

### Scheduler Limits
- **Runs every**: 1 minute
- **Max concurrent calls**: 10 per campaign
- **Max calls per run**: 50 per campaign (prevents overload)
- **Processes**: All active campaigns in parallel

### Scalability
- **Current**: Handles multiple campaigns simultaneously
- **Future**: Can scale to separate worker service for 50+ clients
- **Database**: Efficient queries with indexes on `isActive`, `status`, `scheduledTime`

---

## 🔧 Technical Details

### Scheduler Initialization
- **When**: On app startup (or first API call)
- **How**: Via `/api/scheduler/init` route (Node.js runtime)
- **Status**: Logs "✅ In-app call scheduler started"

### Error Handling
- **Scheduler errors**: Logged but don't stop scheduler
- **VAPI errors**: Call status updated to "failed"
- **Database errors**: Logged, scheduler continues

### Monitoring
- **Logs**: Check terminal/logs for scheduler activity
- **Database**: Check `calls` table for status updates
- **VAPI**: Check VAPI dashboard for call status

---

## 📝 Summary

The scheduler is the **automated engine** that:
1. ✅ Runs every minute in the background
2. ✅ Finds scheduled calls that are due
3. ✅ Respects all campaign settings (time windows, frequency, days)
4. ✅ Makes calls via VAPI API
5. ✅ Updates call status in database
6. ✅ Creates recurring calls for frequency-based campaigns
7. ✅ Handles errors gracefully
8. ✅ Scales with your app

**Without the scheduler**: Calls would never be made automatically. Users would have to manually trigger each call.

**With the scheduler**: Set it and forget it! Campaigns run automatically based on your configurations.

---

## 🎯 Key Takeaway

The scheduler bridges the gap between:
- **User actions** (creating campaigns, uploading CSVs)
- **Campaign configurations** (schedules, frequencies, time windows)
- **Actual phone calls** (via VAPI)

It's the "autopilot" that makes your campaigns run automatically! 🚀

