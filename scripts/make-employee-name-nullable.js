require('dotenv').config({ path: '../.env' });
const { getDbConnection } = require('../src/lib/db');

async function makeEmployeeNameNullable() {
  const conn = await getDbConnection();
  
  try {
    console.log('Making employee_name nullable in meta_credentials table...');
    
    // Check if column is already nullable
    const [columns] = await conn.execute(`
      SELECT IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'meta_credentials' 
      AND COLUMN_NAME = 'employee_name'
    `);
    
    if (columns.length > 0 && columns[0].IS_NULLABLE === 'YES') {
      console.log('Column employee_name is already nullable');
      return;
    }
    
    // Make the column nullable
    await conn.execute(`
      ALTER TABLE meta_credentials 
      MODIFY COLUMN employee_name VARCHAR(255) NULL
    `);
    
    console.log('Column employee_name made nullable successfully');
  } catch (error) {
    console.error('Error making column nullable:', error);
    throw error;
  }
}

makeEmployeeNameNullable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
