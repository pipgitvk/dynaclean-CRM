const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnExists(connection, tableName, columnName) {
    const [columns] = await connection.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [tableName, columnName]);
    return columns.length > 0;
}

async function runMigration() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS || process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Running migration: add_qty_to_product_accessories...');
        
        if (await columnExists(connection, 'product_accessories', 'qty')) {
            console.log('✓ Column qty already exists in product_accessories table');
        } else {
            await connection.execute(`
                ALTER TABLE product_accessories ADD COLUMN qty INT DEFAULT 1 COMMENT 'Quantity of the accessory' AFTER is_mandatory
            `);
            console.log('✓ Successfully added qty column to product_accessories table');
        }

        console.log('Running migration: add_spare_id_package_status_to_product_accessories...');

        if (!(await columnExists(connection, 'product_accessories', 'spare_id'))) {
            await connection.execute(`
                ALTER TABLE product_accessories
                  ADD COLUMN spare_id INT DEFAULT NULL COMMENT 'FK to spare_list.id' AFTER product_code
            `);
            console.log('✓ Successfully added spare_id column');
        } else {
            console.log('✓ Column spare_id already exists');
        }

        if (!(await columnExists(connection, 'product_accessories', 'package_status'))) {
            await connection.execute(`
                ALTER TABLE product_accessories
                  ADD COLUMN package_status ENUM('available', 'added') NOT NULL DEFAULT 'available'
                    COMMENT 'available=in package checklist, added=separate dispatch row' AFTER qty
            `);
            console.log('✓ Successfully added package_status column');
        } else {
            console.log('✓ Column package_status already exists');
        }

        const [indexes] = await connection.execute(`
            SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_accessories' AND INDEX_NAME = 'idx_spare_id'
        `);
        if (indexes.length === 0) {
            await connection.execute(`ALTER TABLE product_accessories ADD KEY idx_spare_id (spare_id)`);
            console.log('✓ Successfully added idx_spare_id index');
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
