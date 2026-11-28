import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureExpenseRejectionRemarkColumn } from "@/lib/fetchExpenseDashboardRows";
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
      rejection_remark: rejectionRemarkRaw,
    } = body;

    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const role = payload.role;
    if (!["ACCOUNTANT", "ADMIN", "SUPERADMIN", "HR_MANAGER", "DIRECTOR"].includes(String(role).toUpperCase())) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const conn = await getDbConnection();
    await ensureExpenseRejectionRemarkColumn(conn);

    const status = String(approval_status || "").trim();
    const isRejected = status.toLowerCase() === "rejected";
    const rejectionRemark = String(rejectionRemarkRaw || "").trim();

    if (isRejected && !rejectionRemark) {
      return NextResponse.json(
        { error: "Rejection remark is required." },
        { status: 400 },
      );
    }

    const remarkToStore = isRejected ? rejectionRemark : null;

    await conn.execute(
      `UPDATE expenses
       SET approved_amount = ?, approval_status = ?, approval_date = ?, approved_by = ?,
           rejection_remark = ?
       WHERE ID = ?`,
      [
        approved_amount,
        approval_status,
        approval_date,
        approved_by,
        remarkToStore,
        expense_id,
      ]
    );

        // await conn.end();

    return NextResponse.json({ success: true, message: "Approval updated successfully" });
  } catch (err) {
    console.error("Approval update error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
