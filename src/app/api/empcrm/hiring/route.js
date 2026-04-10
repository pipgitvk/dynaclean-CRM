import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";
import { logHiringCreated, logHiringStatusChange } from "@/lib/hiringStatusHistory";
import { parseHiringPayload, toMysqlDatetime } from "@/lib/hiringPayload";

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET ?year=&month=&interview_mode=&designation= optional filters (date parts match hire, interview, or created date). */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const designationParam = searchParams.get("designation");
    const modeParam = searchParams.get("interview_mode");
    const designationTrimmed =
      designationParam != null && String(designationParam).trim() !== ""
        ? String(designationParam).trim()
        : null;
    const HIRING_INTERVIEW_MODES = ["Virtual", "Walk-in"];
    const modeRaw = modeParam != null && String(modeParam).trim() !== "" ? String(modeParam).trim() : null;
    const modeFilter = modeRaw != null && HIRING_INTERVIEW_MODES.includes(modeRaw) ? modeRaw : null;

    const conn = await getDbConnection();

    const ymWhere = [];
    const ymParams = [];
    if (year != null && year !== "") {
      ymWhere.push(`YEAR(COALESCE(hire_date, DATE(interview_at), DATE(created_at))) = ?`);
      ymParams.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      ymWhere.push(`MONTH(COALESCE(hire_date, DATE(interview_at), DATE(created_at))) = ?`);
      ymParams.push(parseInt(month, 10));
    }
    const ymClause = ymWhere.length ? ` AND ${ymWhere.join(" AND ")}` : "";
    const modeClause = modeFilter ? ` AND interview_mode = ?` : "";

    let distSql = `SELECT DISTINCT TRIM(designation) AS d FROM hr_hiring_entries
      WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))${ymClause}${modeClause}
      AND TRIM(COALESCE(designation, '')) != '' ORDER BY d`;
    const distParams = [payload.username, ...ymParams];
    if (modeFilter) distParams.push(modeFilter);
    const [distRows] = await conn.execute(distSql, distParams);
    const designations = distRows.map((r) => r.d).filter((x) => x != null && String(x).trim() !== "");

    let sql = `SELECT id, created_by_username, candidate_name, emp_contact, designation, marital_status,
         experience_type, interview_at, rescheduled_at, next_followup_at, interview_mode, status, tag, hire_date, \`package\` AS package,
         probation_months, note, created_at
         FROM hr_hiring_entries WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`;
    const params = [payload.username];
    if (year != null && year !== "") {
      sql += ` AND YEAR(COALESCE(hire_date, DATE(interview_at), DATE(created_at))) = ?`;
      params.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      sql += ` AND MONTH(COALESCE(hire_date, DATE(interview_at), DATE(created_at))) = ?`;
      params.push(parseInt(month, 10));
    }
    if (modeFilter != null) {
      sql += ` AND interview_mode = ?`;
      params.push(modeFilter);
    }
    if (designationTrimmed != null) {
      sql += ` AND TRIM(designation) = ?`;
      params.push(designationTrimmed);
    }
    sql += ` ORDER BY COALESCE(hire_date, DATE(interview_at), DATE(created_at)) DESC, id DESC`;

    const [rows] = await conn.execute(sql, params);
    let next_id = 1;
    try {
      const [[row]] = await conn.execute(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM hr_hiring_entries`
      );
      if (row && Number.isFinite(Number(row.next_id))) next_id = Number(row.next_id);
    } catch {
      /* table missing handled below if needed */
    }
    return NextResponse.json({ success: true, entries: rows, next_id, designations });
  } catch (error) {
    console.error("[empcrm/hiring GET]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_hiring_entries") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_hr_hiring_entries.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DB columns missing. Run hiring migrations (extended_fields, package, probation_months as needed).",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const body = await request.json();
    const parsed = parseHiringPayload(body);
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const d = parsed.data;

    const pool = await getDbConnection();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        `INSERT INTO hr_hiring_entries (
        created_by_username, candidate_name, emp_contact, designation, marital_status,
        experience_type, interview_at, rescheduled_at, next_followup_at, interview_mode, status, tag, hire_date, \`package\`, probation_months, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.username,
          d.candidate_name,
          d.emp_contact,
          d.designation,
          d.marital_status,
          d.experience_type,
          toMysqlDatetime(d.interview_at),
          d.rescheduled_at != null ? toMysqlDatetime(d.rescheduled_at) : null,
          d.next_followup_at != null ? toMysqlDatetime(d.next_followup_at) : null,
          d.interview_mode,
          d.status,
          d.tag,
          d.hire_date,
          d.packageStr,
          d.probation_months,
          d.note,
        ]
      );
      const insertId = result.insertId;
      if (insertId) {
        await logHiringCreated(conn, insertId, d.status, payload.username);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true, message: "Record saved." });
  } catch (error) {
    console.error("[empcrm/hiring POST]", error);
    const msg = error?.message || "";
    if (msg.includes("hr_hiring_entries") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_hr_hiring_entries.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DB columns missing. Run hiring migrations (extended_fields, package, probation_months as needed).",
        },
        { status: 503 }
      );
    }
    if (msg.includes("hr_hiring_entry_status_history") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Status history table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** PATCH: update row by id (own rows only) */
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const body = await request.json();
    const id = parseInt(body.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ success: false, error: "Valid id is required." }, { status: 400 });
    }

    const parsed = parseHiringPayload(body);
    if ("error" in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const d = parsed.data;

    const pool = await getDbConnection();
    const conn = await pool.getConnection();
    let result;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT status FROM hr_hiring_entries WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
        [id, payload.username]
      );
      if (!rows.length) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
      }
      const prevStatus = rows[0].status != null ? String(rows[0].status) : "";

      const [upd] = await conn.execute(
        `UPDATE hr_hiring_entries SET
        candidate_name = ?, emp_contact = ?, designation = ?, marital_status = ?,
        experience_type = ?, interview_at = ?, rescheduled_at = ?, next_followup_at = ?, interview_mode = ?, status = ?, tag = ?,
        hire_date = ?, \`package\` = ?, probation_months = ?, note = ?
      WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
        [
          d.candidate_name,
          d.emp_contact,
          d.designation,
          d.marital_status,
          d.experience_type,
          toMysqlDatetime(d.interview_at),
          d.rescheduled_at != null ? toMysqlDatetime(d.rescheduled_at) : null,
          d.next_followup_at != null ? toMysqlDatetime(d.next_followup_at) : null,
          d.interview_mode,
          d.status,
          d.tag,
          d.hire_date,
          d.packageStr,
          d.probation_months,
          d.note,
          id,
          payload.username,
        ]
      );
      result = upd;
      if (upd.affectedRows && prevStatus !== d.status) {
        await logHiringStatusChange(conn, id, prevStatus, d.status, payload.username);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    if (!result.affectedRows) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Record updated." });
  } catch (error) {
    console.error("[empcrm/hiring PATCH]", error);
    const msg = error?.message || "";
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DB columns missing. Run hiring migrations (extended_fields, package, probation_months as needed).",
        },
        { status: 503 }
      );
    }
    if (msg.includes("hr_hiring_entry_status_history") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Status history table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** DELETE disabled for HR — only Superadmin may delete (Admin → Hiring Process). */
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "Hiring records can only be deleted by Superadmin (Admin → Hiring Process).",
    },
    { status: 403 }
  );
}
