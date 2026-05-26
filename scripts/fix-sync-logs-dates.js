const { getDbConnection } = require('../src/lib/db');

async function fixSyncLogsDates() {
  const conn = await getDbConnection();
  
  try {
    console.log('Updating NULL synced_at values in meta_sync_logs...');
    
    const [result] = await conn.execute(`
      UPDATE meta_sync_logs 
      SET synced_at = NOW() 
      WHERE synced_at IS NULL OR synced_at = '0000-00-00 00:00:00'
    `);
    
    console.log(`Updated ${result.affectedRows} records`);
    console.log('Migration completed');
  } catch (error) {
    console.error('Error updating sync logs:', error);
    throw error;
  }
}

fixSyncLogsDates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
