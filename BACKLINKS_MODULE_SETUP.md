# Backlinks Module Setup

## Status: ✅ COMPLETED

## Overview
Created a complete Backlinks management module under DM section, similar to Keywords module.

## Database Schema

### Table: `backlinks`
```sql
CREATE TABLE IF NOT EXISTS backlinks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  website VARCHAR(500) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  followup_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_to VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_website (website),
  INDEX idx_keyword (keyword),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_followup_date (followup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Fields
- **Website** (VARCHAR, Required) - URL of the website
- **Keyword** (VARCHAR, Required) - Associated keyword
- **Email** (VARCHAR) - Contact email
- **Followup Date** (DATE) - Next followup date
- **Status** (VARCHAR) - pending/in-progress/completed
- **Assigned To** (VARCHAR) - Username of assigned user

## API Endpoints

### GET `/api/backlinks`
- Fetch all backlinks
- Response: Array of backlink objects

### POST `/api/backlinks`
- Create new backlink
- Body: `{ website, keyword, email, followup_date, status, assigned_to }`

### PUT `/api/backlinks`
- Update backlink
- Body: `{ id, website, keyword, email, followup_date, status, assigned_to }`

### DELETE `/api/backlinks`
- Delete backlink
- Body: `{ id }`

## Components

### Admin Components
1. **BacklinksTable** - Full CRUD table for superadmin
   - Add backlinks
   - Edit backlinks
   - Delete backlinks
   - Search by website/keyword
   - Filter by status
   - Filter by assigned user

2. **AddBacklinkModal** - Modal to add new backlink with all fields

3. **EditBacklinkModal** - Modal to edit existing backlink

### User Components
1. **UserBacklinksTable** - Read-only view for assigned users
   - Shows only backlinks assigned to current user
   - Search by website/keyword
   - Filter by status
   - View website (clickable link)
   - View email (clickable mailto link)
   - No edit/delete permissions

## Pages

### Admin Dashboard
- `/admin-dashboard/backlinks` - Admin backlinks management

### User Dashboards (Read-only)
- `/user-dashboard/backlinks` - For regular users
- `/digital-marketing-dashboard/backlinks` - For digital marketers
- `/sales-dashboard/backlinks` - For sales team
- `/service-head-dashboard/backlinks` - For service heads
- `/hr-dashboard/backlinks` - For HR
- `/accounts-dashboard/backlinks` - For accountants

## Module Access
- Module Key: `backlinks-management`
- Parent: `digital-marketing`
- Admin can grant/revoke this module via Global Module Access
- Users with access see "DM > Backlinks" in sidebar

## Sidebar Configuration

### Admin Sidebar
DM Section now has:
- Keywords (accessKey: keywords-management)
- Backlinks (accessKey: backlinks-management)

### User Sidebar
DM Section now has:
- Keywords (moduleKey: keywords-management)
- Backlinks (moduleKey: backlinks-management)

## Setup Instructions

1. **Run SQL Migration**:
   ```sql
   CREATE TABLE IF NOT EXISTS backlinks (
     id INT AUTO_INCREMENT PRIMARY KEY,
     website VARCHAR(500) NOT NULL,
     keyword VARCHAR(255) NOT NULL,
     email VARCHAR(255),
     followup_date DATE,
     status VARCHAR(50) DEFAULT 'pending',
     assigned_to VARCHAR(255),
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_website (website),
     INDEX idx_keyword (keyword),
     INDEX idx_assigned_to (assigned_to),
     INDEX idx_status (status),
     INDEX idx_followup_date (followup_date)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```

2. **Test Admin Page**:
   - Navigate to Admin Dashboard > DM > Backlinks
   - Add a test backlink
   - Verify CRUD operations work

3. **Grant Module Access**:
   - Go to Admin Dashboard > Employees
   - Edit an employee
   - In Global Module Access section, grant "DM > Backlinks Management"
   - User should now see "DM > Backlinks" in their sidebar

4. **Test User Page**:
   - Login as granted user
   - Click DM > Backlinks
   - Should show only backlinks assigned to them
   - Should be read-only

## Files Created

### API
- `src/app/api/backlinks/route.js` - Full CRUD endpoints

### Admin Components
- `src/components/backlinks/BacklinksTable.jsx` - Admin table
- `src/components/backlinks/AddBacklinkModal.jsx` - Add modal
- `src/components/backlinks/EditBacklinkModal.jsx` - Edit modal

### User Components
- `src/components/backlinks/UserBacklinksTable.jsx` - User read-only table

### Admin Pages
- `src/app/admin-dashboard/backlinks/page.jsx` - Admin backlinks page

### User Pages
- `src/app/user-dashboard/backlinks/page.jsx`
- `src/app/digital-marketing-dashboard/backlinks/page.jsx`
- `src/app/sales-dashboard/backlinks/page.jsx`
- `src/app/service-head-dashboard/backlinks/page.jsx`
- `src/app/hr-dashboard/backlinks/page.jsx`
- `src/app/accounts-dashboard/backlinks/page.jsx`

### Database
- `create_backlinks_tables.sql` - Table creation script

### Configuration
- Updated `src/lib/moduleAccess.js` - Added backlinks to MODULE_TREE and SUPERADMIN_MODULE_UI_NODES
- Updated `src/lib/getAdminSidebarMenuItems.js` - Added backlinks to admin sidebar
- Updated `src/lib/getSidebarMenuItems.js` - Added backlinks to user sidebar

## Features

✅ **Full CRUD for Admin** - Create, Read, Update, Delete backlinks  
✅ **Read-only for Users** - Assigned users see only their backlinks  
✅ **Search functionality** - Search by website or keyword  
✅ **Filtering** - Filter by status and assigned user  
✅ **Link handling** - Clickable website URLs and email links  
✅ **Responsive design** - Desktop table and mobile cards  
✅ **Module access control** - Grant/revoke via Global Module Access  
✅ **Role-based routing** - Auto-transforms paths to role dashboards  
✅ **Toast notifications** - Success/error feedback  

## User Flow

### Admin
1. Navigate to Admin Dashboard > DM > Backlinks
2. Click "Add Backlink"
3. Fill in website, keyword, email, followup date, status
4. Select user to assign to
5. Click "Add Backlink"
6. View all backlinks in table
7. Edit or delete as needed

### Digital Marketer (or assigned user)
1. Navigate to DM > Backlinks (in sidebar)
2. Auto-filtered to show only their assigned backlinks
3. Can search and filter by status
4. Can click on website URLs or emails
5. Cannot add/edit/delete (read-only)

## Similar to Keywords Module
- Same structure as Keywords module
- Admin can manage all backlinks
- Users see only assigned ones
- Same access control mechanism
- Same UI/UX patterns
