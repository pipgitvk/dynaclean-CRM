
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conn = await getDbConnection();
    const [dbNameResult] = await conn.query("SELECT DATABASE() AS current_db");
    const currentDb = dbNameResult[0].current_db;

    const [testRecords] = await conn.query(
      "SELECT * FROM service_records WHERE service_id IN (235178, 235175)"
    );

    return NextResponse.json({
      success: true,
      current_database: currentDb,
      test_records_found: testRecords.length,
      test_records: testRecords
    });
  } catch (error) {
    console.error("❌ Debug API Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

