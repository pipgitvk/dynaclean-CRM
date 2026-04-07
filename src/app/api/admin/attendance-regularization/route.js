import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getMainSessionPayload } from "@/lib/auth";
import {
  canManageAttendanceRules,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

/**
 * List all attendance regularization requests (admin / HR).
 */
export async function GET() {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT *
       FROM attendance_regularization_requests
       ORDER BY created_at DESC
       LIMIT 2000`
    );

    return NextResponse.json({ success: true, requests: rows });
  } catch (error) {
    console.error("admin attendance-regularization GET:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * Approve or reject a regularization request (superadmin / HR only).
 * Body: { id, action: "approve" | "reject", reviewer_comment? }
 */
export async function PATCH(request) {
  try {
    const payload = await getMainSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await resolveRoleForAttendanceAdmin(payload);
    if (!canManageAttendanceRules(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, reviewer_comment } = body;

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "id and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [reqRows] = await conn.execute(
      `SELECT * FROM attendance_regularization_requests WHERE id = ? LIMIT 1`,
      [id]
    );
    if (reqRows.length === 0) {
      return NextResponse.json({ success: false, message: "Request not found" }, { status: 404 });
    }

    const reqRow = reqRows[0];
    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { success: false, message: "This request is no longer pending." },
        { status: 409 }
      );
    }

    const comment =
      reviewer_comment && String(reviewer_comment).trim()
        ? String(reviewer_comment).trim()
        : null;

    if (action === "reject") {
      await conn.execute(
        `UPDATE attendance_regularization_requests SET
          status = 'rejected',
          reviewed_by = ?,
          reviewed_at = NOW(),
          reviewer_comment = ?
         WHERE id = ?`,
        [payload.username, comment, id]
      );
      return NextResponse.json({ success: true, message: "Request rejected." });
    }

    const [logRows] = await conn.execute(
      `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [reqRow.username, reqRow.log_date]
    );
    if (logRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Attendance log not found for that date." },
        { status: 404 }
      );
    }

    const logRow = logRows[0];
    let checkoutLat = logRow.checkout_latitude;
    let checkoutLon = logRow.checkout_longitude;
    let checkoutAddr = logRow.checkout_address;
    if (reqRow.proposed_checkout_time && (checkoutLat == null || checkoutLon == null)) {
      checkoutLat = checkoutLat ?? 0;
      checkoutLon = checkoutLon ?? 0;
      checkoutAddr = checkoutAddr || "Admin-approved regularization";
    }

    await conn.execute(
      `UPDATE attendance_logs SET
        checkin_time = ?,
        checkout_time = ?,
        break_morning_start = ?,
        break_morning_end = ?,
        break_lunch_start = ?,
        break_lunch_end = ?,
        break_evening_start = ?,
        break_evening_end = ?,
        checkout_latitude = ?,
        checkout_longitude = ?,
        checkout_address = ?
       WHERE username = ? AND date = ?`,
      [
        reqRow.proposed_checkin_time,
        reqRow.proposed_checkout_time,
        reqRow.proposed_break_morning_start,
        reqRow.proposed_break_morning_end,
        reqRow.proposed_break_lunch_start,
        reqRow.proposed_break_lunch_end,
        reqRow.proposed_break_evening_start,
        reqRow.proposed_break_evening_end,
        checkoutLat,
        checkoutLon,
        checkoutAddr,
        reqRow.username,
        reqRow.log_date,
      ]
    );

    await conn.execute(
      `UPDATE attendance_regularization_requests SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = NOW(),
        reviewer_comment = ?
       WHERE id = ?`,
      [payload.username, comment, id]
    );

    return NextResponse.json({ success: true, message: "Attendance updated and request approved." });
  } catch (error) {
    console.error("admin attendance-regularization PATCH:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
