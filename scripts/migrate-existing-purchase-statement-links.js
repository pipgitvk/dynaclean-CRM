const mysql = require('mysql2/promise');
require('dotenv').config();

async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dynaclean_crm1'
  });
}

function parseLinkedPurchaseTokens(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  let arr = null;
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) arr = parsed;
  } catch {
    arr = String(raw).split(",").map(s => s.trim()).filter(Boolean);
  }
  const out = [];
  for (const v of arr || []) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(PP|PS|SP)\d+$/.test(s)) {
      out.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
    } else if (/^\d+$/.test(s)) {
      out.push(`PP${s}`);
    }
  }
  return out;
}

async function migrateExistingLinks() {
  const conn = await getDbConnection();
  
  try {
    console.log('Starting migration of existing purchase-statement links (using trans_id)...');
    
    // Add column if it doesn't exist
    try {
      await conn.execute("ALTER TABLE product_stock_request ADD COLUMN linked_statement_ids TEXT NULL");
      console.log('Added linked_statement_ids column to product_stock_request');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('Column linked_statement_ids already exists');
      } else {
        throw e;
      }
    }
    
    // Clear existing data first (since we're switching from id to trans_id)
    console.log('Clearing existing linked_statement_ids data...');
    await conn.execute("UPDATE product_stock_request SET linked_statement_ids = NULL WHERE linked_statement_ids IS NOT NULL");
    
    // Get all statements with linked purchases
    const [statements] = await conn.execute(`
      SELECT id, trans_id, linked_purchase_ids 
      FROM statements 
      WHERE linked_purchase_ids IS NOT NULL 
      AND linked_purchase_ids != ''
      AND linked_purchase_ids != 'null'
    `);
    
    console.log(`Found ${statements.length} statements with linked purchases`);
    
    let updatedCount = 0;
    
    for (const stmt of statements) {
      const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
      
      for (const token of tokens) {
        // Only process PP (product purchase) tokens
        if (token.startsWith('PP')) {
          const purchaseId = parseInt(token.substring(2));
          
          // Check if this purchase exists in product_stock_request
          const [purchases] = await conn.execute(
            'SELECT id, linked_statement_ids FROM product_stock_request WHERE id = ?',
            [purchaseId]
          );
          
          if (purchases.length > 0) {
            let currentTransIds = [];
            try {
              if (purchases[0].linked_statement_ids) {
                currentTransIds = JSON.parse(purchases[0].linked_statement_ids);
              }
            } catch (e) {
              console.warn(`Invalid JSON in purchase ${purchaseId}, resetting`);
              currentTransIds = [];
            }
            
            // Add trans_id if not already present
            if (!currentTransIds.includes(stmt.trans_id)) {
              currentTransIds.push(stmt.trans_id);
              
              await conn.execute(
                'UPDATE product_stock_request SET linked_statement_ids = ? WHERE id = ?',
                [JSON.stringify(currentTransIds), purchaseId]
              );
              
              console.log(`Updated purchase ${purchaseId} with statement trans_id ${stmt.trans_id}`);
              updatedCount++;
            }
          }
        }
      }
    }
    
    console.log(`Migration completed! Updated ${updatedCount} purchase records with trans_ids.`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await conn.end();
  }
}

// Run the migration
migrateExistingLinks();