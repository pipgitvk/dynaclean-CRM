import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();

    // Get a list of available managers (employees with admin/manager roles)
    const [managerRows] = await conn.execute(
      `SELECT username, userRole FROM rep_list 
       WHERE userRole IN ('ADMIN', 'SUPERADMIN', 'HR', 'MANAGER') AND status = 1
       LIMIT 5`
    );

    if (managerRows.length === 0) {
      return NextResponse.json({ error: "No managers found in system" }, { status: 404 });
    }

    // Pick the first available manager
    const selectedManager = managerRows[0];
    const managerName = selectedManager.username;

    // Check if rep_list has reporting_manager column
    const [columns] = await conn.execute(
      `SHOW COLUMNS FROM rep_list LIKE 'reporting_manager'`
    );
    if (columns.length === 0) {
      await conn.execute(
        `ALTER TABLE rep_list ADD COLUMN reporting_manager VARCHAR(255) DEFAULT NULL`
      );
    }

    // Update the current user's reporting manager
    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [selectedManager.username, session.username]
    );

    return NextResponse.json({
      success: true,
      message: `Assigned ${managerName} (${selectedManager.username}) as your reporting manager`,
      manager: {
        username: selectedManager.username,
        name: managerName,
        role: selectedManager.userRole
      }
    });

  } catch (error) {
    console.error("Error assigning manager:", error);
    return NextResponse.json(
      { error: error.message || "Failed to assign manager" },
      { status: 500 }
    );
  }
}
