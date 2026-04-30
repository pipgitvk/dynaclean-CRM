import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";

export async function GET() {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportees = await getReportees(session.username);
    console.log("Reportees for", session.username, ":", reportees);

    if (reportees.length === 0) {
      return NextResponse.json({ success: true, employees: [] });
    }

    const conn = await getDbConnection();
    const ph = reportees.map(() => "?").join(", ");
    const [rows] = await conn.execute(
      `SELECT username, empId, userRole, status 
       FROM rep_list 
       WHERE username IN (${ph}) 
       ORDER BY username`,
      reportees
    );

    return NextResponse.json({ 
      success: true, 
      employees: rows 
    });

  } catch (error) {
    console.error("Error fetching assigned employees:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}
