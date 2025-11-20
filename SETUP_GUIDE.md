# LeadCallr AI - Phase 1 Setup Guide

This guide will help you complete the setup of the Next.js migration for your LeadCallr AI platform.

## ✅ Completed in Phase 1

### 1. Project Foundation
- ✅ Next.js 14 with TypeScript
- ✅ Prisma ORM with PostgreSQL
- ✅ Tailwind CSS + Shadcn/UI components
- ✅ NextAuth.js authentication
- ✅ Multi-tenant folder structure

### 2. Database Schema
- ✅ Complete Prisma schema with all models
- ✅ Multi-tenant support (Tenants, Users)
- ✅ Campaigns, Calls, Assistants, PhoneNumbers
- ✅ CRM models (Contacts, Tags)
- ✅ Billing models (Subscriptions, StripeProducts)
- ✅ Feature flags (TenantFeature)
- ✅ Designed for future user role expansion

### 3. Authentication & Authorization
- ✅ NextAuth.js with credentials provider
- ✅ OWNER and CLIENT user roles
- ✅ Tenant isolation middleware
- ✅ Session management with tenant context
- ✅ Protected routes

### 4. Admin Dashboard
- ✅ Owner dashboard with platform statistics
- ✅ Client management page
- ✅ Create new client with user account
- ✅ Client listing with details
- ✅ API routes for tenant management

### 5. Client Dashboard
- ✅ Tenant-scoped dashboard
- ✅ Statistics cards (calls, campaigns, contacts)
- ✅ Recent calls list
- ✅ Navigation sidebar

### 6. Data Migration
- ✅ Migration script for legacy data
- ✅ Preserves all existing campaigns and calls
- ✅ Creates default tenant
- ✅ Creates OWNER user account

### 7. Stripe Integration
- ✅ Stripe client configuration
- ✅ Webhook handler for subscription events
- ✅ Plan configurations (Basic, Pro, Enterprise)
- ✅ Subscription model in database

## 🚀 Next Steps to Complete Setup

### Step 1: Environment Variables

Create a `.env` file (copy from `.env.example`) and set:

```bash
# Required
DATABASE_URL="postgresql://postgres:tocrIGuebgVxiJOUilcphjKzDtmpyOrf@postgres.railway.internal:5432/railway"
NEXTAUTH_SECRET="PFD4OMCNSZS6Cz3516NopOjk3OS1x/OurOAtf8OWsEE="
NEXTAUTH_URL="http://localhost:3000"

# Owner account
OWNER_EMAIL="admin@leadcallr.ai"
OWNER_PASSWORD="leadcallr123!"

# Vapi.ai (from your existing setup)
VAPI_PRIVATE_KEY="..."
VAPI_ORGANIZATION_ID="..."
VAPI_ASSISTANT_ID="..."
VAPI_PHONE_NUMBER_ID="..."

# Stripe (optional for now)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Step 2: Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Create initial migration
npm run db:migrate

# (Optional) If you have existing data, run migration
npm run migrate:legacy
```

### Step 3: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your OWNER credentials.

## 📋 What's Ready to Use

### Admin Features
1. **Admin Dashboard** (`/admin`)
   - Platform-wide statistics
   - Recent clients overview

2. **Client Management** (`/admin/clients`)
   - View all clients
   - Create new clients
   - Edit client details (UI ready, API needs implementation)

### Client Features
1. **Client Dashboard** (`/dashboard`)
   - Tenant-scoped statistics
   - Recent calls list
   - Navigation to campaigns, calls, contacts

### API Endpoints
- `POST /api/admin/tenants` - Create new tenant
- `GET /api/admin/tenants` - List all tenants
- `POST /api/stripe/webhook` - Stripe webhook handler

## 🔨 What Still Needs Implementation (Phase 2+)

### Campaign Management
- [ ] Campaign creation form
- [ ] CSV upload functionality
- [ ] Campaign scheduling (days of week, frequency)
- [ ] Campaign templates
- [ ] Integration with existing Vapi.ai call logic

### Call Management
- [ ] Call listing with filters
- [ ] Call details view
- [ ] Call analytics
- [ ] Real-time call monitoring (Pro+ tiers)

### Contact Management (CRM)
- [ ] Contact CRUD operations
- [ ] Tag management
- [ ] Lead source tracking
- [ ] Contact search and filters
- [ ] Contact timeline view

### Billing & Stripe
- [ ] Subscription creation flow
- [ ] Plan upgrade/downgrade
- [ ] Usage tracking
- [ ] Invoice management
- [ ] Admin billing dashboard

### Advanced Features
- [ ] Facebook Ads integration
- [ ] Assistant management UI
- [ ] Advanced analytics
- [ ] Export functionality
- [ ] API access (Enterprise)

## 🐛 Known Issues / Notes

1. **Call ID Migration**: Legacy calls use SERIAL IDs, new schema uses UUIDs. The migration script generates new UUIDs for calls.

2. **Stripe Products**: You'll need to create Stripe products and price IDs in your Stripe dashboard and add them to environment variables.

3. **Vapi.ai Integration**: The existing Vapi.ai call logic from `server.js` needs to be ported to Next.js API routes.

4. **File Uploads**: CSV upload functionality needs to be implemented in Next.js (currently in Express app).

## 🔐 Security Notes

- All passwords are hashed with bcrypt
- Tenant isolation enforced at database query level
- Middleware protects routes based on user role
- Environment variables should never be committed

## 📚 Documentation

- See `README.md` for full project documentation
- Prisma schema: `prisma/schema.prisma`
- API routes: `app/api/`

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Test connection
npx prisma db pull

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your app URL
- Clear browser cookies

### Build Issues
```bash
# Regenerate Prisma client
npm run db:generate

# Clear Next.js cache
rm -rf .next
```

## ✨ Ready for Phase 2!

The foundation is complete. You can now:
1. Start using the admin dashboard to manage clients
2. Begin implementing campaign management features
3. Add CRM functionality
4. Integrate with Vapi.ai for actual calling

All the infrastructure is in place for a scalable, multi-tenant SaaS platform!




