import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (payload?.role || "").toUpperCase();
  if (role !== "DIRECTOR" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let regTotal = 0;
  let regPending = 0;
  let leaveTotal = 0;
  let leavePending = 0;

  const connection = await getDbConnection();

  try {
    try {
      const [regTotalRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests`,
      );
      const [regPendingRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests WHERE status = 'pending'`,
      );
      regTotal = Number(regTotalRows[0]?.c ?? 0);
      regPending = Number(regPendingRows[0]?.c ?? 0);
    } catch (e) {
      console.warn("attendance regularization counts:", e.message);
    }

    try {
      const [leaveTotalRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM employee_leaves`,
      );
      const [leavePendingRows] = await connection.execute(
        `SELECT COUNT(*) AS c FROM employee_leaves WHERE status = 'pending'`,
      );
      leaveTotal = Number(leaveTotalRows[0]?.c ?? 0);
      leavePending = Number(leavePendingRows[0]?.c ?? 0);
    } catch (e) {
      console.warn("employee leave counts:", e.message);
    }

    return NextResponse.json({
      regTotal,
      regPending,
      leaveTotal,
      leavePending,
    });
  } catch (error) {
    console.error("dashboard-summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 },
    );
  }
}
