# LeadCallr AI SaaS Platform

A comprehensive multi-tenant SaaS platform for AI-powered voice calling campaigns built with Next.js 14, TypeScript, Prisma, and PostgreSQL.

## 🚀 Features

- **Multi-Tenant Architecture**: Complete tenant isolation with secure data access
- **User Management**: Simplified OWNER/CLIENT roles (designed for easy expansion)
- **Campaign Management**: Create and manage voice calling campaigns with Vapi.ai
- **CRM Integration**: Contact management with tagging and lead source tracking
- **Stripe Integration**: Subscription management and billing
- **Admin Dashboard**: Comprehensive platform management for owners
- **Client Dashboard**: Tenant-scoped dashboard for clients

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or Railway)
- Vapi.ai account and API keys
- Stripe account (for billing)

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `OWNER_EMAIL` & `OWNER_PASSWORD`: Initial admin account
- `VAPI_*`: Vapi.ai API credentials
- `STRIPE_*`: Stripe API keys and webhook secret

### 3. Database Setup

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Migrate Legacy Data (if applicable)

If you have existing data from the old Node.js/Express app:

```bash
npm run migrate:legacy
```

This script will:
- Create a default tenant for existing data
- Create an OWNER user account
- Migrate all campaigns, calls, assistants, and phone numbers

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your OWNER credentials.

## 📁 Project Structure

```
├── app/                    # Next.js app directory
│   ├── admin/             # Admin/Owner routes
│   ├── api/               # API routes
│   ├── dashboard/         # Client dashboard
│   └── login/             # Authentication
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── layouts/          # Layout components
│   └── ui/               # Shadcn/UI components
├── lib/                   # Utility libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── stripe.ts         # Stripe configuration
│   └── tenant.ts         # Tenant isolation utilities
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma     # Database schema
└── scripts/              # Utility scripts
    └── migrate-legacy-data.ts
```

## 🔐 Authentication & Authorization

### User Roles

- **OWNER**: Platform administrator with full access
- **CLIENT**: Tenant-scoped user with access only to their tenant's data

### Tenant Isolation

All data queries are automatically filtered by tenant ID for CLIENT users. OWNER users can access all tenants.

## 🗄️ Database Schema

Key models:
- **Tenant**: Client accounts
- **User**: Platform users (OWNER or CLIENT)
- **Campaign**: Voice calling campaigns
- **Call**: Call records and analytics
- **Assistant**: AI voice assistants
- **PhoneNumber**: Calling numbers
- **Contact**: CRM contacts with tags
- **Subscription**: Stripe subscription data

## 🔌 API Routes

### Admin Routes
- `GET/POST /api/admin/tenants` - Manage tenants
- `GET/PUT/DELETE /api/admin/tenants/[id]` - Tenant operations

### Client Routes
- `GET /api/campaigns` - List campaigns (tenant-scoped)
- `GET /api/calls` - List calls (tenant-scoped)
- `GET /api/contacts` - List contacts (tenant-scoped)

### Stripe Webhooks
- `POST /api/stripe/webhook` - Handle Stripe events

## 🚢 Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Add PostgreSQL service
3. Set all environment variables in Railway dashboard
4. Deploy!

The app will automatically:
- Run Prisma migrations on deploy
- Generate Prisma client
- Start the Next.js server

## 📝 Development Notes

### Adding New Features

1. Update Prisma schema if needed: `prisma/schema.prisma`
2. Run migration: `npm run db:migrate`
3. Generate Prisma client: `npm run db:generate`
4. Implement feature with tenant isolation in mind

### Future User Roles

The schema is designed to easily add:
- `CLIENT_ADMIN`: Can manage users within tenant
- `CLIENT_USER`: Limited access within tenant
- `CLIENT_VIEWER`: Read-only access within tenant

## 🐛 Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Ensure SSL settings match your database provider

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your app URL
- Clear browser cookies and try again

### Migration Issues
- Ensure database is accessible
- Check Prisma schema is valid: `npx prisma validate`
- Review migration logs for errors

## 📄 License

Proprietary - All rights reserved

## 🤝 Support

For issues or questions, please contact the development team.
