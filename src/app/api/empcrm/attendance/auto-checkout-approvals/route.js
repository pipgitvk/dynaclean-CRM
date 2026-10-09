import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getISTDateTimeString } from "@/lib/istDateTime";
import { AUTO_CHECKOUT_ATTENDANCE_ADDRESS } from "@/lib/attendanceAutoCheckoutConstants";
import { ADMIN_EDIT_ATTENDANCE_ADDRESS } from "@/lib/attendanceEditHistory";
import { ensureAttendanceCheckoutGpsTriggersAllowAdmin } from "@/lib/ensureAttendanceCheckoutGpsTriggers";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

function isHrRole(role) {
  return role != null && HR_ATTENDANCE_ROLES.includes(String(role));
}

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Rows still on automatic checkout; approval row optional (implicit pending). */
async function fetchAutomaticCheckoutRows(conn, { fromDate, toDate, statusFilter }) {
  const params = [AUTO_CHECKOUT_ATTENDANCE_ADDRESS];
  let dateSql = "";
  if (fromDate) {
    dateSql += " AND a.date >= ?";
    params.push(fromDate);
  }
  if (toDate) {
    dateSql += " AND a.date <= ?";
    params.push(toDate);
  }

  let statusSql = "";
  if (statusFilter === "pending") {
    statusSql =
      " AND (ap.id IS NULL OR ap.status = 'pending')";
  } else if (statusFilter === "rejected") {
    statusSql = " AND ap.status = 'rejected'";
  } else if (statusFilter === "all") {
    statusSql = " AND (ap.id IS NULL OR ap.status IN ('pending', 'rejected'))";
  } else {
    statusSql = " AND (ap.id IS NULL OR ap.status = 'pending')";
  }

  const [rows] = await conn.query(
    `SELECT
      a.username,
      a.date,
      a.checkin_time,
      a.checkout_time,
      a.checkout_address,
      a.employee_id,
      a.machine_code,
      COALESCE(ap.status, 'pending') AS approval_status,
      ap.reviewed_by,
      ap.reviewed_at,
      ap.note
    FROM attendance_logs a
    LEFT JOIN attendance_auto_checkout_approvals ap
      ON ap.username = a.username AND ap.log_date = a.date
    WHERE TRIM(COALESCE(a.checkout_address, '')) = ?
    ${dateSql}
    ${statusSql}
    ORDER BY a.date DESC, a.username ASC
    LIMIT 500`,
    params
  );
  return rows;
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

    const conn = await getDbConnection();
    await ensureAttendanceAutoCheckoutApprovalsTable(conn);

    const items = await fetchAutomaticCheckoutRows(conn, {
      fromDate,
      toDate,
      statusFilter: status,
    });

    if (countOnly) {
      const pending = await fetchAutomaticCheckoutRows(conn, {
        fromDate,
        toDate,
        statusFilter: "pending",
      });
      return NextResponse.json({ pendingCount: pending.length });
    }

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

    const body = await request.json();
    const username = String(body.username || "").trim();
    const logDate = parseYmd(body.date);
    const action = String(body.action || "").trim().toLowerCase();
    const note =
      body.note != null && String(body.note).trim() !== ""
        ? String(body.note).trim().slice(0, 512)
        : null;

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

    const conn = await getDbConnection();
    await ensureAttendanceAutoCheckoutApprovalsTable(conn);
    await ensureAttendanceCheckoutGpsTriggersAllowAdmin(conn);

    const reviewedAt = getISTDateTimeString();
    const reviewedBy =
      payload.username || payload.name || payload.email || "admin";

    const [logs] = await conn.query(
      `SELECT checkout_address FROM attendance_logs
       WHERE username = ? AND date = ? LIMIT 1`,
      [username, logDate]
    );
    if (!logs.length) {
      return NextResponse.json(
        { message: "Attendance log not found." },
        { status: 404 }
      );
    }
    const addr = String(logs[0].checkout_address ?? "").trim();
    if (addr.toLowerCase() !== AUTO_CHECKOUT_ATTENDANCE_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { message: "This record is not an automatic check-out." },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    try {
      if (action === "approve") {
        await conn.query(
          `UPDATE attendance_logs
           SET checkout_address = ?
           WHERE username = ? AND date = ?
             AND TRIM(COALESCE(checkout_address, '')) = ?`,
          [
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

    return NextResponse.json({
      success: true,
      action,
      username,
      date: logDate,
    });
  } catch (err) {
    console.error("auto-checkout-approvals POST:", err);
    return NextResponse.json(
      { message: err.message || "Server error" },
      { status: 500 }
    );
  }
}
