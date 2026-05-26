const { getDbConnection } = require('../src/lib/db');

async function createMetaFormAssignmentsTable() {
  const conn = await getDbConnection();
  
  try {
    console.log('Creating meta_form_assignments table...');
    
    // Check if table already exists
    const [tables] = await conn.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'meta_form_assignments'
    `);
    
    if (tables.length > 0) {
      console.log('Table meta_form_assignments already exists');
      return;
    }
    
    // Create the table
    await conn.execute(`
      CREATE TABLE meta_form_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        form_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        priority INT DEFAULT 0,
        max_leads INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_form_user (form_id, username),
        INDEX idx_form_id (form_id),
        INDEX idx_priority (priority),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('Table meta_form_assignments created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

createMetaFormAssignmentsTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
