# Keywords Module Setup Guide

## Overview
A complete Keywords Management module has been added to the superadmin dashboard under the "Targets" section. This module includes two main tables: Keywords and Keywords Followups.

## Features Implemented

### 1. Database Tables
- **keywords** - Stores keyword data with fields: keyword, page_rank, assigned_to, updated_at, created_at
- **keywords_followups** - Tracks followups for each keyword with: followup_date, status, notes

### 2. API Endpoints

#### Keywords API (`/api/keywords`)
- **GET** - Fetch all keywords
- **POST** - Create new keyword (required: keyword, optional: page_rank, assigned_to)
- **PUT** - Update keyword (required: id, keyword, optional: page_rank, assigned_to)
- **DELETE** - Delete keyword (required: id)

#### Keywords Followups API (`/api/keywords-followups`)
- **GET** - Fetch followups for a keyword (query param: keyword_id)
- **POST** - Create followup (required: keyword_id, optional: followup_date, status, notes)
- **PUT** - Update followup (required: id, optional: followup_date, status, notes)
- **DELETE** - Delete followup (required: id)

### 3. UI Components

#### Main Components
- **KeywordsTable** - Main table view with search functionality
  - Desktop table with columns: Keyword, Page Rank, Updated Date, Assigned To
  - Mobile card view for responsive design
  - Search and filter capabilities
  
- **AddKeywordModal** - Modal to add new keywords
  - Fields: Keyword (required), Page Rank, Assigned To (with user dropdown)
  
- **EditKeywordModal** - Modal to edit existing keywords
  - All keyword fields editable
  - Pre-populated with existing data

- **KeywordFollowupsModal** - Shows all followups for a keyword
  - Table view of followups with Date, Status, Notes
  - Add/Edit/Delete followup options
  - Status badges (pending, in-progress, completed)

- **AddFollowupModal** - Modal to add new followup
  - Fields: Followup Date (required), Status (dropdown), Notes (textarea)
  
- **EditFollowupModal** - Modal to edit existing followup
  - All followup fields editable

### 4. Navigation
Keywords option is now available in the sidebar under:
**Targets > Keywords**

Path: `/admin-dashboard/keywords`

## File Structure

```
src/
├── app/
│   ├── admin-dashboard/
│   │   └── keywords/
│   │       └── page.jsx
│   ├── api/
│   │   ├── keywords/
│   │   │   └── route.js
│   │   └── keywords-followups/
│   │       └── route.js
│   └── lib/
│       └── getAdminSidebarMenuItems.js (updated)
└── components/
    └── keywords/
        ├── AddFollowupModal.jsx
        ├── AddKeywordModal.jsx
        ├── EditFollowupModal.jsx
        ├── EditKeywordModal.jsx
        ├── KeywordFollowupsModal.jsx
        └── KeywordsTable.jsx
```

## Database Schema

### keywords table
```sql
CREATE TABLE keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  page_rank INT DEFAULT 0,
  assigned_to VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_keyword (keyword)
);
```

### keywords_followups table
```sql
CREATE TABLE keywords_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword_id INT NOT NULL,
  followup_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE,
  INDEX idx_keyword_id (keyword_id),
  INDEX idx_followup_date (followup_date),
  INDEX idx_status (status)
);
```

## Key Features

1. **Full CRUD Operations** - Create, Read, Update, Delete for both keywords and followups
2. **Responsive Design** - Mobile-first responsive tables and modals
3. **Search Functionality** - Search keywords by keyword name or assigned user
4. **User Assignment** - Assign keywords to team members with autocomplete dropdown
5. **Followup Tracking** - Track multiple followups per keyword with dates, status, and notes
6. **Status Management** - Three status options: Pending, In Progress, Completed
7. **Toast Notifications** - User feedback for all operations
8. **Error Handling** - Comprehensive error handling in API and components

## Usage

### Adding a Keyword
1. Navigate to **Admin Dashboard > Targets > Keywords**
2. Click **"Add Keyword"** button
3. Fill in the form:
   - Keyword (required)
   - Page Rank (optional)
   - Assigned To (optional - with autocomplete)
4. Click **"Add Keyword"** to save

### Viewing Followups
1. Click the **eye icon** on any keyword row
2. Modal opens showing all followups for that keyword
3. Click **"Add Followup"** to add a new followup with:
   - Date (required)
   - Status (pending/in-progress/completed)
   - Notes (optional)

### Editing/Deleting
- **Edit**: Click the **green edit icon** to modify keyword/followup details
- **Delete**: Click the **red trash icon** to remove keyword/followup (with confirmation)

## Technical Notes

- Uses React hooks (useState, useEffect, useMemo) for state management
- Integrates with existing user search API (`/api/reassignresp`)
- Date formatting uses en-GB locale (DD-MMM-YYYY)
- All API responses follow NextResponse.json pattern
- Modals use fixed positioning with backdrop overlay
- Toast notifications via react-hot-toast library
- Responsive design using Tailwind CSS

## Access Control
- Keywords module is restricted to SUPERADMIN role
- Module key: `keywords-management`

## Future Enhancements
- Bulk operations (bulk delete, bulk reassign)
- Export to CSV/Excel
- Filter by status, date range, assigned user
- Keyword performance analytics/charts
- Integration with SEO tools for automatic page rank updates
- Email notifications for pending followups
