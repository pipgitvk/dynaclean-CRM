import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();

    const checkAndAddQuery = `
      SET @col := (
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'invoices'
          AND COLUMN_NAME = 'quote_number'
          AND TABLE_SCHEMA = DATABASE()
      );

      SET @sql := IF(
        @col = 0,
        'ALTER TABLE invoices ADD COLUMN quote_number VARCHAR(50) NOT NULL AFTER quotation_id',
        'SELECT "Column already exists"'
      );

      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    `;

    await conn.query(checkAndAddQuery);

    return NextResponse.json({
      success: true,
      message: "Migration executed: quote_number column ensured",
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
