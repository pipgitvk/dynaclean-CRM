import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessHiringModule } from "@/lib/hrTargetEligibleRoles";

const HIRING_STATUS_OPTIONS = [
  "Shortlisted for interview",
  "Rescheduled",
  "Waiting List",
  "Hired",
  "Reject",
];

const HIRING_TAG_OPTIONS = ["Probation", "Permanent", "Terminate", "Follow-Up"];

const HIRING_MARITAL_OPTIONS = ["Unmarried", "Married"];
const HIRING_EXPERIENCE_VALUES = ["fresher", "experience"];
const HIRING_INTERVIEW_MODES = ["Virtual", "Walk-in"];

function assertHrRole(payload) {
  if (!payload?.username) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessHiringModule(payload.role ?? payload.userRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function normalizeStatus(v) {
  const s = String(v ?? "").trim();
  if (!s) return "Shortlisted for interview";
  if (HIRING_STATUS_OPTIONS.includes(s)) return s;
  return "Shortlisted for interview";
}

function normalizeTag(v) {
  const t = String(v ?? "").trim();
  if (!t) return null;
  return HIRING_TAG_OPTIONS.includes(t) ? t : null;
}

function toMysqlDatetime(v) {
  if (!v) return null;
  const s = String(v).trim().replace("T", " ");
  if (s.length === 16) return `${s}:00`;
  if (s.length >= 19) return s.slice(0, 19);
  return s;
}

/**
 * Shared create/update validation.
 * @returns {{ error: string } | { data: object }}
 */
function parseHiringPayload(body) {
  const candidate_name = String(body.candidate_name ?? "").trim();
  const designation = String(body.designation ?? "").trim();
  const emp_contact = String(body.emp_contact ?? "").trim();
  const marital_raw = String(body.marital_status ?? "").trim();
  const experience_raw = String(body.experience_type ?? "").trim();
  const interview_at_raw = String(body.interview_at ?? "").trim();
  const interview_mode_raw = String(body.interview_mode ?? "").trim();
  const note = String(body.note ?? "").trim();
  const status = normalizeStatus(body.status);
  const isHired = status === "Hired";
  const hire_date = isHired ? String(body.hire_date ?? "").trim() || null : null;
  const tag = isHired ? normalizeTag(body.tag) : null;
  const packageStr = isHired ? String(body.package ?? "").trim() || null : null;

  let probation_months = null;
  if (isHired && tag === "Probation") {
    const pm = parseInt(String(body.probation_months ?? "").trim(), 10);
    if (!Number.isFinite(pm) || pm < 1 || pm > 120) {
      return { error: "When tag is Probation, enter probation duration (1–120 months)." };
    }
    probation_months = pm;
  }

  if (!candidate_name || !designation || !emp_contact) {
    return { error: "Employee name, contact, and designation are required." };
  }
  if (!marital_raw || !HIRING_MARITAL_OPTIONS.includes(marital_raw)) {
    return { error: "Marital status is required." };
  }
  if (!experience_raw || !HIRING_EXPERIENCE_VALUES.includes(experience_raw)) {
    return { error: "Experience / Fresher is required." };
  }
  if (!interview_at_raw) {
    return { error: "Interview date and time is required." };
  }
  if (!interview_mode_raw || !HIRING_INTERVIEW_MODES.includes(interview_mode_raw)) {
    return { error: "Mode of interview is required." };
  }
  if (!note) {
    return { error: "Note is required." };
  }

  if (isHired && !hire_date) {
    return { error: "Joining date is required when status is Hired." };
  }
  if (isHired && !tag) {
    return { error: "Tag is required when status is Hired." };
  }
  if (isHired && !packageStr) {
    return { error: "Package is required when status is Hired." };
  }

  return {
    data: {
      candidate_name,
      emp_contact,
      designation,
      marital_status: marital_raw,
      experience_type: experience_raw,
      interview_at: interview_at_raw,
      interview_mode: interview_mode_raw,
      status,
      tag,
      hire_date,
      packageStr,
      probation_months,
      note,
    },
  };
}

/** GET ?year=&month=&designation= optional filters (date parts match hire, interview, or created date). */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const designationParam = searchParams.get("designation");
    const designationTrimmed =
      designationParam != null && String(designationParam).trim() !== ""
        ? String(designationParam).trim()
        : null;

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

    let distSql = `SELECT DISTINCT TRIM(designation) AS d FROM hr_hiring_entries
      WHERE LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))${ymClause}
      AND TRIM(COALESCE(designation, '')) != '' ORDER BY d`;
    const [distRows] = await conn.execute(distSql, [payload.username, ...ymParams]);
    const designations = distRows.map((r) => r.d).filter((x) => x != null && String(x).trim() !== "");

    let sql = `SELECT id, created_by_username, candidate_name, emp_contact, designation, marital_status,
         experience_type, interview_at, interview_mode, status, tag, hire_date, \`package\` AS package,
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

    const conn = await getDbConnection();
    await conn.execute(
      `INSERT INTO hr_hiring_entries (
        created_by_username, candidate_name, emp_contact, designation, marital_status,
        experience_type, interview_at, interview_mode, status, tag, hire_date, \`package\`, probation_months, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.username,
        d.candidate_name,
        d.emp_contact,
        d.designation,
        d.marital_status,
        d.experience_type,
        toMysqlDatetime(d.interview_at),
        d.interview_mode,
        d.status,
        d.tag,
        d.hire_date,
        d.packageStr,
        d.probation_months,
        d.note,
      ]
    );

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

    const conn = await getDbConnection();
    const [check] = await conn.execute(
      `SELECT id FROM hr_hiring_entries WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
      [id, payload.username]
    );
    if (!check.length) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    const [result] = await conn.execute(
      `UPDATE hr_hiring_entries SET
        candidate_name = ?, emp_contact = ?, designation = ?, marital_status = ?,
        experience_type = ?, interview_at = ?, interview_mode = ?, status = ?, tag = ?,
        hire_date = ?, \`package\` = ?, probation_months = ?, note = ?
      WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
      [
        d.candidate_name,
        d.emp_contact,
        d.designation,
        d.marital_status,
        d.experience_type,
        toMysqlDatetime(d.interview_at),
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
    return NextResponse.json({ success: false, error: error.message || "Server error" }, { status: 500 });
  }
}

/** DELETE ?id= own row only */
export async function DELETE(req) {
  try {
    const payload = await getSessionPayload();
    const denied = assertHrRole(payload);
    if (denied) return denied;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [r] = await conn.execute(
      `DELETE FROM hr_hiring_entries WHERE id = ? AND LOWER(TRIM(created_by_username)) = LOWER(TRIM(?))`,
      [parseInt(id, 10), payload.username]
    );
    return NextResponse.json({ success: true, deleted: r.affectedRows || 0 });
  } catch (error) {
    console.error("[empcrm/hiring DELETE]", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
