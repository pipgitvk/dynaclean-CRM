# Meta Multi-Credential Architecture Setup Guide

This document explains how to set up and use the new multi-credential Meta Facebook Lead system.

## Overview

The system now supports multiple Meta credentials, allowing you to manage leads from different Facebook pages and forms for different employees or teams. Each credential can have multiple form IDs, and leads are automatically routed to the assigned employee.

## Architecture

### Database Models

1. **MetaCredential** - Stores credential information
   - employeeName: Name of employee/team
   - verifyToken: Webhook verification token
   - pageId: Facebook Page ID
   - pageToken: Page Access Token
   - formIds: Array of lead form IDs
   - isActive: Enable/disable credential
   - lastSyncAt, lastSyncStatus, lastSyncMessage: Sync tracking
   - totalLeadsFetched: Counter for fetched leads

2. **MetaLead** - Stores fetched leads
   - leadgenId: Unique Meta lead ID
   - assignedTo: Assigned employee username
   - employeeName: Employee/team name
   - formId: Source form ID
   - pageId: Source page ID
   - leadData: Parsed lead information
   - fieldData: Raw Meta field data
   - isImportedToCRM: CRM import status
   - crmCustomerId: CRM customer ID if imported

3. **MetaSyncLog** - Sync operation logs
   - credentialId: Reference to credential
   - employeeName: Employee name
   - syncType: cron/manual/webhook
   - status: success/error/partial
   - leadsFetched, leadsImported, leadsSkipped: Counters
   - syncDuration: Operation duration in ms

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# MongoDB Connection (Required)
MONGODB_URI=mongodb://localhost:27017/dynaclean-crm

# Global Webhook Verify Token (Required)
FB_VERIFY_TOKEN=dynaclean-secret

# Optional: Cron Secret for API protection
CRON_SECRET=your-secret-key
```

### 2. MongoDB Setup

Ensure MongoDB is running and accessible via the `MONGODB_URI`.

The system will automatically create the required collections on first run.

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
import { startMetaLeadCron } from '@/lib/cron/metaLeadCron';

// Start the cron job when the app starts
if (typeof window === 'undefined') {
  startMetaLeadCron();
}
```

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
   - System finds matching credential by form ID
   - Lead is saved to MetaLead collection
   - Lead is automatically imported to CRM (customers table)
   - Lead is assigned to the employee from the credential

2. **Cron Flow:**
   - Cron runs every 10 minutes
   - Fetches all active credentials
   - For each credential:
     - Fetches leads from all form IDs (last 7 days)
     - Saves new leads to MetaLead collection
     - Auto-imports to CRM if not duplicate
   - Updates credential sync status
   - Creates sync log entry

3. **Manual Sync Flow:**
   - Admin triggers manual sync from UI
   - Same as cron flow but on-demand
   - Can specify custom date range

## Duplicate Protection

The system implements duplicate protection at multiple levels:

1. **MetaLead Collection:** Checks `leadgenId` uniqueness
2. **CRM Import:** Checks phone number (last 10 digits) against existing customers
3. Leads are skipped if already in either system

## Features

### Bonus Features Implemented

✅ Multiple credentials support
✅ Employee-wise lead routing
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
✅ Form ID array support
✅ Manual sync trigger
✅ Cron control (start/stop)
✅ Sync status per credential
✅ Total leads counter

## Troubleshooting

### Cron not starting
- Check MongoDB connection
- Verify MONGODB_URI in .env
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

### MongoDB connection issues
- Verify MongoDB is running
- Check MONGODB_URI in .env
- Ensure network connectivity
- Check MongoDB authentication if applicable

## Migration from Old System

The old single-credential system used MySQL `FB_credentials` table. The new system uses MongoDB.

To migrate:

1. Add credentials via the new Admin Panel
2. Old credentials will continue to work for Tamil form (hardcoded)
3. Gradually migrate other forms to the new system
4. Old system can be deprecated after migration

## Support

For issues or questions:
- Check sync logs for detailed error messages
- Review browser console for frontend errors
- Check server logs for backend errors
- Verify all environment variables are set
