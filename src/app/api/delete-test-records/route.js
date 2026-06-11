
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conn = await getDbConnection();
    const testIds = [235178, 235175, 23518, 235335, 235329, 235299];

    // First, confirm they exist
    const [beforeDelete] = await conn.query(
      "SELECT * FROM service_records WHERE service_id IN (?)",
      [testIds]
    );
    console.log("Before delete, found records:", beforeDelete.length);

    // Delete them!
    const [deleteResult] = await conn.query(
      "DELETE FROM service_records WHERE service_id IN (?)",
      [testIds]
    );
    console.log("Delete result:", deleteResult);

    // Confirm they're gone
    const [afterDelete] = await conn.query(
      "SELECT * FROM service_records WHERE service_id IN (?)",
      [testIds]
    );

    return NextResponse.json({
      success: true,
      before_delete_count: beforeDelete.length,
      delete_affected_rows: deleteResult.affectedRows,
      after_delete_count: afterDelete.length,
      message: "Records deleted successfully!"
    });
  } catch (error) {
    console.error("❌ Delete API Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

