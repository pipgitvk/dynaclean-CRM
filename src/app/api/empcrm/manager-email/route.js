import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

/**
 * GET /api/empcrm/manager-email?username=<employee_username>
 * 
 * Flow:
 *  1. Get the employee's reporting_manager (username) from rep_list
 *  2. Look up that manager's email from rep_list using their username
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ success: false, error: "username param required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Step 1: Get reporting_manager username from the employee's rep_list row
    const [empRows] = await conn.execute(
      `SELECT reporting_manager FROM rep_list WHERE username = ? LIMIT 1`,
      [username]
    );

    if (!empRows.length || !empRows[0].reporting_manager) {
      return NextResponse.json({ success: false, error: "No reporting manager assigned" });
    }

    const managerUsername = empRows[0].reporting_manager;

    // Step 2: Get that manager's email from rep_list
    const [managerRows] = await conn.execute(
      `SELECT username, email FROM rep_list WHERE username = ? LIMIT 1`,
      [managerUsername]
    );

    if (!managerRows.length) {
      return NextResponse.json({ success: false, error: "Reporting manager not found in rep_list" });
    }

    // Step 3: Try to get manager's full_name from employee_profiles
    let managerFullName = managerUsername;
    try {
      const [nameRows] = await conn.execute(
        `SELECT full_name FROM employee_profiles WHERE username = ? LIMIT 1`,
        [managerUsername]
      );
      if (nameRows.length && nameRows[0].full_name) {
        managerFullName = nameRows[0].full_name;
      }
    } catch {
      // fallback to username
    }

    return NextResponse.json({
      success: true,
      manager_username: managerUsername,
      manager_name: managerFullName,
      email: managerRows[0].email || null,
    });
  } catch (error) {
    console.error("manager-email API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
