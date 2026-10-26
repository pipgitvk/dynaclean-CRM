import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  getReportees,
  isReportingManagerOf,
  getReportingManagerForEmployee,
} from "@/lib/reportingManager";
import {
  canProxyAttendanceRegularization,
  resolveRoleForAttendanceAdmin,
} from "@/lib/adminAttendanceRulesAuth";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const COLS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

function mapRowToProposed(row) {
  const o = {};
  for (const c of COLS) {
    o[c] = row[c] ?? null;
  }
  return o;
}

function emptyOriginalProposed() {
  const o = {};
  for (const c of COLS) {
    o[c] = null;
  }
  return o;
}

/** @param {string|null|undefined} v */
function normalizeMysqlDatetime(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (s.length === 16 && s.includes("T")) return `${s.replace("T", " ")}:00`;
  if (s.length === 16 && s.includes(" ")) return `${s}:00`;
  return s;
}

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "summary";

    const conn = await getDbConnection();

    if (scope === "summary") {
      const reportees = await getReportees(session.username);
      const isReportingManager = reportees.length > 0;
      let managerPendingCount = 0;
      if (isReportingManager) {
        const ph = reportees.map(() => "?").join(", ");
        const [r] = await conn.execute(
          `SELECT COUNT(*) AS c FROM attendance_regularization_requests
           WHERE status = 'pending' AND username IN (${ph})`,
          reportees
        );
        managerPendingCount = Number(r[0]?.c) || 0;
      }
      const [m] = await conn.execute(
        `SELECT COUNT(*) AS c FROM attendance_regularization_requests
         WHERE status = 'pending' AND username = ?`,
        [session.username]
      );
      return NextResponse.json({
        success: true,
        isReportingManager,
        managerPendingCount,
        myPendingCount: Number(m[0]?.c) || 0,
      });
    }

    if (scope === "mine") {
      const [rows] = await conn.execute(
        `SELECT * FROM attendance_regularization_requests
         WHERE username = ? ORDER BY created_at DESC LIMIT 200`,
        [session.username]
      );
      return NextResponse.json({ success: true, requests: rows });
    }

    if (scope === "pending-approvals") {
      const reportees = await getReportees(session.username);
      if (reportees.length === 0) {
        return NextResponse.json({ success: true, requests: [] });
      }
      const ph = reportees.map(() => "?").join(", ");
      const [rows] = await conn.execute(
        `SELECT * FROM attendance_regularization_requests
         WHERE status = 'pending' AND username IN (${ph})
         ORDER BY created_at ASC`,
        reportees
      );
      return NextResponse.json({ success: true, requests: rows });
    }

    if (scope === "my-approvals") {
      const [rows] = await conn.execute(
        `SELECT * FROM attendance_regularization_requests
         WHERE reviewed_by = ?
         ORDER BY reviewed_at DESC`,
        [session.username]
      );
      return NextResponse.json({ success: true, requests: rows });
    }

    return NextResponse.json({ success: false, error: "Invalid scope" }, { status: 400 });
  } catch (error) {
    console.error("attendance regularization GET:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Submit using the form (multipart) with check-in, check-out, and reason.",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const log_date = formData.get("log_date");
    const reasonRaw = formData.get("reason");
    const checkinRaw = formData.get("checkin_time");
    const checkoutRaw = formData.get("checkout_time");
    const file = formData.get("attachment");
    const forUsernameRaw = formData.get("for_username");

    if (!log_date || typeof log_date !== "string") {
      return NextResponse.json(
        { success: false, error: "log_date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const reason = String(reasonRaw ?? "").trim();
    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Reason is required." },
        { status: 400 }
      );
    }

    const hasFile =
      file &&
      typeof file !== "string" &&
      typeof file.size === "number" &&
      file.size > 0;

    if (hasFile) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json(
          { success: false, error: "Attachment must be 5 MB or smaller." },
          { status: 400 }
        );
      }

      const mime = typeof file.type === "string" ? file.type : "";
      const nameExt = path
        .extname(typeof file.name === "string" ? file.name : "")
        .toLowerCase();
      const extOk = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(nameExt);
      const mimeOk = ALLOWED_ATTACHMENT_MIME.has(mime);
      if (!mimeOk && !extOk) {
        return NextResponse.json(
          {
            success: false,
            error: "Attachment must be PDF, JPG, PNG, or WebP.",
          },
          { status: 400 }
        );
      }
    }

    let subjectUsername = session.username;
    if (forUsernameRaw != null && String(forUsernameRaw).trim() !== "") {
      const role = await resolveRoleForAttendanceAdmin(session);
      if (!canProxyAttendanceRegularization(role)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
      subjectUsername = String(forUsernameRaw).trim();
    }

    const manager = await getReportingManagerForEmployee(subjectUsername);
    if (!manager) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No reporting manager is set for this employee. Ask HR to assign a reporting manager in Employees.",
        },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    const [pendingDup] = await conn.execute(
      `SELECT id FROM attendance_regularization_requests
       WHERE username = ? AND log_date = ? AND status = 'pending' LIMIT 1`,
      [subjectUsername, log_date]
    );
    if (pendingDup.length > 0) {
      return NextResponse.json(
        { success: false, error: "You already have a pending regularization for this date." },
        { status: 409 }
      );
    }

    const [logs] = await conn.execute(
      `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [subjectUsername, log_date]
    );

    const orig =
      logs.length > 0 ? mapRowToProposed(logs[0]) : emptyOriginalProposed();

    const prop = { ...orig };
    prop.checkin_time = normalizeMysqlDatetime(
      checkinRaw != null ? String(checkinRaw) : null
    );
    prop.checkout_time = normalizeMysqlDatetime(
      checkoutRaw != null ? String(checkoutRaw) : null
    );

    if (logs.length === 0) {
      if (!prop.checkin_time || !prop.checkout_time) {
        return NextResponse.json(
          {
            success: false,
            error:
              "For a missed (absent) day, both check-in and check-out times are required.",
          },
          { status: 400 }
        );
      }
    }

    let publicUrl = null;
    if (hasFile) {
      const mime = typeof file.type === "string" ? file.type : "";
      const nameExt = path
        .extname(typeof file.name === "string" ? file.name : "")
        .toLowerCase();
      const extFromMime =
        mime === "application/pdf"
          ? ".pdf"
          : mime === "image/jpeg"
            ? ".jpg"
            : mime === "image/png"
              ? ".png"
              : mime === "image/webp"
                ? ".webp"
                : "";
      const safeExt = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(nameExt)
        ? nameExt === ".jpeg"
          ? ".jpg"
          : nameExt
        : extFromMime || (nameExt || ".bin");

      const userFolder = String(subjectUsername).replace(/[^a-zA-Z0-9._-]/g, "_");
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "attendance_regularization",
        userFolder
      );
      await mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${safeExt}`;
      const fullPath = path.join(uploadDir, fileName);
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(fullPath, buf);

      publicUrl = `/attendance_regularization/${encodeURIComponent(userFolder)}/${encodeURIComponent(fileName)}`;
    }

    await conn.execute(
      `INSERT INTO attendance_regularization_requests (
        username, log_date, status, reason,
        original_checkin_time, original_checkout_time,
        original_break_morning_start, original_break_morning_end,
        original_break_lunch_start, original_break_lunch_end,
        original_break_evening_start, original_break_evening_end,
        proposed_checkin_time, proposed_checkout_time,
        proposed_break_morning_start, proposed_break_morning_end,
        proposed_break_lunch_start, proposed_break_lunch_end,
        proposed_break_evening_start, proposed_break_evening_end,
        attachment_url
      ) VALUES (?, ?, 'pending', ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?)`,
      [
        subjectUsername,
        log_date,
        reason,
        orig.checkin_time,
        orig.checkout_time,
        orig.break_morning_start,
        orig.break_morning_end,
        orig.break_lunch_start,
        orig.break_lunch_end,
        orig.break_evening_start,
        orig.break_evening_end,
        prop.checkin_time,
        prop.checkout_time,
        prop.break_morning_start,
        prop.break_morning_end,
        prop.break_lunch_start,
        prop.break_lunch_end,
        prop.break_evening_start,
        prop.break_evening_end,
        publicUrl ?? null,
      ]
    );

    return NextResponse.json({ success: true, message: "Submitted to your reporting manager for approval." });
  } catch (error) {
    console.error("attendance regularization POST:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, reviewer_comment } = body;

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "id and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [reqRows] = await conn.execute(
      `SELECT * FROM attendance_regularization_requests WHERE id = ? LIMIT 1`,
      [id]
    );
    if (reqRows.length === 0) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const reqRow = reqRows[0];
    if (reqRow.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "This request is no longer pending." },
        { status: 409 }
      );
    }

    const allowed = await isReportingManagerOf(session.username, reqRow.username);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
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
        [session.username, comment, id]
      );
      return NextResponse.json({ success: true, message: "Request rejected." });
    }

    const [logRows] = await conn.execute(
      `SELECT * FROM attendance_logs WHERE username = ? AND date = ? LIMIT 1`,
      [reqRow.username, reqRow.log_date]
    );

    let checkoutLat = logRows[0]?.checkout_latitude;
    let checkoutLon = logRows[0]?.checkout_longitude;
    let checkoutAddr = logRows[0]?.checkout_address;
    let checkinLat = logRows[0]?.checkin_latitude;
    let checkinLon = logRows[0]?.checkin_longitude;
    let checkinAddr = logRows[0]?.checkin_address;

    if (reqRow.proposed_checkout_time && (checkoutLat == null || checkoutLon == null)) {
      checkoutLat = checkoutLat ?? 0;
      checkoutLon = checkoutLon ?? 0;
      checkoutAddr = checkoutAddr || "Manager-approved regularization";
    }
    if (reqRow.proposed_checkin_time && (checkinLat == null || checkinLon == null)) {
      checkinLat = checkinLat ?? 0;
      checkinLon = checkinLon ?? 0;
      checkinAddr = checkinAddr || "Manager-approved regularization";
    }

    if (logRows.length === 0) {
      await conn.execute(
        `INSERT INTO attendance_logs (
          username, date,
          checkin_time, checkout_time,
          break_morning_start, break_morning_end,
          break_lunch_start, break_lunch_end,
          break_evening_start, break_evening_end,
          checkin_latitude, checkin_longitude, checkin_address,
          checkout_latitude, checkout_longitude, checkout_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqRow.username,
          reqRow.log_date,
          reqRow.proposed_checkin_time,
          reqRow.proposed_checkout_time,
          reqRow.proposed_break_morning_start,
          reqRow.proposed_break_morning_end,
          reqRow.proposed_break_lunch_start,
          reqRow.proposed_break_lunch_end,
          reqRow.proposed_break_evening_start,
          reqRow.proposed_break_evening_end,
          checkinLat ?? null,
          checkinLon ?? null,
          checkinAddr ?? null,
          checkoutLat ?? null,
          checkoutLon ?? null,
          checkoutAddr ?? null,
        ]
      );
    } else {
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
    }

    await conn.execute(
      `UPDATE attendance_regularization_requests SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = NOW(),
        reviewer_comment = ?
       WHERE id = ?`,
      [session.username, comment, id]
    );

    return NextResponse.json({ success: true, message: "Attendance updated." });
  } catch (error) {
    console.error("attendance regularization PATCH:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
