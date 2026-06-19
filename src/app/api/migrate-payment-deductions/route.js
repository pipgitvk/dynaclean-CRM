import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    // Only SUPERADMIN can run migrations
    const payload = await getSessionPayload();
    if (!payload || payload.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Only SUPERADMIN can run migrations" },
        { status: 403 }
      );
    }

    const conn = await getDbConnection();

    // Create payment_deductions table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS payment_deductions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        deduction_type VARCHAR(50) NOT NULL COMMENT 'LD, SD, TDS, Others',
        remarks TEXT,
        amount DECIMAL(15, 2) DEFAULT 0,
        recorded_by VARCHAR(100),
        recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES neworder(order_id),
        INDEX idx_order_id (order_id),
        INDEX idx_recorded_date (recorded_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    return NextResponse.json({
      success: true,
      message: "payment_deductions table created successfully"
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    );
  }
}
