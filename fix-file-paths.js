require('dotenv').config();
const { getDbConnection } = require('./src/lib/db');

async function fixFilePaths() {
  const db = await getDbConnection();
  
  const tables = [
    'spare_stock_request',
    'stock_request',
    'warehouse_in',
    'spare_warehouse_in',
    'direct_in',
    'spare_direct_in'
  ];
  
  const columns = [
    'quotation_upload',
    'payment_proof_upload',
    'invoice_upload',
    'spare_image',
    'eway_bill',
    'received_image',
    'supporting_doc'
  ];
  
  for (const table of tables) {
    try {
      const [columnsResult] = await db.execute(`SHOW COLUMNS FROM ${table}`);
      const tableColumns = columnsResult.map(col => col.Field);
      
      for (const column of columns) {
        if (!tableColumns.includes(column)) continue;
        
        const [rows] = await db.execute(
          `SELECT id, ${column} FROM ${table} WHERE ${column} LIKE '/ADMIN/STOCK_REQUESTS/%'`
        );
        
        if (rows.length === 0) continue;
        
        console.log(`Found ${rows.length} records in ${table}.${column} to fix`);
        
        for (const row of rows) {
          const oldPath = row[column];
          const newPath = oldPath.replace('/ADMIN/STOCK_REQUESTS/', 'ADMIN/STOCK_REQUESTS/');
          
          await db.execute(
            `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
            [newPath, row.id]
          );
          
          console.log(`  Updated record ${row.id}: ${oldPath} -> ${newPath}`);
        }
      }
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`Table ${table} does not exist, skipping`);
      } else {
        console.error(`Error processing table ${table}:`, error.message);
      }
    }
  }
  
  console.log('Migration completed');
  await db.end();
}

fixFilePaths().catch(console.error);
