import { getDbConnection } from "@/lib/db";

/**
 * Ensures the quotations_records table has proper schema.
 * Fixes issues with s_no column if it's preventing new quotations from being created.
 */
export async function ensureQuotationsSchema() {
  try {
    const conn = await getDbConnection();

    // Check if quotations_records table exists
    const [tables] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records'`
    );

    if (tables.length === 0) {
      console.log("⚠️ quotations_records table does not exist. Skipping schema check.");
      return;
    }

    // Check the current structure
    const [columns] = await conn.execute(
      `SELECT COLUMN_NAME, COLUMN_KEY, EXTRA, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records'`
    );

    console.log("📋 Current quotations_records columns:");
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: PK=${col.COLUMN_KEY === 'PRI' ? 'YES' : 'NO'}, AUTO_INC=${col.EXTRA.includes('auto_increment') ? 'YES' : 'NO'}, NULL=${col.IS_NULLABLE}`);
    });

    // Check if s_no is the primary key
    const sNoColumn = columns.find(col => col.COLUMN_NAME === 's_no');
    if (sNoColumn && sNoColumn.COLUMN_KEY === 'PRI') {
      console.warn("⚠️ Found s_no as PRIMARY KEY. This may cause insertion issues.");
      console.warn("   Recommendation: Drop s_no PRIMARY KEY constraint if quote_number is the intended unique identifier.");
    }

    // Check if quote_number has a unique constraint
    const quoteNumberColumn = columns.find(col => col.COLUMN_NAME === 'quote_number');
    if (quoteNumberColumn) {
      console.log(`✅ quote_number exists: ${quoteNumberColumn.COLUMN_KEY === 'UNI' ? 'UNIQUE' : 'NON-UNIQUE'}`);
    }

  } catch (error) {
    console.error("Error checking quotations_records schema:", error.message);
  }
}

/**
 * Fixes the s_no issue by dropping it as PRIMARY KEY if quote_number should be unique instead.
 * CAUTION: This is a destructive operation. Call only if you're sure about the schema change.
 */
export async function fixQuotationsSnoPrimaryKey() {
  try {
    const conn = await getDbConnection();

    console.log("🔧 Attempting to fix s_no PRIMARY KEY issue...");

    // First, check if s_no is PRIMARY KEY
    const [keyInfo] = await conn.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' AND COLUMN_NAME = 's_no' AND CONSTRAINT_NAME = 'PRIMARY'`
    );

    if (keyInfo.length > 0) {
      console.log("   Dropping s_no as PRIMARY KEY...");
      await conn.execute(`ALTER TABLE quotations_records DROP PRIMARY KEY`);
      console.log("✅ Dropped s_no PRIMARY KEY");

      // Now add quote_number as PRIMARY KEY or UNIQUE
      const [quoteConstraints] = await conn.execute(
        `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' AND COLUMN_NAME = 'quote_number'`
      );

      if (quoteConstraints.length === 0) {
        console.log("   Adding quote_number as UNIQUE constraint...");
        await conn.execute(`ALTER TABLE quotations_records ADD UNIQUE KEY uk_quote_number (quote_number)`);
        console.log("✅ Added UNIQUE constraint on quote_number");
      } else {
        console.log("✅ quote_number already has a constraint");
      }

      // Add s_no as AUTO_INCREMENT but not PRIMARY KEY
      const [columns] = await conn.execute(
        `SELECT EXTRA FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' AND COLUMN_NAME = 's_no'`
      );

      if (columns.length > 0 && !columns[0].EXTRA.includes('auto_increment')) {
        console.log("   Adding AUTO_INCREMENT to s_no...");
        await conn.execute(`ALTER TABLE quotations_records MODIFY s_no INT AUTO_INCREMENT UNIQUE`);
        console.log("✅ Modified s_no to be AUTO_INCREMENT UNIQUE");
      }

      console.log("✅ Successfully fixed quotations_records schema");
      return true;
    } else {
      console.log("ℹ️  s_no is not a PRIMARY KEY. Schema appears correct.");
      return false;
    }

  } catch (error) {
    console.error("❌ Error fixing quotations_records schema:", error.message);
    throw error;
  }
}
