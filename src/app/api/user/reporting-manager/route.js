import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getReportingManagerForEmployee } from "@/lib/reportingManager";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get reporting manager username
    const managerUsername = await getReportingManagerForEmployee(session.username);
    
    if (!managerUsername) {
      return NextResponse.json({ 
        success: true, 
        reportingManager: null,
        message: "No reporting manager assigned",
        debug: {
          sessionUsername: session.username,
          managerUsername: managerUsername
        }
      });
    }

    // Get manager details from rep_list table
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT username, email, userRole 
       FROM rep_list 
       WHERE username = ? AND status = 1 LIMIT 1`,
      [managerUsername]
    );

    if (rows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        reportingManager: null,
        message: "Reporting manager not found in rep_list records" 
      });
    }

    const manager = rows[0];
    const managerName = manager.username;

    return NextResponse.json({
      success: true,
      reportingManager: {
        username: manager.username,
        name: managerName,
        email: manager.email
      }
    });

  } catch (error) {
    console.error("Error fetching reporting manager:", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
