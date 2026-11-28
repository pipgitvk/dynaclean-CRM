import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  ensureExpenseLinkedStatementColumn,
  ensureExpenseRejectionRemarkColumn,
} from "@/lib/fetchExpenseDashboardRows";
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
    await ensureExpenseLinkedStatementColumn(conn);

    const status = String(approval_status || "").trim();
    const statusLower = status.toLowerCase();
    const isRejected = statusLower === "rejected";
    const isRevertToPending =
      statusLower === "pending" || statusLower === "pending approval";
    const rejectionRemark = String(rejectionRemarkRaw || "").trim();

    if (isRejected && !rejectionRemark) {
      return NextResponse.json(
        { error: "Rejection remark is required." },
        { status: 400 },
      );
    }

    if (isRevertToPending) {
      const [expenseRows] = await conn.execute(
        `SELECT approval_status, payment_date, linked_statement_ids
         FROM expenses WHERE ID = ?`,
        [expense_id],
      );
      if (!expenseRows?.length) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 });
      }
      const row = expenseRows[0];
      const currentStatus = String(row.approval_status || "").trim().toLowerCase();
      if (currentStatus !== "approved") {
        return NextResponse.json(
          { error: "Only approved expenses can be reverted." },
          { status: 400 },
        );
      }
      if (row.payment_date) {
        return NextResponse.json(
          { error: "Cannot revert: payment has already been processed." },
          { status: 400 },
        );
      }
      try {
        const linked = JSON.parse(row.linked_statement_ids || "[]");
        if (Array.isArray(linked) && linked.length > 0) {
          return NextResponse.json(
            {
              error:
                "Cannot revert: payment statements are linked. Remove the link first.",
            },
            { status: 400 },
          );
        }
      } catch {
        /* treat invalid JSON as no links */
      }

      await conn.execute(
        `UPDATE expenses
         SET approved_amount = 0,
             approval_status = 'Pending',
             approval_date = NULL,
             approved_by = NULL,
             rejection_remark = NULL
         WHERE ID = ?`,
        [expense_id],
      );
    } else {
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
        ],
      );
    }

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
