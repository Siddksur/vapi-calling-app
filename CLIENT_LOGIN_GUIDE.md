# Client Login Guide

## How Clients Log In

### Current Setup

1. **Default Tenant** has been created with existing data
2. **CLIENT user** has been created for the Default Tenant

### Login Credentials

**Default Tenant Client:**
- **Email:** `client@default.tenant`
- **Password:** `client123!` (or whatever you set in `.env` as `CLIENT_PASSWORD`)

### Login Flow

1. Go to `http://localhost:3001/login` (or your deployed URL)
2. Enter the CLIENT email and password
3. After login, you'll be redirected to `/dashboard` (Client Dashboard)
4. The dashboard shows:
   - Tenant-scoped statistics (only their data)
   - Recent calls
   - Navigation to campaigns, calls, contacts, etc.

### What Happens After Login

- **CLIENT users** → Redirected to `/dashboard` (Client Portal)
- **OWNER users** → Redirected to `/admin` (Admin Dashboard)

### Creating New Client Users

Currently, you can create CLIENT users in two ways:

#### Option 1: Using the Script (Quick)
```bash
# Set in .env first:
CLIENT_EMAIL="newclient@example.com"
CLIENT_PASSWORD="secure-password"
CLIENT_NAME="Client Name"

# Then run:
npm run create:client-user
```

#### Option 2: Via Admin Panel (Coming in Phase 2)
- Go to `/admin/clients`
- Click on a client
- Add user accounts for that tenant

### Important Notes

- Each tenant can have multiple CLIENT users (designed for future expansion)
- Currently, we're using a simple one-user-per-client model
- All CLIENT users see the same tenant data (tenant-scoped)
- OWNER users see all tenants and can manage everything

### Future Enhancements (Phase 2+)

- Admin panel to create/edit client users
- User management within tenant (CLIENT_ADMIN role)
- Different permission levels per user
- Invite system for new client users




