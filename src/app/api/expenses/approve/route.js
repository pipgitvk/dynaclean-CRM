import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      expense_id,
      approved_amount,
      approval_status,
      approval_date,
      approved_by,
    } = body;

    // Optional: Verify JWT from cookies (if you want to secure this)
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const role = payload.role;
    if (role !== "ACCOUNTANT" && role !== "ADMIN" && role !== "SUPERADMIN" && role !== "HR_MANAGER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const conn = await getDbConnection();

    await conn.execute(
      `UPDATE expenses
       SET approved_amount = ?, approval_status = ?, approval_date = ?, approved_by = ?
       WHERE id = ?`,
      [
        approved_amount,
        approval_status,
        approval_date,
        approved_by,
        expense_id,
      ]
    );

        // await conn.end();

    return NextResponse.json({ success: true, message: "Approval updated successfully" });
  } catch (err) {
    console.error("❌ Approval Update Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
