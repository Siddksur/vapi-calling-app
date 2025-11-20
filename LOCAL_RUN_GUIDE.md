# How to Run the App Locally - Step by Step

This guide will walk you through running the LeadCallr AI app on your computer.

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running (local or Railway)
- [ ] `.env` file configured with all required variables

---

## Step 1: Check Node.js Installation

1. **Open Terminal** (in Cursor: View → Terminal, or press `` Ctrl + ` ``)

2. **Check if Node.js is installed**:
   ```bash
   node --version
   ```
   - If you see a version number (like `v20.x.x`), you're good! ✅
   - If you see "command not found", install Node.js from: https://nodejs.org

3. **Check if npm is installed**:
   ```bash
   npm --version
   ```
   - Should show a version number ✅

---

## Step 2: Navigate to Your Project

1. **In Terminal**, navigate to your project folder:
   ```bash
   cd "/Users/siddharthsur/Desktop/VAPI Calling App"
   ```

2. **Verify you're in the right place**:
   ```bash
   ls
   ```
   You should see files like `package.json`, `prisma/`, `app/`, etc.

---

## Step 3: Install Dependencies

1. **Install all required packages**:
   ```bash
   npm install
   ```
   
   This will take a few minutes. You'll see it downloading packages.

2. **Wait for it to finish** - you'll see:
   ```
   added XXX packages, and audited XXX packages in XXs
   ```

---

## Step 4: Set Up Environment Variables

1. **Check if you have a `.env` file**:
   ```bash
   ls -la | grep .env
   ```

2. **If you don't have `.env`**, create it:
   ```bash
   touch .env
   ```

3. **Open `.env` file** in your editor and add these required variables:

   ```bash
   # Database
   DATABASE_URL="your-postgresql-connection-string"
   
   # NextAuth
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Owner Account (for first-time login)
   OWNER_EMAIL="admin@leadcallr.ai"
   OWNER_PASSWORD="your-secure-password"
   
   # Cron Secret (for call processing)
   CRON_SECRET="x2jIsuh727QyGLzNn5xn8qmsWI5/wazinWQaJqRRRV0="
   
   # VAPI Configuration (optional - can be set per tenant via admin panel)
   VAPI_PRIVATE_KEY="your-vapi-key"
   VAPI_ORGANIZATION_ID="your-org-id"
   
   # Stripe (optional for now)
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

4. **Generate NEXTAUTH_SECRET** (if you don't have one):
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and paste it as `NEXTAUTH_SECRET` in your `.env` file.

---

## Step 5: Set Up Database

1. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   ```

2. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   ```
   
   If this is your first time, it will create all the tables.

3. **If you have existing data**, migrate it:
   ```bash
   npm run migrate:legacy
   ```

4. **Create a CLIENT user** (if needed):
   ```bash
   npm run create:client-user
   ```

---

## Step 6: Start the Development Server

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Wait for it to start** - you'll see:
   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - ready started server on 0.0.0.0:3000
   ```

3. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

---

## Step 7: Log In

1. **You'll see the login page**

2. **Log in with your OWNER credentials**:
   - Email: The email you set in `OWNER_EMAIL` in `.env`
   - Password: The password you set in `OWNER_PASSWORD` in `.env`

3. **If you don't have an OWNER account yet**, the app will create one automatically on first run, OR you can create one manually (see troubleshooting below).

---

## Step 8: Verify Everything Works

1. **Check the dashboard loads** - you should see statistics

2. **Check campaigns page** - go to `/campaigns`

3. **Check contacts page** - go to `/contacts`

4. **Check calls page** - go to `/calls`

---

## Common Issues & Solutions

### Problem: "Cannot find module" errors

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Problem: Database connection error

**Solution**:
- Check your `DATABASE_URL` in `.env` is correct
- Make sure PostgreSQL is running (if local)
- Test connection: `psql $DATABASE_URL`

### Problem: "NEXTAUTH_SECRET is missing"

**Solution**:
- Make sure `.env` file exists
- Add `NEXTAUTH_SECRET` with a generated value
- Restart the dev server

### Problem: Port 3000 already in use

**Solution**:
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill it (replace PID with the number from above)
kill -9 PID

# Or use a different port
PORT=3001 npm run dev
```

### Problem: "Prisma Client not generated"

**Solution**:
```bash
npm run db:generate
```

### Problem: Can't log in / No OWNER user

**Solution**:
1. Check `.env` has `OWNER_EMAIL` and `OWNER_PASSWORD`
2. The app should create the OWNER user automatically
3. If not, check the database - the user should be in the `users` table with `role = 'OWNER'`

---

## Quick Start Commands Summary

```bash
# 1. Navigate to project
cd "/Users/siddharthsur/Desktop/VAPI Calling App"

# 2. Install dependencies (first time only)
npm install

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. Start the app
npm run dev
```

Then open: **http://localhost:3000**

---

## Stopping the App

To stop the development server:
- Press `Ctrl + C` in the Terminal where it's running

---

## Next Steps After Running Locally

1. **Set up the cron job** for automatic call processing (see `CRON_SETUP_GUIDE.md`)
2. **Configure VAPI credentials** via the admin panel
3. **Create a campaign** and upload a CSV
4. **Test the call processing** system

---

## Need Help?

If you encounter any errors:
1. Check the error message carefully
2. Look at the Terminal output for more details
3. Verify all environment variables are set in `.env`
4. Make sure the database is accessible



