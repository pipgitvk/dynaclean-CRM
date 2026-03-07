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
    const role = payload?.role || "";
    if (!["ADMIN", "SUPERADMIN"].includes(role)) {
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

    await conn.execute(
      `UPDATE rep_list SET reporting_manager = ? WHERE username = ?`,
      [reportingManagerUsername || null, employeeUsername]
    );

    return NextResponse.json({
      success: true,
      message: "Reporting manager updated successfully",
    });
  } catch (error) {
    console.error("Set reporting manager error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update reporting manager" },
      { status: 500 }
    );
  }
}
