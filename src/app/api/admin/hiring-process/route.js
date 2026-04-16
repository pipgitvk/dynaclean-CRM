import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { parseHiringPayload, toMysqlDatetime } from "@/lib/hiringPayload";
import { logHiringNoteUpdate, logHiringStatusChange } from "@/lib/hiringStatusHistory";
import { omitBlockedDesignations } from "@/lib/designationDedupe";

function assertSuperadmin(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (normalizeRoleKey(payload.role ?? payload.userRole) !== "SUPERADMIN") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

const HIRING_INTERVIEW_MODES = ["Virtual", "Walk-in"];

/**
 * GET — list entries (optional ?year=&month=&interview_mode=&designation=&created_by=), or ?entryId= for one row (edit form).
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get("entryId");
    if (entryId != null && String(entryId).trim() !== "") {
      const id = parseInt(entryId, 10);
      if (!Number.isFinite(id) || id < 1) {
        return NextResponse.json({ success: false, error: "Valid entryId is required." }, { status: 400 });
      }
      const conn = await getDbConnection();
      const [rows] = await conn.execute(
        `SELECT id, created_by, candidate_name, emp_contact, designation, marital_status,
         experience_type, interview_at, rescheduled_at, next_followup_at, interview_mode, status, tag, hire_date, \`package\` AS package,
         probation_months, note, created_at
         FROM candidates WHERE id = ?`,
        [id]
      );
      if (!rows.length) {
        return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, entry: rows[0] });
    }

    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const designationParam = searchParams.get("designation");
    const modeParam = searchParams.get("interview_mode");
    const createdByParam = searchParams.get("created_by");
    const designationTrimmed =
      designationParam != null && String(designationParam).trim() !== ""
        ? String(designationParam).trim()
        : null;
    const createdByTrimmed =
      createdByParam != null && String(createdByParam).trim() !== ""
        ? String(createdByParam).trim()
        : null;
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
    const designationClause = designationTrimmed ? ` AND TRIM(designation) = ?` : "";

    let distSql = `SELECT DISTINCT TRIM(designation) AS d FROM candidates
      WHERE 1=1${ymClause}${modeClause}`;
    if (createdByTrimmed) {
      distSql += ` AND LOWER(TRIM(created_by)) = LOWER(TRIM(?))`;
    }
    distSql += ` AND TRIM(COALESCE(designation, '')) != '' ORDER BY d`;
    const distParams = [...ymParams];
    if (modeFilter) distParams.push(modeFilter);
    if (createdByTrimmed) distParams.push(createdByTrimmed);
    const [distRows] = await conn.execute(distSql, distParams);
    const designations = omitBlockedDesignations(
      distRows.map((r) => r.d).filter((x) => x != null && String(x).trim() !== "")
    );

    let hrSql = `SELECT DISTINCT TRIM(created_by) AS u FROM candidates
      WHERE TRIM(COALESCE(created_by, '')) != ''${ymClause}${modeClause}${designationClause} ORDER BY u`;
    const hrParams = [...ymParams];
    if (modeFilter) hrParams.push(modeFilter);
    if (designationTrimmed) hrParams.push(designationTrimmed);
    const [hrRows] = await conn.execute(hrSql, hrParams);
    const hr_users = hrRows.map((r) => r.u).filter((x) => x != null && String(x).trim() !== "");

    let sql = `SELECT e.id, e.created_by,
         COALESCE(ep.full_name, e.created_by) AS creator_name,
         ep.designation AS creator_role,
         e.candidate_name, e.emp_contact, e.designation,
         e.interview_at, e.rescheduled_at, e.next_followup_at, e.interview_mode, e.status, e.tag, e.hire_date, e.\`package\` AS package,
         e.created_at,
         (SELECT COUNT(*) FROM candidates_followups h WHERE h.entry_id = e.id) AS history_count
       FROM candidates e
       LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(e.created_by))
       WHERE 1=1`;
    const params = [];
    if (year != null && year !== "") {
      sql += ` AND YEAR(COALESCE(e.hire_date, DATE(e.interview_at), DATE(e.created_at))) = ?`;
      params.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      sql += ` AND MONTH(COALESCE(e.hire_date, DATE(e.interview_at), DATE(e.created_at))) = ?`;
      params.push(parseInt(month, 10));
    }
    if (modeFilter != null) {
      sql += ` AND e.interview_mode = ?`;
      params.push(modeFilter);
    }
    if (designationTrimmed != null) {
      sql += ` AND TRIM(e.designation) = ?`;
      params.push(designationTrimmed);
    }
    if (createdByTrimmed != null) {
      sql += ` AND LOWER(TRIM(e.created_by)) = LOWER(TRIM(?))`;
      params.push(createdByTrimmed);
    }
    sql += ` ORDER BY COALESCE(e.hire_date, DATE(e.interview_at), DATE(e.created_at)) DESC, e.id DESC`;

    const [rows] = await conn.execute(sql, params);

    return NextResponse.json({ success: true, entries: rows, designations, hr_users });
  } catch (error) {
    console.error("[admin/hiring-process GET]", error);
    const msg = error?.message || "";
    if (msg.includes("candidates_followups") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "History table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("candidates") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        { success: false, error: "Hiring table missing. Run hiring migrations first." },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

/** PATCH — Superadmin updates any hiring row; logs status change under superadmin username */
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
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
      const [rows] = await conn.execute(`SELECT status, note FROM candidates WHERE id = ?`, [id]);
      if (!rows.length) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
      }
      const prevStatus = rows[0].status != null ? String(rows[0].status) : "";
      const prevNote = rows[0].note != null ? String(rows[0].note) : "";

      const [upd] = await conn.execute(
        `UPDATE candidates SET
          candidate_name = ?, emp_contact = ?, designation = ?, marital_status = ?,
          experience_type = ?, interview_at = ?, rescheduled_at = ?, next_followup_at = ?, interview_mode = ?, status = ?, tag = ?,
          hire_date = ?, \`package\` = ?, probation_months = ?, note = ?
        WHERE id = ?`,
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
        ]
      );
      result = upd;
      const newNote = d.note != null ? String(d.note) : "";
      if (upd.affectedRows) {
        if (prevStatus !== d.status) {
          await logHiringStatusChange(conn, id, prevStatus, d.status, payload.username, newNote);
        } else if (prevNote !== newNote) {
          await logHiringNoteUpdate(conn, id, d.status, payload.username, newNote);
        }
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
    console.error("[admin/hiring-process PATCH]", error);
    const msg = error?.message || "";
    if (msg.includes("candidates_followups") && (msg.includes("doesn't exist") || msg.includes("Unknown table"))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Status history table missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history.sql",
        },
        { status: 503 }
      );
    }
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          success: false,
          error: "DB columns missing. Run hiring migrations as needed.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** DELETE ?id= — Superadmin only; cascades status history */
export async function DELETE(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertSuperadmin(payload);
    if (denied) return denied;

    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "", 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ success: false, error: "Valid id is required." }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [r] = await conn.execute(`DELETE FROM candidates WHERE id = ?`, [id]);
    if (!r.affectedRows) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Deleted." });
  } catch (error) {
    console.error("[admin/hiring-process DELETE]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
