const { getDbConnection } = require("./src/lib/db");

async function fixItemCode() {
  const conn = await getDbConnection();
  
  try {
    // Update item_code back to DRS-3000EV for the Electric Road Sweeper
    const [result] = await conn.execute(`
      UPDATE products_list 
      SET item_code = 'DRS-3000EV' 
      WHERE item_name = 'DRS-3000EV' 
      AND item_code = 'Electric Road Sweeper DRS-3000EV'
    `);
    
    console.log("Updated rows:", result.affectedRows);
    
    // Also update item_name back to original if needed
    const [result2] = await conn.execute(`
      UPDATE products_list 
      SET item_name = 'Electric Road Sweeper DRS-3000EV' 
      WHERE item_code = 'DRS-3000EV'
    `);
    
    console.log("Updated item_name rows:", result2.affectedRows);
    
    // Verify the change
    const [rows] = await conn.execute(`
      SELECT item_code, item_name, product_image 
      FROM products_list 
      WHERE item_code = 'DRS-3000EV'
    `);
    
    console.log("Updated record:", rows);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await conn.end();
  }
}

fixItemCode();
