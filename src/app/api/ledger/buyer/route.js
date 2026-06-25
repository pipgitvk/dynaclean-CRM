import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/ledger/buyer?name=XYZ
// Returns ledger entries for a specific buyer
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const buyerName = searchParams.get("name");

  if (!buyerName) {
    return NextResponse.json({ error: "name param required" }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();

    // Auto-create ledger table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_date    DATE          NOT NULL,
        particulars   VARCHAR(500)  NOT NULL,
        vch_type      VARCHAR(100)  NOT NULL DEFAULT '',
        vch_no        VARCHAR(100)  NOT NULL DEFAULT '',
        debit         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        credit        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        buyer_name    VARCHAR(255)  NULL,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Ensure buyer_name column exists (for existing tables)
    try {
      await conn.execute("SELECT buyer_name FROM ledger_entries LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE ledger_entries ADD COLUMN buyer_name VARCHAR(255) NULL");
      } catch (__) {}
    }

    const [rows] = await conn.execute(
      `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, created_at
       FROM ledger_entries
       WHERE buyer_name = ?
       ORDER BY entry_date DESC, id DESC`,
      [buyerName]
    );

    return NextResponse.json({ success: true, entries: rows });
  } catch (err) {
    console.error("[ledger/buyer GET]", err?.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
