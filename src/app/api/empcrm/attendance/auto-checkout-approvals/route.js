import { NextResponse } from "next/server";
import { withDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getISTDateTimeString } from "@/lib/istDateTime";
import { AUTO_CHECKOUT_ATTENDANCE_ADDRESS } from "@/lib/attendanceAutoCheckoutConstants";
import { ADMIN_EDIT_ATTENDANCE_ADDRESS } from "@/lib/attendanceEditHistory";
import { ensureAttendanceCheckoutGpsTriggersAllowAdmin } from "@/lib/ensureAttendanceCheckoutGpsTriggers";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";
import {
  findLeaveForUserOnDate,
  resolveAutoCheckoutForAttendanceDay,
} from "@/lib/attendanceAutoCheckoutLeave";
import { buildAutoCheckoutApprovalItems } from "@/lib/autoCheckoutApprovalQueue";

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

function isHrRole(role) {
  return role != null && HR_ATTENDANCE_ROLES.includes(String(role));
}

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseWallClockTime(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = m[3] != null ? parseInt(m[3], 10) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function checkoutTimeFromDb(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  const part = s.includes(" ") ? s.split(" ").pop() : s;
  return parseWallClockTime(part);
}

async function loadLeaveAndScheduleMaps(conn, fromDate, toDate) {
  const [leaves] = await conn.query(
    `SELECT username, from_date, to_date, leave_type, is_half_day, half_day_type,
            start_time, end_time, status
     FROM employee_leaves
     WHERE status IN ('pending', 'approved')
       AND from_date <= ?
       AND to_date >= ?`,
    [toDate || "2099-12-31", fromDate || "1970-01-01"]
  );
  const [scheduleRows] = await conn.query(
    `SELECT username, checkin_time, checkout_time, break_lunch,
            lunch_duration_minutes, half_day_checkin_time
     FROM employee_attendance_schedule`
  );
  const scheduleByUser = new Map();
  for (const row of scheduleRows || []) {
    if (row?.username) scheduleByUser.set(row.username, row);
  }
  return { leaves, scheduleByUser };
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isHrRole(payload.role)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromDate = parseYmd(searchParams.get("from"));
    const toDate = parseYmd(searchParams.get("to"));
    const status = searchParams.get("status") || "pending";
    const countOnly = searchParams.get("countOnly") === "1";

    if (countOnly) {
      const pendingItems = await withDbConnection((conn) =>
        buildAutoCheckoutApprovalItems(conn, {
          fromDate,
          toDate,
          statusFilter: "pending",
        }),
      );
      return NextResponse.json({ pendingCount: pendingItems.length });
    }

    const items = await withDbConnection((conn) =>
      buildAutoCheckoutApprovalItems(conn, {
        fromDate,
        toDate,
        statusFilter: status,
      }),
    );

    return NextResponse.json({ items });
  } catch (err) {
    console.error("auto-checkout-approvals GET:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isHrRole(payload.role)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }
    const roleKey = String(payload.role || "").trim().toUpperCase();
    if (roleKey !== "SUPERADMIN") {
      return NextResponse.json(
        {
          message:
            "Only SUPERADMIN can approve or reject automatic check-outs.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const username = String(body.username || "").trim();
    const logDate = parseYmd(body.date);
    const action = String(body.action || "").trim().toLowerCase();
    const note =
      body.note != null && String(body.note).trim() !== ""
        ? String(body.note).trim().slice(0, 512)
        : null;
    const checkoutTimeRaw =
      body.checkoutTime != null ? String(body.checkoutTime).trim() : "";

    if (!username || !logDate) {
      return NextResponse.json(
        { message: "username and date (YYYY-MM-DD) are required." },
        { status: 400 }
      );
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { message: "action must be approve or reject." },
        { status: 400 }
      );
    }

    const reviewedAt = getISTDateTimeString();
    const reviewedBy =
      payload.username || payload.name || payload.email || "admin";

    await withDbConnection(async (conn) => {
      await ensureAttendanceAutoCheckoutApprovalsTable(conn);
      await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);

      const [logs] = await conn.query(
        `SELECT checkout_address, checkin_time, checkout_time FROM attendance_logs
         WHERE username = ? AND date = ? LIMIT 1`,
        [username, logDate]
      );
      if (!logs.length) {
        const err = new Error("Attendance log not found.");
        err.status = 404;
        throw err;
      }
      const addr = String(logs[0].checkout_address ?? "").trim();
      if (addr.toLowerCase() !== AUTO_CHECKOUT_ATTENDANCE_ADDRESS.toLowerCase()) {
        const err = new Error("This record is not an automatic check-out.");
        err.status = 400;
        throw err;
      }

      await conn.beginTransaction();
      try {
        if (action === "approve") {
          const { leaves, scheduleByUser } = await loadLeaveAndScheduleMaps(
            conn,
            logDate,
            logDate,
          );
          const leave = findLeaveForUserOnDate(leaves, username, logDate);
          if (leave) {
            const err = new Error(
              "Cannot approve automatic check-out while leave is pending or approved. Reject the leave first, or wait until it is rejected.",
            );
            err.status = 400;
            throw err;
          }

          let wallTime = parseWallClockTime(checkoutTimeRaw);
          if (!wallTime) {
            wallTime = checkoutTimeFromDb(logs[0].checkout_time);
          }
          if (!wallTime) {
            const resolved = resolveAutoCheckoutForAttendanceDay({
              leave: null,
              dateYmd: logDate,
              scheduleRow: scheduleByUser.get(username) || null,
              checkinTime: logs[0].checkin_time,
            });
            wallTime = resolved.wallTime;
          }

          await conn.query(
            `UPDATE attendance_logs
             SET checkout_time = TIMESTAMP(?, ?),
                 checkout_address = ?,
                 checkout_latitude = NULL,
                 checkout_longitude = NULL
             WHERE username = ? AND date = ?
               AND TRIM(COALESCE(checkout_address, '')) = ?`,
            [
              logDate,
              wallTime,
              ADMIN_EDIT_ATTENDANCE_ADDRESS,
              username,
              logDate,
              AUTO_CHECKOUT_ATTENDANCE_ADDRESS,
            ]
          );

          await conn.query(
            `INSERT INTO attendance_auto_checkout_approvals
               (username, log_date, status, reviewed_by, reviewed_at, note)
             VALUES (?, ?, 'approved', ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               status = 'approved',
               reviewed_by = VALUES(reviewed_by),
               reviewed_at = VALUES(reviewed_at),
               note = VALUES(note)`,
            [username, logDate, reviewedBy, reviewedAt, note]
          );
        } else {
          await conn.query(
            `INSERT INTO attendance_auto_checkout_approvals
               (username, log_date, status, reviewed_by, reviewed_at, note)
             VALUES (?, ?, 'rejected', ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               status = 'rejected',
               reviewed_by = VALUES(reviewed_by),
               reviewed_at = VALUES(reviewed_at),
               note = VALUES(note)`,
            [username, logDate, reviewedBy, reviewedAt, note]
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      }
    });

    return NextResponse.json({
      success: true,
      action,
      username,
      date: logDate,
      note,
    });
  } catch (err) {
    console.error("auto-checkout-approvals POST:", err);
    const status = Number(err?.status) || 500;
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status }
    );
  }
}
