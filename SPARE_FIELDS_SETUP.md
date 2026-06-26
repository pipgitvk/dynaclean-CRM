# Spare Fields Database Setup

## Issue
The new fields (Type, Make, Model, Compatible Machines, Tax) added to the spare part form are not saving to the database because the database table is missing these columns.

## Solution
Run the migration script to add these columns to the `spare_list` table.

### Steps to Execute:

#### Option 1: Using MySQL Command Line
```bash
mysql -u [username] -p [database_name] < add_spare_fields.sql
```

#### Option 2: Using MySQL Workbench or phpMyAdmin
1. Open your MySQL admin panel
2. Go to the database: `[your_database_name]`
3. Open the "SQL Editor" or "Query" tab
4. Copy and paste the contents of `add_spare_fields.sql`
5. Click "Execute" or press `Ctrl+Enter`

#### Option 3: Using Node.js Script
Run this command in your project root:
```bash
node -e "
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'your_user',
    password: 'your_password',
    database: 'your_db'
  });
  const sql = require('fs').readFileSync('./add_spare_fields.sql', 'utf8');
  await conn.query(sql);
  console.log('Migration complete!');
  await conn.end();
})();
"
```

### What Gets Added:
- `type` - VARCHAR(50) - Type of spare (Raw Materials, Consumables, Spares)
- `make` - VARCHAR(255) - Manufacturer/Make
- `model` - VARCHAR(255) - Model number
- `compatible_machine` - TEXT - Comma-separated compatible machines
- `tax` - DECIMAL(5,2) - Tax percentage

### Verification
After running the migration, verify the columns were added:

```sql
DESCRIBE spare_list;
```

You should see the new columns listed.

### After Migration
1. Clear your browser cache (Ctrl+Shift+Delete)
2. Refresh the application
3. Try adding a new spare part with Type, Make, Model, and Compatible Machines
4. Try editing an existing spare to add/update these fields
5. All fields should now save correctly!

## Troubleshooting

**Error: "Column already exists"**
- The columns have already been added. No action needed.

**Error: "Access Denied"**
- Make sure your MySQL user has ALTER TABLE permissions
- Contact your database administrator if needed

**Fields still not showing**
- Clear your browser cache completely
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser DevTools Console for any errors
