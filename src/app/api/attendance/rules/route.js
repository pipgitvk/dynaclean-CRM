import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { rowToAttendanceRulesShape } from "@/lib/attendanceRulesDb";

/** GET — global rules (legacy path; returns normalized { rules } + raw row for compatibility) */
export async function GET() {
  try {
    const conn = await getDbConnection();
    const row = await loadGlobalAttendanceRulesRow(conn);
    const rules = rowToAttendanceRulesShape(row);
    return NextResponse.json({
      rules,
      row,
    });
  } catch (error) {
    console.error("attendance/rules GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
