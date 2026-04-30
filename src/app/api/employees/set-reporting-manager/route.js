import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    const role = payload?.role || payload?.userRole || "";
    if (!["ADMIN", "SUPERADMIN", "HR", "HR HEAD", "HR Executive"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { employeeUsername, reportingManagerUsername } = await request.json();

    if (!employeeUsername) {
      return NextResponse.json(
        { error: "Employee username is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Check if rep_list has reporting_manager column, if not add it
    const [columns] = await conn.execute(
      `SHOW COLUMNS FROM rep_list LIKE 'reporting_manager'`
    );
    if (columns.length === 0) {
      await conn.execute(
        `ALTER TABLE rep_list ADD COLUMN reporting_manager VARCHAR(255) DEFAULT NULL`
      );
    }

    // Get the old reporting manager before updating
    const [oldManagerRows] = await conn.execute(
      `SELECT reporting_manager FROM rep_list WHERE username = ? LIMIT 1`,
      [employeeUsername]
    );
    const oldReportingManager = oldManagerRows[0]?.reporting_manager;

    // Update the reporting manager
    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [reportingManagerUsername || null, employeeUsername]
    );

    // Transfer pending attendance regularization requests if reporting manager changed
    let transferredCount = 0;
    let transferMessage = "";
    
    if (oldReportingManager !== (reportingManagerUsername || null)) {
      if (reportingManagerUsername) {
        // Count pending requests that will be transferred
        const [pendingRequests] = await conn.execute(
          `SELECT COUNT(*) AS count FROM attendance_regularization_requests 
           WHERE username = ? AND status = 'pending'`,
          [employeeUsername]
        );
        
        transferredCount = Number(pendingRequests[0]?.count) || 0;
        
        if (transferredCount > 0) {
          // Log the transfer for audit purposes
          console.log(`Transferred ${transferredCount} pending attendance regularization requests for ${employeeUsername} from ${oldReportingManager || 'none'} to ${reportingManagerUsername}`);
          
          transferMessage = ` ${transferredCount} pending overtime request(s) will now be visible to the new reporting manager.`;
        }
      } else {
        // If reporting manager is being set to null, log this
        console.log(`Removed reporting manager for ${employeeUsername}. Pending requests will remain without active manager oversight.`);
        transferMessage = " Note: No reporting manager assigned. Pending requests may not have active oversight.";
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reporting manager updated successfully.${transferMessage}`,
      transferredRequests: transferredCount,
    });
  } catch (error) {
    console.error("Set reporting manager error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update reporting manager" },
      { status: 500 }
    );
  }
}
