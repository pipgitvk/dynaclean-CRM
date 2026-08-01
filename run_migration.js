const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS || process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Running migration: add_qty_to_product_accessories...');
        
        // Check if column already exists
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'product_accessories' AND COLUMN_NAME = 'qty'
        `);

        if (columns.length > 0) {
            console.log('✓ Column qty already exists in product_accessories table');
        } else {
            // Add the column
            await connection.execute(`
                ALTER TABLE product_accessories ADD COLUMN qty INT DEFAULT 1 COMMENT 'Quantity of the accessory' AFTER is_mandatory
            `);
            console.log('✓ Successfully added qty column to product_accessories table');
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

runMigration();
