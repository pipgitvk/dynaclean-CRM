# Dynamic Company Settings Implementation

This guide explains how the company settings are now dynamized in PDF exports.

## Overview

Company details (name, address, email) are now stored in the `app_settings` database table and dynamically loaded in PDF reports instead of being hardcoded.

## Files Modified/Created

### 1. API Endpoint
- **File**: `src/app/api/company-settings/route.js`
- **Purpose**: Provides GET/PUT endpoints to fetch and update company settings
- **Endpoints**:
  - `GET /api/company-settings` - Fetch all company settings
  - `PUT /api/company-settings` - Update a specific setting

### 2. Admin Dashboard - PDF Export
- **File**: `src/app/admin-dashboard/invoices/buyer/[buyerName]/BuyerLedgerTable.jsx`
- **Changes**:
  - Added `useEffect` hook to fetch company settings on component mount
  - Replaced hardcoded company info with `companySettings` state
  - PDF header now uses dynamic values

### 3. Accounts Dashboard - PDF Export
- **File**: `src/app/accounts-dashboard/invoices/buyer/[buyerName]/BuyerLedgerTable.jsx`
- **Changes**:
  - Same as admin dashboard version
  - Now uses dynamic company settings for PDF generation

### 4. Admin Settings Page
- **File**: `src/app/admin-dashboard/company-settings/page.jsx`
- **Purpose**: User interface to manage company information
- **Features**:
  - Edit company name, addresses, and email
  - Live preview of how it will appear in PDFs
  - Save button to persist changes to database

### 5. Database Migration
- **File**: `create_company_settings.sql`
- **Purpose**: SQL script to initialize company settings in `app_settings` table
- **Run**: Execute this once to set initial company details

## How to Use

### 1. Initialize Company Settings
Run the SQL migration:
```sql
-- Run in MySQL
source create_company_settings.sql;
```

Or manually insert:
```sql
INSERT INTO app_settings (setting_key, setting_value) VALUES
('company_name', 'Dynaclean Industries Pvt. Ltd.'),
('company_address_line1', '4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17'),
('company_address_line2', 'Dwarka'),
('company_email', 'sales@dynacleanindustries.com')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
```

### 2. Update Company Settings
Navigate to: `/admin-dashboard/company-settings`

- Fill in the company information
- Click "Save Settings" button
- Changes apply immediately to all new PDF exports

### 3. PDF Generation
When downloading PDF from:
- `/admin-dashboard/invoices/buyer/[buyerName]`
- `/accounts-dashboard/invoices/buyer/[buyerName]`

The PDF will automatically use the settings from the database.

## Database Table Structure

The `app_settings` table used:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Settings Keys

| Key | Example Value | Description |
|-----|---|---|
| `company_name` | Dynaclean Industries Pvt. Ltd. | Company name displayed at top of PDF |
| `company_address_line1` | 4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17 | First line of address |
| `company_address_line2` | Dwarka | City or second address line |
| `company_email` | sales@dynacleanindustries.com | Contact email |

## Default Fallback

If settings are not found in database, the components use these defaults:
```javascript
{
  company_name: "Dynaclean Industries Pvt. Ltd.",
  company_address_line1: "4th Floor, PLOT No-9, Block-B, Pocket-3, Sector-17",
  company_address_line2: "Dwarka",
  company_email: "sales@dynacleanindustries.com"
}
```

## PDF Layout

The company information appears as:
```
┌─────────────────────────────────┐
│ Dynaclean Industries Pvt. Ltd.  │  (company_name)
│ 4th Floor, PLOT No-9, ...       │  (company_address_line1)
│ Dwarka                          │  (company_address_line2)
│ E-Mail: sales@dynaclean...      │  (company_email)
└─────────────────────────────────┘
```

## Multi-Page Support

If a ledger spans multiple pages, the company header is repeated on each page with the correct page number.

## Notes

- Settings are cached on first load and refreshed when component mounts
- Changes take effect immediately after saving
- All users accessing PDF download will see the updated settings
- The settings page is only accessible through admin dashboard
- Email validation is client-side only (customize as needed)

## Future Enhancements

Consider adding:
- GST/Company Registration Number
- Phone Number
- Website URL
- Logo upload
- Multiple company profiles for multi-tenant setup
