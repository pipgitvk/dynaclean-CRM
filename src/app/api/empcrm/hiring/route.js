import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";
import { logHiringCreated, logHiringNoteUpdate, logHiringStatusChange } from "@/lib/hiringStatusHistory";
import { parseHiringPayload, toMysqlDatetime } from "@/lib/hiringPayload";
import { omitBlockedDesignations } from "@/lib/designationDedupe";

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function isMysqlUnknownColumnError(err) {
  const msg = `${err?.message || ""} ${err?.sqlMessage || ""}`;
  return (
    msg.includes("Unknown column") ||
    err?.code === "ER_BAD_FIELD_ERROR" ||
    err?.errno === 1054
  );
}

/** Appends MySQL text so the UI shows the real missing column (e.g. created_by, package, hr_interview_score). */
function hiringUnknownColumnResponse(err) {
  const mysqlMessage = String(err?.sqlMessage ?? err?.message ?? "").trim();
  const base =
    "DB column mismatch. Run empcrm/admin-dashboard/hiring/migration_candidates_pipeline_columns.sql (skip #1060 duplicates). If the column is created_by, run migration_candidates_rename_created_by.sql.";
  const extra =
    isMysqlUnknownColumnError(err) && mysqlMessage
      ? ` ${mysqlMessage}`
      : isMysqlUnknownColumnError(err)
        ? ` (MySQL ${err?.code || err?.errno || "bad field"})`
        : "";
  return NextResponse.json({ success: false, error: base + extra }, { status: 503 });
}

/** GET ?year=&month=&interview_mode=&designation= optional filters (date parts match hire, interview, or created date). */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const entryIdParam = searchParams.get("entryId");
    if (entryIdParam != null && String(entryIdParam).trim() !== "") {
      const id = parseInt(entryIdParam, 10);
      if (!Number.isFinite(id) || id < 1) {
        return NextResponse.json({ success: false, error: "Valid entryId is required." }, { status: 400 });
      }
      const conn = await getDbConnection();
      const [rows] = await conn.execute(
        `SELECT h.id, h.created_by,
         COALESCE(ep.full_name, h.created_by) AS creator_name,
         ep.designation AS creator_role,
         h.candidate_name, h.emp_contact, h.designation, h.marital_status,
         h.experience_type, h.interview_at, h.rescheduled_at, h.next_followup_at, h.interview_mode, h.status, h.tag, h.hire_date, h.\`package\` AS package,
         h.probation_months, h.selected_resume, h.mgmt_interview_score, h.hr_interview_score, h.hr_score_rating, h.current_salary, h.expected_salary, h.note, h.created_at
         FROM candidates h
         LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(h.created_by))
         WHERE h.id = ? AND LOWER(TRIM(h.created_by)) = LOWER(TRIM(?))`,
        [id, payload.username]
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
    const joinFromParam = searchParams.get("join_from");
    const joinToParam = searchParams.get("join_to");
    const interviewFromParam = searchParams.get("interview_from");
    const interviewToParam = searchParams.get("interview_to");
    const designationTrimmed =
      designationParam != null && String(designationParam).trim() !== ""
        ? String(designationParam).trim()
        : null;
    const HIRING_INTERVIEW_MODES = ["Virtual", "Walk-in"];
    const modeRaw = modeParam != null && String(modeParam).trim() !== "" ? String(modeParam).trim() : null;
    const modeFilter = modeRaw != null && HIRING_INTERVIEW_MODES.includes(modeRaw) ? modeRaw : null;
    const isValidDate = (v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
    const joinFrom = isValidDate(joinFromParam) ? joinFromParam.trim() : null;
    const joinTo = isValidDate(joinToParam) ? joinToParam.trim() : null;
    const interviewFrom = isValidDate(interviewFromParam) ? interviewFromParam.trim() : null;
    const interviewTo = isValidDate(interviewToParam) ? interviewToParam.trim() : null;

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

    let distSql = `SELECT DISTINCT TRIM(designation) AS d FROM candidates
      WHERE LOWER(TRIM(created_by)) = LOWER(TRIM(?))${ymClause}${modeClause}
      AND TRIM(COALESCE(designation, '')) != '' ORDER BY d`;
    const distParams = [payload.username, ...ymParams];
    if (modeFilter) distParams.push(modeFilter);
    const [distRows] = await conn.execute(distSql, distParams);
    const designations = omitBlockedDesignations(
      distRows.map((r) => r.d).filter((x) => x != null && String(x).trim() !== "")
    );

    let sql = `SELECT h.id, h.created_by,
         COALESCE(ep.full_name, h.created_by) AS creator_name,
         ep.designation AS creator_role,
         h.candidate_name, h.emp_contact, h.designation, h.marital_status,
         h.experience_type, h.interview_at, h.rescheduled_at, h.next_followup_at, h.interview_mode, h.status, h.tag, h.hire_date, h.\`package\` AS package,
         h.probation_months, h.selected_resume, h.mgmt_interview_score, h.hr_interview_score, h.hr_score_rating, h.current_salary, h.expected_salary, h.note, h.created_at
         FROM candidates h
         LEFT JOIN employee_profiles ep ON LOWER(TRIM(ep.username)) = LOWER(TRIM(h.created_by))
         WHERE LOWER(TRIM(h.created_by)) = LOWER(TRIM(?))`;
    const params = [payload.username];
    if (year != null && year !== "") {
      sql += ` AND YEAR(COALESCE(h.hire_date, DATE(h.interview_at), DATE(h.created_at))) = ?`;
      params.push(parseInt(year, 10));
    }
    if (month != null && month !== "") {
      sql += ` AND MONTH(COALESCE(h.hire_date, DATE(h.interview_at), DATE(h.created_at))) = ?`;
      params.push(parseInt(month, 10));
    }
    if (modeFilter != null) {
      sql += ` AND h.interview_mode = ?`;
      params.push(modeFilter);
    }
    if (designationTrimmed != null) {
      sql += ` AND TRIM(h.designation) = ?`;
      params.push(designationTrimmed);
    }
    if (joinFrom) {
      sql += ` AND h.hire_date >= ?`;
      params.push(joinFrom);
    }
    if (joinTo) {
      sql += ` AND h.hire_date <= ?`;
      params.push(joinTo);
    }
    if (interviewFrom) {
      sql += ` AND DATE(h.interview_at) >= ?`;
      params.push(interviewFrom);
    }
    if (interviewTo) {
      sql += ` AND DATE(h.interview_at) <= ?`;
      params.push(interviewTo);
    }
    sql += ` ORDER BY COALESCE(h.hire_date, DATE(h.interview_at), DATE(h.created_at)) DESC, h.id DESC`;

    const [rows] = await conn.execute(sql, params);
    let next_id = 1;
    try {
      const [[row]] = await conn.execute(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM candidates`
      );
      if (row && Number.isFinite(Number(row.next_id))) next_id = Number(row.next_id);
    } catch {
      /* table missing handled below if needed */
    }
    return NextResponse.json({ success: true, entries: rows, next_id, designations });
  } catch (error) {
    console.error("[empcrm/hiring GET]", error);
    const msg = `${error?.message || ""} ${error?.sqlMessage || ""}`;
    if (msg.includes("candidates") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_candidates.sql",
        },
        { status: 503 }
      );
    }
    if (isMysqlUnknownColumnError(error)) {
      return hiringUnknownColumnResponse(error);
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
        `INSERT INTO candidates (
        created_by, candidate_name, emp_contact, designation, marital_status,
        experience_type, interview_at, rescheduled_at, next_followup_at, interview_mode, status, tag, hire_date, \`package\`, probation_months,
        selected_resume, mgmt_interview_score, hr_interview_score, hr_score_rating, current_salary, expected_salary, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          d.selected_resume,
          d.mgmt_interview_score,
          d.hr_interview_score,
          d.hr_score_rating,
          d.current_salary,
          d.expected_salary,
          d.note,
        ]
      );
      const insertId = result.insertId;
      if (insertId) {
        await logHiringCreated(conn, insertId, d.status, payload.username, d.note);
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
    const msg = `${error?.message || ""} ${error?.sqlMessage || ""}`;
    if (msg.includes("candidates") && msg.includes("doesn't exist")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Table missing. Run migration: empcrm/admin-dashboard/hiring/migration_candidates.sql",
        },
        { status: 503 }
      );
    }
    if (isMysqlUnknownColumnError(error)) {
      if (msg.includes("note") && msg.includes("candidates_followups")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "History note column missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history_note.sql",
          },
          { status: 503 }
        );
      }
      return hiringUnknownColumnResponse(error);
    }
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
        `SELECT status, note FROM candidates WHERE id = ? AND LOWER(TRIM(created_by)) = LOWER(TRIM(?))`,
        [id, payload.username]
      );
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
        hire_date = ?, \`package\` = ?, probation_months = ?,
        selected_resume = ?, mgmt_interview_score = ?, hr_interview_score = ?, hr_score_rating = ?, current_salary = ?, expected_salary = ?, note = ?
      WHERE id = ? AND LOWER(TRIM(created_by)) = LOWER(TRIM(?))`,
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
          d.selected_resume,
          d.mgmt_interview_score,
          d.hr_interview_score,
          d.hr_score_rating,
          d.current_salary,
          d.expected_salary,
          d.note,
          id,
          payload.username,
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
    console.error("[empcrm/hiring PATCH]", error);
    const msg = `${error?.message || ""} ${error?.sqlMessage || ""}`;
    if (isMysqlUnknownColumnError(error)) {
      if (msg.includes("note") && msg.includes("candidates_followups")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "History note column missing. Run admin-dashboard/hiring-process/migration_hr_hiring_status_history_note.sql",
          },
          { status: 503 }
        );
      }
      return hiringUnknownColumnResponse(error);
    }
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
