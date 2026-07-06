# AMC/CMC Module Documentation

## Overview
Complete AMC/CMC (Annual Maintenance Contract/Comprehensive Maintenance Contract) management module with database, APIs, and frontend.

## Database Setup

### Migration File
**File:** `migrations/create_amc_cmc_table.sql`

**Table:** `amc_cmc`

**Fields:**
- `id` - Primary key, auto increment
- `serial_number` - Unique serial number (VARCHAR 255)
- `model` - Product model (VARCHAR 255)
- `image_at_the_time_of_amc` - Image path (VARCHAR 500)
- `company_name` - Company name (VARCHAR 255) - REQUIRED
- `contact` - Contact number (VARCHAR 20) - REQUIRED
- `email` - Email address (VARCHAR 255)
- `site_address` - Installation site address (TEXT)
- `site_contact` - Site contact number (VARCHAR 20)
- `site_email` - Site email (VARCHAR 255)
- `amc_start_datetime` - Contract start date (DATETIME) - REQUIRED
- `amc_end_datetime` - Contract end date (DATETIME) - REQUIRED
- `quotation_ref` - Quotation reference (VARCHAR 255)
- `invoice` - Invoice file path (VARCHAR 500)
- `payment_proof` - Payment proof file path (VARCHAR 500)
- `terms_and_conditions` - T&C text (TEXT)
- `created_by` - Created by user (VARCHAR 255)
- `created_time` - Creation timestamp (DATETIME)
- `approved_by` - Approved by user (VARCHAR 255)
- `approved_time` - Approval timestamp (DATETIME)
- `status` - ENUM ('pending', 'approved', 'rejected', 'expired')

**Indexes:**
- `idx_serial_number` on serial_number
- `idx_status` on status
- `idx_created_time` on created_time
- `idx_amc_end_datetime` on amc_end_datetime

### How to Run Migration
```sql
-- Connect to your database and run:
SOURCE migrations/create_amc_cmc_table.sql;
```

## API Endpoints

### 1. List All AMC/CMC Records
**Endpoint:** `GET /api/amc-cmc`

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 50) - Records per page
- `search` - Search by serial_number, company_name, contact, email, quotation_ref
- `status` - Filter by status (pending, approved, rejected, expired)

**Response:**
```json
{
  "records": [...],
  "total": 100,
  "totalPages": 2,
  "currentPage": 1,
  "pageSize": 50
}
```

### 2. Create AMC/CMC Record
**Endpoint:** `POST /api/amc-cmc`

**Request:** FormData with following fields:
- `serial_number` * (required)
- `model`
- `company_name` * (required)
- `contact` * (required)
- `email`
- `site_address`
- `site_contact`
- `site_email`
- `amc_start_datetime` * (required)
- `amc_end_datetime` * (required)
- `quotation_ref`
- `terms_and_conditions`
- `image_at_the_time_of_amc` (file upload)
- `invoice` (file upload - PDF/Image)
- `payment_proof` (file upload - PDF/Image)

**Validations:**
- serial_number, company_name, contact, amc_start_datetime, amc_end_datetime are required
- amc_end_datetime must be > amc_start_datetime
- email and site_email must be valid email format if provided
- created_by is auto-filled from session

**Response:**
```json
{
  "success": true,
  "message": "AMC/CMC record created successfully"
}
```

### 3. Get Single Record
**Endpoint:** `GET /api/amc-cmc/[id]`

**Response:** Single record object

### 4. Update AMC/CMC Record
**Endpoint:** `PUT /api/amc-cmc/[id]`

**Request:** FormData (same as POST)

**Response:**
```json
{
  "success": true,
  "message": "AMC/CMC record updated successfully"
}
```

### 5. Delete AMC/CMC Record
**Endpoint:** `DELETE /api/amc-cmc/[id]`

**Response:**
```json
{
  "success": true,
  "message": "AMC/CMC record deleted successfully"
}
```

### 6. Approve/Reject AMC/CMC Record
**Endpoint:** `PUT /api/amc-cmc/[id]/approve`

**Request Body:**
```json
{
  "action": "approve" // or "reject"
}
```

**Response:**
```json
{
  "success": true,
  "message": "AMC/CMC record approved successfully"
}
```

**Notes:**
- Sets status to 'approved' or 'rejected'
- Updates approved_by with logged-in user
- Updates approved_time to current timestamp

## Frontend Pages

### 1. List Page
**Route:** `/admin-dashboard/amc-cmc`

**File:** `src/app/admin-dashboard/amc-cmc/page.jsx`

**Features:**
- Table view with pagination
- Search by serial number, company, contact, email, quotation ref
- Filter by status (all, pending, approved, rejected, expired)
- Status badges with color coding:
  - Pending = Yellow
  - Approved = Green
  - Rejected = Red
  - Expired = Gray
- Quick actions: View, Edit, Approve, Reject, Delete
- Delete confirmation modal
- Responsive design (desktop & mobile)

### 2. Add Form
**Route:** `/admin-dashboard/amc-cmc/add`

**File:** `src/app/admin-dashboard/amc-cmc/add/page.jsx`

**Features:**
- Complete form with all fields
- File upload for:
  - Image at time of AMC
  - Invoice (PDF/Image)
  - Payment Proof (PDF/Image)
- Form validation using react-hook-form
- Date/time picker for AMC period
- Toast notifications for feedback
- Auto-redirect after successful creation

### 3. Edit Page (To be created)
**Route:** `/admin-dashboard/amc-cmc/edit/[id]`

**Features:**
- Pre-populated form with existing data
- File upload to replace or add files
- Same validations as Add form
- Update functionality

### 4. View/Details Page (To be created)
**Route:** `/admin-dashboard/amc-cmc/view/[id]`

**Features:**
- Display all record details
- Show all documents
- Approval status and timeline
- Link to edit page

## Usage Example

### Create Record via API
```bash
curl -X POST http://localhost:3000/api/amc-cmc \
  -F "serial_number=SN123456" \
  -F "company_name=Company XYZ" \
  -F "contact=9876543210" \
  -F "email=contact@company.com" \
  -F "amc_start_datetime=2026-01-01T00:00:00" \
  -F "amc_end_datetime=2027-01-01T00:00:00" \
  -F "image_at_the_time_of_amc=@image.jpg" \
  -F "invoice=@invoice.pdf" \
  -F "payment_proof=@payment.pdf"
```

### Approve Record via API
```bash
curl -X PUT http://localhost:3000/api/amc-cmc/1/approve \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}'
```

## Status Transitions

- **Pending** → Can be approved, rejected, or deleted
- **Approved** → Display as approved, can be edited
- **Rejected** → Can be edited and resubmitted
- **Expired** → Auto-status when end_date passes (needs background job)

## File Upload Handling

Currently stores filenames in database. For production, implement:

1. **File Storage:**
   - Save files to `/public/uploads/amc-cmc/` directory
   - Use unique filenames with timestamp and random number
   - Return file URL for retrieval

2. **File Retrieval:**
   - Create API endpoint to serve files: `/api/uploads/amc-cmc/[filename]`
   - Implement access control
   - Handle file deletion on record delete

## TODO/Future Enhancements

1. Create Edit page (`src/app/admin-dashboard/amc-cmc/edit/[id]/page.jsx`)
2. Create View/Details page (`src/app/admin-dashboard/amc-cmc/view/[id]/page.jsx`)
3. Implement actual file upload and storage
4. Add background job to auto-update status to 'expired' when date passes
5. Add email notifications for:
   - New AMC/CMC creation
   - Approval/Rejection
   - Upcoming expiry reminders
6. Add bulk operations (bulk approve, bulk export)
7. Add dashboard/reports for AMC/CMC statistics
8. Add customer dashboard view for their AMC/CMC records
9. Implement file download endpoint
10. Add audit trail logging

## Authentication & Authorization

- All endpoints require authenticated session (via `getSessionPayload()`)
- `created_by` is auto-filled from logged-in user
- `approved_by` is auto-filled from logged-in user when approving
- Add role-based access control as needed

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad request (validation errors)
- `401` - Unauthorized
- `404` - Not found
- `500` - Server error

## Testing

### Test Add Record
1. Go to `/admin-dashboard/amc-cmc/add`
2. Fill all required fields
3. Upload documents
4. Submit
5. Should redirect to list page with success message

### Test List & Filter
1. Go to `/admin-dashboard/amc-cmc`
2. Search by serial number
3. Filter by status
4. Verify pagination

### Test Approval
1. Click Approve button on pending record
2. Record should show as approved
3. Approve button should disappear

## Notes

- Project uses Next.js 13+ with App Router
- Authentication via `getSessionPayload()` from `@/lib/auth`
- Database via `getDbConnection()` from `@/lib/db`
- UI Framework: Tailwind CSS
- Form Library: react-hook-form
- Toast Notifications: react-hot-toast
- Icons: lucide-react
