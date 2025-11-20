# Troubleshooting Guide - Calls Not Being Made

## Issue: Scheduled Calls Not Processing

### Quick Checks

1. **Is the scheduler running?**
   - Check your terminal logs for: `✅ In-app call scheduler started`
   - Look for: `[timestamp] [Scheduler] Processing scheduled calls...` every minute
   - If you don't see these, the scheduler isn't running

2. **Is the campaign active?**
   - Check campaign status is "Active" (green badge)
   - Check `isActive: true` in database

3. **Is it within the time window?**
   - Current time must be between `startTime` and `endTime`
   - Respects campaign's `timeZone`
   - **Note**: Fixed to process overdue calls within 1 hour grace period

4. **Is it a scheduled day?**
   - For weekly campaigns, today must be in `scheduleDays`
   - Check if today matches the selected days

5. **Does tenant have VAPI config?**
   - Check tenant has `vapiPrivateKey` set
   - Check VAPI credentials are valid

### How to Manually Trigger Scheduler

**Option 1: Initialize scheduler**
```bash
# Visit this URL in your browser or use curl:
curl http://localhost:3000/api/scheduler/init
```

**Option 2: Manually process calls**
```bash
npm run process-calls
```

**Option 3: Trigger via API**
```bash
curl -X POST http://localhost:3000/api/cron/process-calls \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Common Issues

#### Issue: Time Window Too Short
**Problem**: Time window is only 2 minutes (2:43 PM - 2:45 PM), and scheduler runs every minute. If it runs at 2:44 PM and processes slowly, calls might miss the window.

**Solution**: 
- Make time window longer (at least 5-10 minutes)
- Or use the fix that processes overdue calls within grace period

#### Issue: Scheduler Not Initialized
**Problem**: Scheduler only starts on first API call. If no one has used the app, scheduler isn't running.

**Solution**:
- Visit any page (like `/dashboard` or `/campaigns`)
- Or call `/api/scheduler/init` endpoint
- Check logs for scheduler startup message

#### Issue: Calls Scheduled Before Time Window
**Problem**: Calls scheduled for 2:42 PM but time window starts at 2:43 PM.

**Solution**: 
- Schedule calls within the time window
- Or use the fix that processes overdue calls

### Debug Steps

1. **Check scheduler is running**:
   ```bash
   # Look for this in logs:
   ✅ In-app call scheduler started (runs every minute)
   ```

2. **Check scheduler is processing**:
   ```bash
   # Look for this every minute:
   [timestamp] [Scheduler] Processing scheduled calls...
   ```

3. **Check campaign is being processed**:
   ```bash
   # Look for:
   📞 Processed X calls for campaign...
   # OR
   ⚠️ Campaign X skipped: [reason]
   ```

4. **Check call status in database**:
   ```bash
   # In Prisma Studio or database:
   SELECT * FROM calls WHERE campaignId = 'your-campaign-id' AND status = 'scheduled';
   ```

5. **Manually test call processing**:
   ```bash
   npm run process-calls
   # Should see: "Starting call processor..." and "Call processor completed"
   ```

### Fix Applied

**Time Window Grace Period**: 
- Scheduler now processes scheduled calls that are due, even if slightly outside the time window
- Allows up to 1 hour grace period for overdue calls
- Prevents calls from being permanently skipped if scheduler runs late

### Still Not Working?

1. Check terminal logs for errors
2. Verify database connection
3. Verify VAPI credentials
4. Check campaign settings match expectations
5. Try manually running: `npm run process-calls`

