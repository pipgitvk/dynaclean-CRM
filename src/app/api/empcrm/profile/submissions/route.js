import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  mergePayloadDataPreferNonEmpty,
  referencesPayloadHasContent,
  educationPayloadHasContent,
  experiencePayloadHasContent,
  mapDbReferencesToPayload,
  mapDbEducationToPayload,
  mapDbExperienceToPayload,
} from "@/lib/submissionPayloadMerge";

/** Lowercase trimmed status; empty string if missing (e.g. ENUM rejected an UPDATE). */
function normalizeSubStatus(s) {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Blank status after "Approve employee sections" usually means the DB column rejected `pending_hr_docs`
 * (ENUM / VARCHAR too short). Heal to pending_hr_docs when the row clearly completed first HR review.
 */
async function maybeRepairBlankSubmissionStatus(conn, row) {
  if (!row?.id) return row;
  if (normalizeSubStatus(row.status) !== "") return row;
  if (!row.reviewed_at) return row;
  if (row.rejection_reason != null && String(row.rejection_reason).trim() !== "") return row;
  try {
    await conn.execute(
      `UPDATE employee_profile_submissions SET status = 'pending_hr_docs' WHERE id = ? AND (status IS NULL OR TRIM(status) = '')`,
      [row.id]
    );
    const [again] = await conn.execute(`SELECT * FROM employee_profile_submissions WHERE id = ?`, [row.id]);
    if (again.length) return again[0];
  } catch (e) {
    console.error("[PROFILE][SUBMISSIONS] status repair failed (run VARCHAR migration):", e?.message || e);
  }
  return row;
}

/** JWT may carry username and/or id (empId). Submission rows use username + empId — match both. */
function sessionAccountIdentity(session) {
  if (!session) return { username: "", empId: null };
  const username = typeof session.username === "string" ? session.username.trim() : "";
  const empId = session.empId ?? session.id ?? null;
  return { username, empId };
}

function submissionBelongsToSessionRow(sub, session) {
  const { username, empId } = sessionAccountIdentity(session);
  if (username && String(sub.username || "").trim().toLowerCase() === username.toLowerCase()) return true;
  if (empId != null && empId !== "" && String(sub.empId) === String(empId)) return true;
  return false;
}

/** (username match OR empId match) for this session — own submissions only */
/** HR roles that can list/approve profile submissions (case-insensitive) */
function isEmpcrmProfileAdmin(session) {
  if (!session?.role) return false;
  const r = String(session.role).trim();
  return ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].some((a) => a.toLowerCase() === r.toLowerCase());
}

/** Final profile publish (merge into employee_profiles) — Super Admin only */
function isSuperAdmin(session) {
  if (!session?.role) return false;
  return String(session.role).trim().toUpperCase() === "SUPERADMIN";
}

function isHrHead(session) {
  if (!session?.role) return false;
  return String(session.role).trim().toLowerCase() === "hr head";
}

/** Super Admin or HR Head sees every pending row (including delegated). */
function canSeeAllPendingHrQueue(session) {
  return isSuperAdmin(session) || isHrHead(session);
}

/** Single submission row visible in admin GET ?id= */
function submissionVisibleToAdmin(session, sub) {
  if (!sub) return false;
  let st = normalizeSubStatus(sub.status);
  if (!st && sub.reviewed_at && (sub.rejection_reason == null || String(sub.rejection_reason).trim() === "")) {
    st = "pending_hr_docs";
  }
  if (st === "pending_admin" && !isSuperAdmin(session)) return false;
  if (st === "pending" || st === "pending_hr_docs") {
    const a = sub.pending_assignee_username;
    if (a == null || String(a).trim() === "") return true;
    if (canSeeAllPendingHrQueue(session)) return true;
    const su = String(session.username || "").trim().toLowerCase();
    return su === String(a).trim().toLowerCase();
  }
  return true;
}

/** Approve / reject / reassign on pending — respects HR delegation */
function canActOnPendingSubmission(session, sub) {
  if (!sub) return true;
  let st = normalizeSubStatus(sub.status);
  if (!st && sub.reviewed_at && (sub.rejection_reason == null || String(sub.rejection_reason).trim() === "")) {
    st = "pending_hr_docs";
  }
  if (st !== "pending" && st !== "pending_hr_docs") return true;
  const a = sub.pending_assignee_username;
  if (a == null || String(a).trim() === "") return true;
  if (isSuperAdmin(session) || isHrHead(session)) return true;
  const su = String(session.username || "").trim().toLowerCase();
  return su === String(a).trim().toLowerCase();
}

function buildSessionSubmissionOwnerWhere(session) {
  const { username, empId } = sessionAccountIdentity(session);
  const parts = [];
  const params = [];
  if (username) {
    parts.push(`LOWER(TRIM(username)) = LOWER(?)`);
    params.push(username);
  }
  if (empId != null && empId !== "") {
    parts.push(`CAST(empId AS CHAR) = CAST(? AS CHAR)`);
    params.push(String(empId));
  }
  if (parts.length === 0) return null;
  return { clause: `(${parts.join(" OR ")})`, params };
}

// Utility helpers
const toBoolean = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const v = val.toLowerCase();
    return v === 'true' || v === '1' || v === 'on' || v === 'yes';
  }
  return false;
};
const parseMaybeJson = (val, fallback) => {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  if (typeof val === 'object') return val;
  return fallback;
};
const toYyyyMmDd = (val) => {
  if (!val) return null;
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return s;
};

// GET: List submissions (admin/HR); ?mine=1 = logged-in employee's active revision request
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine");
    const conn = await getDbConnection();

    if (mine === "1") {
      const owner = buildSessionSubmissionOwnerWhere(session);
      if (!owner) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const sql = `SELECT * FROM employee_profile_submissions WHERE status IN ('reassign', 'revision_requested') AND ${owner.clause} ORDER BY submitted_at DESC LIMIT 1`;
      const [rows] = await conn.execute(sql, owner.params);
      return NextResponse.json({ success: true, submissions: rows });
    }

    if (mine === "latest") {
      const owner = buildSessionSubmissionOwnerWhere(session);
      if (!owner) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      const sql = `SELECT * FROM employee_profile_submissions WHERE ${owner.clause} ORDER BY submitted_at DESC LIMIT 1`;
      const [rows] = await conn.execute(sql, owner.params);
      return NextResponse.json({ success: true, submissions: rows });
    }

    if (!isEmpcrmProfileAdmin(session)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const id = searchParams.get("id");
    if (id) {
      let [rows] = await conn.execute(
        `SELECT * FROM employee_profile_submissions WHERE id = ?`,
        [id]
      );
      if (rows.length && !submissionVisibleToAdmin(session, rows[0])) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
      if (rows.length && isEmpcrmProfileAdmin(session)) {
        rows = [await maybeRepairBlankSubmissionStatus(conn, rows[0])];
      }
      return NextResponse.json({ success: true, submissions: rows });
    }

    const status = (searchParams.get("status") || "pending").trim();
    if (status === "pending_admin" && !isSuperAdmin(session)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }
    const username = searchParams.get("username");
    const adminFinalOnly = ["1", "true", "yes"].includes(
      String(searchParams.get("adminFinalOnly") || "").trim().toLowerCase()
    );

    /**
     * adminFinalOnly=1 — approved/rejected actions done by Super Admin only.
     * approved: ALL status=approved were published by Super Admin (only SA can do pending_admin→approved).
     * rejected: filter by reviewed_by = logged-in Super Admin's own username (to exclude HR rejects from pending).
     */
    if (adminFinalOnly) {
      if (!isSuperAdmin(session)) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
      if (status !== "approved" && status !== "rejected") {
        return NextResponse.json(
          { success: false, error: "adminFinalOnly applies only to approved or rejected" },
          { status: 400 }
        );
      }
      let sql;
      const params = [];
      // approved: only SA can publish (pending_admin→approved), so all approved rows = admin action.
      // rejected: show ALL (HR may also reject from pending). Front-end distinguishes via reviewed_by.
      sql = `SELECT * FROM employee_profile_submissions WHERE status = ?`;
      params.push(status);
      if (username) {
        sql += " AND username = ?";
        params.push(username);
      }
      sql += " ORDER BY submitted_at DESC";

      // For rejected: also fetch reviewer's role so the UI can show "Admin" vs "HR" badge.
      if (status === "rejected") {
        const listSql = sql;
        const [rows] = await conn.execute(listSql, params);
        // Fetch all distinct reviewer usernames in one query
        const reviewers = [...new Set(rows.map((r) => r.reviewed_by).filter(Boolean))];
        let roleMap = {};
        if (reviewers.length) {
          const placeholders = reviewers.map(() => "?").join(", ");
          const [repRows] = await conn.execute(
            `SELECT username, userRole FROM rep_list WHERE username IN (${placeholders})`,
            reviewers
          );
          for (const r of repRows) {
            roleMap[String(r.username || "").trim().toLowerCase()] = String(r.userRole || "").trim().toUpperCase();
          }
        }
        const enriched = rows.map((row) => ({
          ...row,
          reviewer_role: roleMap[String(row.reviewed_by || "").trim().toLowerCase()] || null,
        }));
        return NextResponse.json({ success: true, submissions: enriched });
      }

      const [rows] = await conn.execute(sql, params);
      return NextResponse.json({ success: true, submissions: rows });
    }

    let sql;
    const params = [];
    if (status === "reassign") {
      sql = `SELECT * FROM employee_profile_submissions WHERE status IN ('reassign', 'revision_requested')`;
    } else if (status === "pending") {
      sql = `SELECT * FROM employee_profile_submissions WHERE (
        status IN ('pending', 'pending_hr_docs')
        OR (
          (status IS NULL OR TRIM(status) = '')
          AND reviewed_at IS NOT NULL
          AND (rejection_reason IS NULL OR TRIM(rejection_reason) = '')
        )
      )`;
      if (!canSeeAllPendingHrQueue(session)) {
        const u = String(session.username || "").trim();
        sql += ` AND (pending_assignee_username IS NULL OR TRIM(pending_assignee_username) = '' OR LOWER(TRIM(pending_assignee_username)) = LOWER(?))`;
        params.push(u);
      }
    } else {
      sql = `SELECT * FROM employee_profile_submissions WHERE status = ?`;
      params.push(status);
    }
    if (username) {
      sql += " AND username = ?";
      params.push(username);
    }
    sql += " ORDER BY submitted_at DESC";

    const [rows] = await conn.execute(sql, params);
    return NextResponse.json({ success: true, submissions: rows });
  } catch (error) {
    console.error('[PROFILE][SUBMISSIONS][GET] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Employee self-submits profile data for approval
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const sessIdent = sessionAccountIdentity(session);
    if (!sessIdent.username && (sessIdent.empId == null || sessIdent.empId === "")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // Extract flat text fields (excluding files and arrays we handle separately)
    const data = {};
    for (const [key, value] of formData.entries()) {
      const isFileObject = value && typeof value === 'object' && 'arrayBuffer' in value;
      if (
        isFileObject ||
        key.startsWith('file_') ||
        key.startsWith('education[') ||
        key.startsWith('experience[') ||
        key.startsWith('reference[') ||
        key.startsWith('document_') ||
        key === 'references' || key === 'education' || key === 'experience' ||
        key === 'resubmitSubmissionId'
      ) continue;
      data[key] = value;
    }

    const username = data.username || session.username || sessIdent.username;
    const empId = data.empId || session.empId || sessIdent.empId;
    if (!username || !empId) {
      return NextResponse.json({ success: false, error: "Username and empId are required" }, { status: 400 });
    }

    // Upload files to same directory as final profile for consistency
    const uploadDir = path.join(process.cwd(), 'public', 'employee_profiles', username);
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];
    const fileExt = (name) => { try { return path.extname(name || '').slice(0, 16); } catch { return ''; } };

    const profilePhoto = formData.get('profile_photo');
    if (profilePhoto && profilePhoto.size > 0) {
      const name = `profile_photo_${Date.now()}${fileExt(profilePhoto.name)}`;
      const p = path.join(uploadDir, name);
      const buffer = Buffer.from(await profilePhoto.arrayBuffer());
      await writeFile(p, buffer);
      data.profile_photo = `/employee_profiles/${encodeURIComponent(username)}/${encodeURIComponent(name)}`;
      uploadedFiles.push(data.profile_photo);
    }

    const signature = formData.get('signature');
    if (signature && signature.size > 0) {
      const name = `signature_${Date.now()}${fileExt(signature.name)}`;
      const p = path.join(uploadDir, name);
      const buffer = Buffer.from(await signature.arrayBuffer());
      await writeFile(p, buffer);
      data.signature = `/employee_profiles/${encodeURIComponent(username)}/${encodeURIComponent(name)}`;
      uploadedFiles.push(data.signature);
    }

    // Strategy A: joining_form_documents[]
    const documents = formData.getAll('joining_form_documents');
    for (const doc of documents) {
      if (typeof doc === 'string' && doc.trim() !== '') {
        // Existing document URL
        uploadedFiles.push(doc);
      } else if (doc && typeof doc === 'object' && 'arrayBuffer' in doc && doc.size > 0) {
        const name = `joining_document_${Date.now()}${fileExt(doc.name)}`;
        const p = path.join(uploadDir, name);
        const buffer = Buffer.from(await doc.arrayBuffer());
        await writeFile(p, buffer);
        uploadedFiles.push(`/employee_profiles/${encodeURIComponent(username)}/${encodeURIComponent(name)}`);
      }
    }
    // Strategy B: individual document_* fields
    for (const [key, val] of formData.entries()) {
      if (key === 'profile_photo' || key === 'signature' || key === 'joining_form_documents') continue;
      if (!(key.startsWith('document_') || key.startsWith('doc_'))) continue;
      if (val && typeof val === 'object' && 'arrayBuffer' in val && val.size > 0) {
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        const name = `${safeKey}_${Date.now()}${fileExt(val.name)}`;
        const p = path.join(uploadDir, name);
        const buffer = Buffer.from(await val.arrayBuffer());
        await writeFile(p, buffer);
        uploadedFiles.push(`/employee_profiles/${encodeURIComponent(username)}/${encodeURIComponent(name)}`);
      }
    }

    // Normalize special fields
    data.date_of_joining = data.date_of_joining ? toYyyyMmDd(data.date_of_joining) : null;
    data.date_of_birth = data.date_of_birth ? toYyyyMmDd(data.date_of_birth) : null;

    // Checklist
    const rawDocumentsSubmitted = formData.get('documents_submitted') ?? data.documents_submitted;
    const documentsSubmittedObj = parseMaybeJson(rawDocumentsSubmitted, {});
    data.documents_submitted = JSON.stringify(documentsSubmittedObj);

    // Aggregates
    let references = parseMaybeJson(formData.get('references'), []);
    if (!Array.isArray(references) && references && typeof references === 'object') references = [references];

    let education = parseMaybeJson(formData.get('education'), []);
    if (!Array.isArray(education) && education && typeof education === 'object') education = [education];

    let experience = parseMaybeJson(formData.get('experience'), []);
    if (!Array.isArray(experience) && experience && typeof experience === 'object') experience = [experience];

    delete data.resubmitSubmissionId;

    const conn = await getDbConnection();
    const resubmitIdRaw = formData.get("resubmitSubmissionId");
    const resubmitId = resubmitIdRaw != null && String(resubmitIdRaw).trim() !== ""
      ? Number(resubmitIdRaw)
      : null;

    if (!resubmitId) {
      const whereSession = buildSessionSubmissionOwnerWhere(session);
      let revPendingRows = [];
      if (whereSession) {
        const sqlRev = `SELECT id FROM employee_profile_submissions WHERE status IN ('reassign', 'revision_requested') AND ${whereSession.clause} LIMIT 1`;
        [revPendingRows] = await conn.execute(sqlRev, whereSession.params);
      }
      if (revPendingRows.length > 0) {
        return NextResponse.json(
          { success: false, error: "You have pending corrections from HR. Please update your profile and resubmit from the same screen." },
          { status: 400 }
        );
      }
    }

    if (resubmitId) {
      const [subRows] = await conn.execute(`SELECT * FROM employee_profile_submissions WHERE id = ?`, [resubmitId]);
      if (subRows.length === 0) {
        return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
      }
      const sub = subRows[0];
      if (!submissionBelongsToSessionRow(sub, session)) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (sub.status !== "reassign" && sub.status !== "revision_requested") {
        return NextResponse.json({ success: false, error: "This submission is not awaiting revision" }, { status: 400 });
      }

      // Merge with previous payload so HR always sees a full record (partial FormData keys don't drop untouched fields).
      const oldPayload = parseMaybeJson(sub.payload, {});
      const oldData = oldPayload.data && typeof oldPayload.data === "object" ? oldPayload.data : {};
      const mergedData = mergePayloadDataPreferNonEmpty(oldData, data);

      const mergedReferences =
        Array.isArray(references) && references.length > 0 ? references : (Array.isArray(oldPayload.references) ? oldPayload.references : []);
      const mergedEducation =
        Array.isArray(education) && education.length > 0 ? education : (Array.isArray(oldPayload.education) ? oldPayload.education : []);

      const isExp = toBoolean(data.is_experienced ?? mergedData.is_experienced ?? oldData.is_experienced);
      let mergedExperience;
      if (!isExp) {
        mergedExperience = [];
      } else if (Array.isArray(experience) && experience.length > 0) {
        mergedExperience = experience;
      } else {
        mergedExperience = Array.isArray(oldPayload.experience) ? oldPayload.experience : [];
      }

      let oldUploadedFiles = [];
      try {
        oldUploadedFiles = sub.uploaded_files ? JSON.parse(sub.uploaded_files) : [];
      } catch {
        oldUploadedFiles = [];
      }
      if (!Array.isArray(oldUploadedFiles)) oldUploadedFiles = [];
      const mergedUploadedFiles = [...new Set([...oldUploadedFiles, ...uploadedFiles])];

      // Keep reassigned_fields / reassignment_note so HR can see what was sent back until approve/reject.
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'pending', payload = ?, uploaded_files = ?, submitted_by = ?, submitted_at = NOW(),
         reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL, pending_assignee_username = NULL
         WHERE id = ?`,
        [JSON.stringify({ data: mergedData, references: mergedReferences, education: mergedEducation, experience: mergedExperience }), JSON.stringify(mergedUploadedFiles), session.username, resubmitId]
      );
      return NextResponse.json({ success: true, message: "Profile resubmitted for HR approval", submissionId: resubmitId });
    }

    const [result] = await conn.execute(
      `INSERT INTO employee_profile_submissions (username, empId, status, payload, uploaded_files, submitted_by) VALUES (?, ?, 'pending', ?, ?, ?)`,
      [username, empId, JSON.stringify({ data, references, education, experience }), JSON.stringify(uploadedFiles), session.username]
    );

    return NextResponse.json({ success: true, message: 'Profile submitted for HR approval', submissionId: result.insertId });
  } catch (error) {
    console.error('[PROFILE][SUBMISSIONS][POST] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Approve/Reject a submission (admin/HR only)
export async function PATCH(request) {
  let conn;
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isEmpcrmProfileAdmin(session)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, action, rejection_reason, fields, reassignment_note, reassign_target, assignee_username } = body;
    if (!submissionId || !action || !['approve', 'reject', 'reassign', 'forward_to_admin'].includes(action)) {
      return NextResponse.json({ success: false, error: 'submissionId and valid action are required' }, { status: 400 });
    }

    conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT * FROM employee_profile_submissions WHERE id = ?`, [submissionId]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }
    const submission = rows[0];

    if (action === "reassign") {
      if (normalizeSubStatus(submission.status) !== "pending") {
        return NextResponse.json({ success: false, error: "Only pending submissions can be reassigned" }, { status: 400 });
      }
      if (!canActOnPendingSubmission(session, submission)) {
        return NextResponse.json(
          { success: false, error: "This submission is assigned to another HR member." },
          { status: 403 }
        );
      }
      const toHr = reassign_target === "hr";
      if (toHr) {
        const assignee = typeof assignee_username === "string" ? assignee_username.trim() : "";
        if (!assignee) {
          return NextResponse.json({ success: false, error: "Select an HR user to assign" }, { status: 400 });
        }
        const note = typeof reassignment_note === "string" ? reassignment_note.trim() : "";
        const fieldArr = Array.isArray(fields) ? fields : [];
        if (fieldArr.length === 0 && !note) {
          return NextResponse.json(
            { success: false, error: "Add a note or select at least one field for the assigned HR" },
            { status: 400 }
          );
        }
        await conn.execute(
          `UPDATE employee_profile_submissions SET status = 'pending', pending_assignee_username = ?, reassigned_fields = ?, reassignment_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
          [
            assignee,
            fieldArr.length ? JSON.stringify(fieldArr) : null,
            note || null,
            session.username,
            submissionId,
          ]
        );
        return NextResponse.json({
          success: true,
          message: `Delegated to ${assignee} for review (still in HR queue).`,
        });
      }
      if (!Array.isArray(fields) || fields.length === 0) {
        return NextResponse.json({ success: false, error: "Select at least one field to reassign" }, { status: 400 });
      }
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'reassign', reassigned_fields = ?, reassignment_note = ?, reviewed_by = ?, reviewed_at = NOW(), pending_assignee_username = NULL WHERE id = ?`,
        [JSON.stringify(fields), reassignment_note || null, session.username, submissionId]
      );
      return NextResponse.json({ success: true, message: "Selected fields sent to employee for correction" });
    }

    if (action === "forward_to_admin") {
      if (normalizeSubStatus(submission.status) !== "pending_hr_docs") {
        return NextResponse.json(
          { success: false, error: "Send to Super Admin is only available after HR approves employee sections." },
          { status: 400 }
        );
      }
      if (!canActOnPendingSubmission(session, submission)) {
        return NextResponse.json(
          { success: false, error: "This submission is assigned to another HR member." },
          { status: 403 }
        );
      }
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'pending_admin', reviewed_by = ?, reviewed_at = NOW(), pending_assignee_username = NULL WHERE id = ?`,
        [session.username, submissionId]
      );
      return NextResponse.json({
        success: true,
        message: "Sent to Super Admin for final approval.",
      });
    }

    if (action === "reject") {
      const stReject = normalizeSubStatus(submission.status);
      const rejectableStuckBlank =
        !stReject &&
        submission.reviewed_at &&
        (submission.rejection_reason == null || String(submission.rejection_reason).trim() === "");
      if (!["pending", "pending_admin", "pending_hr_docs"].includes(stReject) && !rejectableStuckBlank) {
        return NextResponse.json({ success: false, error: "This submission cannot be rejected." }, { status: 400 });
      }
      if (
        (stReject === "pending" || stReject === "pending_hr_docs" || rejectableStuckBlank) &&
        !canActOnPendingSubmission(session, submission)
      ) {
        return NextResponse.json(
          { success: false, error: "This submission is assigned to another HR member." },
          { status: 403 }
        );
      }
      if (stReject === "pending_admin" && !isSuperAdmin(session)) {
        return NextResponse.json(
          { success: false, error: "Only Super Admin can reject at this stage." },
          { status: 403 }
        );
      }
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?, reassigned_fields = NULL, reassignment_note = NULL WHERE id = ?`,
        [session.username, rejection_reason || null, submissionId]
      );
      return NextResponse.json({ success: true, message: "Submission rejected" });
    }

    if (action !== "approve") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    // --- HR first approval: pending → pending_hr_docs (HR completes HR-only docs, then forward_to_admin) ---
    const stApprove = normalizeSubStatus(submission.status);
    if (stApprove === "pending") {
      if (!canActOnPendingSubmission(session, submission)) {
        return NextResponse.json(
          { success: false, error: "This submission is assigned to another HR member." },
          { status: 403 }
        );
      }
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'pending_hr_docs', reviewed_by = ?, reviewed_at = NOW(), pending_assignee_username = NULL WHERE id = ?`,
        [session.username, submissionId]
      );
      const [verifyRows] = await conn.execute(`SELECT status FROM employee_profile_submissions WHERE id = ?`, [
        submissionId,
      ]);
      const after = normalizeSubStatus(verifyRows[0]?.status);
      if (after !== "pending_hr_docs") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Database did not save status pending_hr_docs (column may be ENUM or too short). Run: ALTER TABLE employee_profile_submissions MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending';",
            dbStatus: verifyRows[0]?.status ?? null,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message:
          "Employee sections approved. Complete HR Details (Employment & HR / policy documents), then use Send to Super Admin.",
      });
    }

    if (stApprove === "pending_hr_docs") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Use Send to Super Admin on the form after uploading HR documents — or reject this submission.",
        },
        { status: 400 }
      );
    }

    // --- Super Admin final approval: merge into employee_profiles ---
    if (normalizeSubStatus(submission.status) !== "pending_admin") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nothing to approve, or wait until HR approves first. Reassign submissions must be resubmitted by the employee.",
        },
        { status: 400 }
      );
    }

    if (!isSuperAdmin(session)) {
      return NextResponse.json(
        { success: false, error: "Only Super Admin can publish the profile after HR approval." },
        { status: 403 }
      );
    }

    // Approve: merge into employee_profiles and child tables
    let payload;
    try { payload = submission.payload ? JSON.parse(submission.payload) : null; } catch { payload = null; }
    if (!payload || !payload.data) {
      return NextResponse.json({ success: false, error: 'Invalid submission payload' }, { status: 400 });
    }
    const { data, references = [], education = [], experience = [] } = payload;
    const username = submission.username;

    const [existing] = await conn.execute(`SELECT * FROM employee_profiles WHERE username = ?`, [username]);
    const existingRow = existing[0] || {};

    let profileId = existingRow.id;
    let previousDocs = [];
    if (existingRow.joining_form_documents) {
      try {
        previousDocs = JSON.parse(existingRow.joining_form_documents);
      } catch {
        previousDocs = [];
      }
    }
    if (!Array.isArray(previousDocs)) previousDocs = [];

    let uploadedFiles = [];
    try {
      uploadedFiles = submission.uploaded_files ? JSON.parse(submission.uploaded_files) : [];
    } catch {
      uploadedFiles = [];
    }

    const allDocs = [...(Array.isArray(previousDocs) ? previousDocs : []), ...uploadedFiles];
    const uniqueDocs = [...new Set(allDocs)];

    let refsToInsert = references;
    let eduToInsert = education;
    let expToInsert = experience;
    if (profileId) {
      if (!referencesPayloadHasContent(refsToInsert)) {
        const [rrows] = await conn.execute(`SELECT * FROM employee_references WHERE profile_id = ?`, [profileId]);
        if (rrows.length) refsToInsert = mapDbReferencesToPayload(rrows);
      }
      if (!educationPayloadHasContent(eduToInsert)) {
        const [erows] = await conn.execute(
          `SELECT * FROM employee_education WHERE profile_id = ? ORDER BY display_order, year_of_passing DESC`,
          [profileId]
        );
        if (erows.length) eduToInsert = mapDbEducationToPayload(erows);
      }
      if (!experiencePayloadHasContent(expToInsert)) {
        const [xrows] = await conn.execute(
          `SELECT * FROM employee_experience WHERE profile_id = ? ORDER BY display_order, period_from DESC`,
          [profileId]
        );
        if (xrows.length) expToInsert = mapDbExperienceToPayload(xrows);
      }
    }

    const mergedFlat = mergePayloadDataPreferNonEmpty(existingRow, data);
    const upsertData = { ...mergedFlat, joining_form_documents: JSON.stringify(uniqueDocs) };

    if (existing.length > 0) {
      // Update
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(upsertData)) {
        if (k === 'id') continue;
        const isFileObject = v && typeof v === 'object' && 'arrayBuffer' in v;
        if (isFileObject || String(k).startsWith('document_')) continue;
        fields.push(`\`${k}\` = ?`);
        values.push(v);
      }
      fields.push('updated_at = NOW()');
      values.push(username);
      await conn.execute(`UPDATE employee_profiles SET ${fields.join(', ')} WHERE username = ?`, values);
    } else {
      // Insert
      const fields = Object.keys(upsertData).map((k) => `\`${k}\``).join(', ');
      const placeholders = Object.keys(upsertData).map(() => '?').join(', ');
      const values = Object.values(upsertData);
      const [res] = await conn.execute(`INSERT INTO employee_profiles (${fields}) VALUES (${placeholders})`, values);
      profileId = res.insertId;
    }

    // Replace children
    if (!profileId) {
      const [p] = await conn.execute(`SELECT id FROM employee_profiles WHERE username = ?`, [username]);
      profileId = p[0]?.id;
    }

    await conn.execute(`DELETE FROM employee_references WHERE profile_id = ?`, [profileId]);
    console.log('[DEBUG][PATCH] Inserting references for profileId:', profileId, 'Count:', refsToInsert.length, 'Data:', JSON.stringify(refsToInsert));
    for (const ref of refsToInsert) {
      if (ref.reference_name || ref.name) {
        await conn.execute(
          `INSERT INTO employee_references (profile_id, reference_name, reference_mobile, reference_type, reference_address, relationship) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, ref.name || ref.reference_name, ref.contact || ref.reference_mobile, ref.reference_type || 'Reference1', ref.address || ref.reference_address, ref.relationship]
        );
      }
    }

    await conn.execute(`DELETE FROM employee_education WHERE profile_id = ?`, [profileId]);
    for (let i = 0; i < (eduToInsert?.length || 0); i++) {
      const edu = eduToInsert[i];
      if (edu.exam_name) {
        await conn.execute(
          `INSERT INTO employee_education (profile_id, exam_name, board_university, year_of_passing, grade_percentage, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, edu.exam_name, edu.board_university, edu.year_of_passing, edu.grade_percentage, i]
        );
      }
    }

    await conn.execute(`DELETE FROM employee_experience WHERE profile_id = ?`, [profileId]);
    for (let i = 0; i < (expToInsert?.length || 0); i++) {
      const exp = expToInsert[i];
      if (exp.company_name) {
        const pf = toYyyyMmDd(exp.period_from) || null;
        const pt = toYyyyMmDd(exp.period_to) || null;
        await conn.execute(
          `INSERT INTO employee_experience (profile_id, company_name, designation, gross_salary_ctc, period_from, period_to, reason_for_leaving, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [profileId, exp.company_name, exp.designation, exp.gross_salary_ctc, pf, pt, exp.reason_for_leaving, i]
        );
      }
    }

    // Mark submission as approved
    await conn.execute(
      `UPDATE employee_profile_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = NULL, reassigned_fields = NULL, reassignment_note = NULL WHERE id = ?`,
      [session.username, submissionId]
    );

    return NextResponse.json({ success: true, message: 'Submission approved and profile updated', profileId });
  } catch (error) {
    console.error('[PROFILE][SUBMISSIONS][PATCH] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
