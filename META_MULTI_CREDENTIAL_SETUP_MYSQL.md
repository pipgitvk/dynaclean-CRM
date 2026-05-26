# Meta Multi-Credential Architecture Setup Guide (MySQL)

This document explains how to set up and use the new multi-credential Meta Facebook Lead system using MySQL.

## Overview

The system now supports multiple Meta credentials, allowing you to manage leads from different Facebook pages and forms for different employees or teams. Each credential can have multiple form IDs, and leads are automatically routed to the assigned employee.

**Database:** MySQL (No MongoDB required)

## Architecture

### Database Tables (MySQL)

1. **meta_credentials** - Stores credential information
   - id: Primary key
   - employee_name: Name of employee/team
   - verify_token: Webhook verification token
   - page_id: Facebook Page ID
   - page_token: Page Access Token
   - form_ids: JSON array of lead form IDs
   - is_active: Enable/disable credential (0/1)
   - last_sync_at: Last sync timestamp
   - last_sync_status: success/error/pending
   - last_sync_message: Sync status message
   - total_leads_fetched: Counter for fetched leads
   - created_at, updated_at: Timestamps

2. **meta_leads** - Stores fetched leads
   - id: Primary key
   - leadgen_id: Unique Meta lead ID
   - assigned_to: Assigned employee username
   - employee_name: Employee/team name
   - form_id: Source form ID
   - page_id: Source page ID
   - lead_data: JSON parsed lead information
   - field_data: JSON raw Meta field data
   - is_imported_to_crm: CRM import status (0/1)
   - crm_customer_id: CRM customer ID if imported
   - ad_id: Meta ad ID
   - campaign_name: Resolved campaign name
   - products_interest: Product interest string
   - created_at, synced_at: Timestamps

3. **meta_sync_logs** - Sync operation logs
   - id: Primary key
   - credential_id: Foreign key to meta_credentials
   - employee_name: Employee name
   - sync_type: cron/manual/webhook
   - status: success/error/partial
   - leads_fetched, leads_imported, leads_skipped: Counters
   - error_message: Error text if any
   - sync_duration: Operation duration in ms
   - synced_at: Timestamp
   - form_ids_processed: JSON array of form IDs

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# Global Webhook Verify Token (Required)
FB_VERIFY_TOKEN=dynaclean-secret

# Optional: Cron Secret for API protection
CRON_SECRET=your-secret-key
```

**Note:** No MongoDB URI needed - uses existing MySQL connection

### 2. Run MySQL Migration

Run the migration script to create the required tables:

```bash
node scripts/migrate-meta-multi-credential.js
```

This will create:
- `meta_credentials` table
- `meta_leads` table
- `meta_sync_logs` table

### 3. Webhook Configuration

Configure your Meta webhook to point to:

```
https://your-domain.com/api/webhook/meta
```

Use the global verify token: `dynaclean-secret` (or your custom `FB_VERIFY_TOKEN`)

### 4. Starting the Cron Service

The cron service can be started in two ways:

**Option A: Automatic (Recommended)**
Add this to your application startup (e.g., in `layout.js` or a startup script):

```javascript
import '@/lib/initMetaCron';
```

The cron will automatically start when the server boots.

**Option B: Manual via API**
Use the API endpoint to start/stop cron:

```bash
# Start cron
curl -X POST http://localhost:3000/api/cron/meta-leads-sync \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Stop cron
curl -X POST http://localhost:3000/api/cron/meta-leads-sync \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

The cron runs every 10 minutes automatically.

## Admin Panel Pages

### 1. Dashboard
**URL:** `/admin-dashboard/meta-dashboard`

Shows:
- Total credentials
- Active credentials
- Total leads fetched
- Leads imported to CRM
- Recent sync activity
- Quick action links

### 2. Credentials Management
**URL:** `/admin-dashboard/meta-credentials`

Features:
- List all credentials
- Add new credential
- Edit existing credential
- Delete credential
- Enable/disable credential
- Start/stop cron
- Manual sync trigger
- View sync status for each credential

### 3. Add Credential
**URL:** `/admin-dashboard/meta-credentials/add`

Fields:
- Employee Name (required)
- Verify Token (required)
- Page ID (required)
- Page Access Token (required)
- Form IDs (one or more, required)

### 4. Edit Credential
**URL:** `/admin-dashboard/meta-credentials/[id]/edit`

Same fields as add, plus:
- Active status toggle

### 5. Sync Logs
**URL:** `/admin-dashboard/meta-sync-logs`

Shows:
- Detailed sync history
- Filter by credential
- Status, employee, sync type
- Fetched/imported/skipped counts
- Duration and timestamp

## API Endpoints

### Credentials

- `GET /api/meta-credentials` - List all credentials
- `GET /api/meta-credentials?activeOnly=true` - List only active credentials
- `POST /api/meta-credentials` - Create new credential
- `GET /api/meta-credentials/[id]` - Get single credential
- `PUT /api/meta-credentials/[id]` - Update credential
- `DELETE /api/meta-credentials/[id]` - Delete credential
- `POST /api/meta-credentials/[id]/toggle` - Toggle active status

### Leads

- `GET /api/meta-leads` - List leads (supports filters)
  - `?assignedTo=username` - Filter by assignee
  - `?formId=123` - Filter by form ID
  - `?isImported=true` - Filter by import status
  - `?limit=100` - Pagination limit
  - `?skip=0` - Pagination offset
- `POST /api/meta-leads` - Create lead (webhook use)
- `GET /api/meta-leads/sync-logs` - Get sync logs
  - `?credentialId=xxx` - Filter by credential
  - `?limit=50` - Limit results

### Cron

- `GET /api/cron/meta-leads-sync?action=status` - Get cron status
- `GET /api/cron/meta-leads-sync?action=manual-sync` - Trigger manual sync
  - `?since=2024-01-01` - Start date
  - `?until=2024-01-31` - End date
  - `?autoImport=true` - Auto-import to CRM
- `POST /api/cron/meta-leads-sync` - Control cron
  - Body: `{"action": "start"}` or `{"action": "stop"}`

### Webhook

- `GET /api/webhook/meta` - Webhook verification
- `POST /api/webhook/meta` - Webhook payload (lead notifications)

## Lead Routing Logic

When a lead arrives:

1. **Webhook Flow:**
   - Webhook receives lead from Meta
   - System finds matching credential by form ID (using JSON_CONTAINS)
   - Lead is saved to meta_leads table
   - Lead is automatically imported to CRM (customers table)
   - Lead is assigned to the employee from the credential

2. **Cron Flow:**
   - Cron runs every 10 minutes
   - Fetches all active credentials from meta_credentials table
   - For each credential:
     - Fetches leads from all form IDs (last 7 days)
     - Saves new leads to meta_leads table
     - Auto-imports to CRM if not duplicate
   - Updates credential sync status
   - Creates sync log entry in meta_sync_logs table

3. **Manual Sync Flow:**
   - Admin triggers manual sync from UI
   - Same as cron flow but on-demand
   - Can specify custom date range

## Duplicate Protection

The system implements duplicate protection at multiple levels:

1. **meta_leads table:** Checks `leadgen_id` uniqueness (UNIQUE index)
2. **CRM Import:** Checks phone number (last 10 digits) against existing customers
3. Leads are skipped if already in either system

## Features

### Bonus Features Implemented

✅ Multiple credentials support (MySQL)
✅ Employee-wise lead routing by form ID
✅ Automatic cron with node-cron (every 10 min)
✅ Single global webhook verify token
✅ Duplicate lead protection
✅ Last synced time tracking
✅ Credential status (active/inactive)
✅ Lead sync logs
✅ Loading states in UI
✅ Toast notifications
✅ Modern dashboard UI
✅ Responsive design
✅ Form ID array support (JSON)
✅ Manual sync trigger
✅ Cron control (start/stop)
✅ Sync status per credential
✅ Total leads counter

## Troubleshooting

### Cron not starting
- Check MySQL connection
- Verify migration script was run
- Check server logs for errors

### Leads not importing to CRM
- Check if phone number is valid (10 digits)
- Verify MySQL connection
- Check if lead already exists in CRM
- Review sync logs for errors

### Webhook not receiving leads
- Verify webhook URL is correct
- Check FB_VERIFY_TOKEN matches
- Ensure credential is active
- Verify form ID matches a credential

### MySQL connection issues
- Verify MySQL is running
- Check database credentials in existing db.js
- Ensure network connectivity
- Check table exists (run migration if needed)

## Migration from Old System

The old single-credential system used MySQL `FB_credentials` table. The new system uses new MySQL tables.

To migrate:

1. Run the migration script: `node scripts/migrate-meta-multi-credential.js`
2. Add credentials via the new Admin Panel
3. Old credentials will continue to work for Tamil form (hardcoded)
4. Gradually migrate other forms to the new system
5. Old system can be deprecated after migration

## File Structure

```
src/
├── lib/
│   ├── mysql/
│   │   ├── metaCredentialModel.js    # MySQL model for credentials
│   │   ├── metaLeadModel.js          # MySQL model for leads
│   │   └── metaSyncLogModel.js       # MySQL model for sync logs
│   ├── services/
│   │   └── metaLeadFetchService.js   # Lead fetching logic (MySQL)
│   ├── cron/
│   │   └── metaLeadCron.js           # Cron service
│   └── initMetaCron.js               # Startup initialization
├── app/
│   ├── api/
│   │   ├── meta-credentials/         # Credentials API
│   │   ├── meta-leads/               # Leads API
│   │   ├── cron/meta-leads-sync/     # Cron control API
│   │   └── webhook/meta/             # Webhook endpoint
│   └── admin-dashboard/
│       ├── meta-dashboard/           # Dashboard page
│       ├── meta-credentials/         # Credentials management
│       └── meta-sync-logs/           # Sync logs page
scripts/
└── migrate-meta-multi-credential.js  # MySQL migration script
```

## Support

For issues or questions:
- Check sync logs for detailed error messages
- Review browser console for frontend errors
- Check server logs for backend errors
- Verify all environment variables are set
- Ensure MySQL tables were created by running migration
