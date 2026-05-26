require('dotenv').config();
const { getDbConnection } = require('../src/lib/db');

async function addTotalLeadsImportedColumn() {
  const conn = await getDbConnection();
  
  try {
    console.log('Adding total_leads_imported column to meta_credentials table...');
    
    // Check if column already exists
    const [columns] = await conn.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'meta_credentials' 
      AND COLUMN_NAME = 'total_leads_imported'
    `);
    
    if (columns.length > 0) {
      console.log('Column total_leads_imported already exists');
      return;
    }
    
    // Add the column
    await conn.execute(`
      ALTER TABLE meta_credentials 
      ADD COLUMN total_leads_imported INT DEFAULT 0 AFTER total_leads_fetched
    `);
    
    console.log('Column total_leads_imported added successfully');
  } catch (error) {
    console.error('Error adding column:', error);
    throw error;
  }
}

addTotalLeadsImportedColumn()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
