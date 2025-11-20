# VAPI Call Triggering System Setup

## Overview

The VAPI call triggering system processes scheduled calls based on campaign configurations. It respects:
- Campaign frequency (daily, weekly)
- Schedule days (for weekly campaigns)
- Start/end time windows
- Campaign timezone
- Campaign active status

## Components

### 1. Background Scheduler

The system needs to run a background job that processes scheduled calls. There are two ways to do this:

#### Option A: Cron Job (Recommended for Production)

Set up a cron job to call the API endpoint every minute:

```bash
# Add to crontab (crontab -e)
* * * * * curl -X POST http://your-domain.com/api/cron/process-calls -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use the standalone script:

```bash
# Add to crontab
* * * * * cd /path/to/app && npm run process-calls
```

#### Option B: Next.js API Route + External Cron Service

Use a service like:
- **Vercel Cron** (if deployed on Vercel): Add `vercel.json` with cron configuration
- **Railway Cron** (if deployed on Railway): Add a cron service
- **GitHub Actions**: Set up a scheduled workflow
- **EasyCron** or similar: Point to `/api/cron/process-calls`

Example `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-calls",
    "schedule": "* * * * *"
  }]
}
```

### 2. Environment Variables

Add to your `.env`:

```bash
# Required for cron endpoint security
CRON_SECRET=your-random-secret-key-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### 3. VAPI Webhook Configuration

Configure VAPI to send webhooks to:
```
https://your-domain.com/api/vapi/webhook
```

This endpoint receives call status updates from VAPI and updates your database.

## How It Works

### Campaign Frequency Logic

1. **Daily Campaigns**: Each contact is called once per day (within start/end time window)
2. **Weekly Campaigns**: Each contact is called once per week on the scheduled days
3. **No Frequency Set**: Each contact is called once per day by default

### Scheduling Logic

The scheduler runs every minute and:
1. Finds all active campaigns (`isActive = true`)
2. Checks if current time is within campaign's time window
3. For weekly campaigns, checks if today is a scheduled day
4. Finds contacts that need calls based on frequency rules
5. Makes VAPI calls using tenant-specific credentials
6. Updates call statuses in database

### Campaign Stop

When a campaign is stopped:
- Campaign `isActive` is set to `false`
- All scheduled calls are cancelled
- Active calls continue and complete normally

## Testing

### Manual Test

1. Create a campaign with frequency "daily"
2. Upload CSV with contacts
3. Wait for scheduled time
4. Check `/api/cron/process-calls` endpoint manually:
   ```bash
   curl -X POST http://localhost:3000/api/cron/process-calls \
     -H "Authorization: Bearer your-cron-secret"
   ```

### Test Call Processing

Run the processor script directly:
```bash
npm run process-calls
```

## Monitoring

Check call logs in the console for:
- `📞 Making VAPI call for: ...` - Call being initiated
- `✅ VAPI call successful for ...` - Call succeeded
- `❌ Error making VAPI call for ...` - Call failed

Check database `calls` table for:
- `status = "scheduled"` - Waiting to be called
- `status = "calling"` - Call initiated
- `status = "in_progress"` - Call in progress
- `status = "completed"` - Call completed
- `status = "failed"` - Call failed
- `status = "cancelled"` - Call cancelled

## Troubleshooting

### Calls Not Being Made

1. **Check campaign is active**: `campaigns.isActive = true`
2. **Check time window**: Ensure current time is within `startTime` and `endTime`
3. **Check scheduled days**: For weekly campaigns, ensure today is in `scheduleDays`
4. **Check VAPI config**: Ensure tenant has VAPI credentials configured
5. **Check cron is running**: Verify the cron job/endpoint is being called
6. **Check frequency rules**: Verify contacts haven't already been called today/this week

### Webhook Not Updating Call Status

1. Verify VAPI webhook URL is configured correctly
2. Check webhook endpoint is accessible: `curl https://your-domain.com/api/vapi/webhook`
3. Check webhook logs in console
4. Verify call ID matches between VAPI and database

## Next Steps

1. Set up cron job or scheduled service
2. Configure VAPI webhook URL
3. Test with a small campaign
4. Monitor logs and database for issues




