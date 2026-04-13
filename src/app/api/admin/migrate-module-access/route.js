// One-time migration: adds module_access column to rep_list if missing.
// Call: POST /api/admin/migrate-module-access  (SUPERADMIN only)
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";

export async function POST() {
  const payload = await getMainSessionPayload();
  if (payload?.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const db = await getDbConnection();

    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rep_list' AND COLUMN_NAME = 'module_access'`
    );

    if (cols.length === 0) {
      await db.query(
        `ALTER TABLE rep_list ADD COLUMN module_access TEXT NULL DEFAULT NULL`
      );
      return NextResponse.json({ message: "Column module_access added successfully." });
    }

    return NextResponse.json({ message: "Column module_access already exists. Nothing to do." });
  } catch (err) {
    console.error("migrate-module-access error:", err);
    return NextResponse.json({ message: err.message || "Internal server error." }, { status: 500 });
  }
}
