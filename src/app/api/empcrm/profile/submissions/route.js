import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

// GET: List submissions (admin/HR only); optional filters: status, username
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const username = searchParams.get('username');
    const id = searchParams.get('id');

    const conn = await getDbConnection();
    let sql = `SELECT * FROM employee_profile_submissions WHERE status = ?`;
    const params = [status];
    if (username) { sql += ' AND username = ?'; params.push(username); }
    if (id) { sql += ' AND id = ?'; params.push(id); }
    sql += ' ORDER BY submitted_at DESC';

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
    if (!session?.username) {
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
        key === 'references' || key === 'education' || key === 'experience'
      ) continue;
      data[key] = value;
    }

    const username = data.username || session.username;
    const empId = data.empId || session.empId;
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

    // Save submission
    const conn = await getDbConnection();
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
    if (!session?.username) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, action, rejection_reason } = body;
    if (!submissionId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'submissionId and valid action are required' }, { status: 400 });
    }

    conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT * FROM employee_profile_submissions WHERE id = ?`, [submissionId]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Submission not found' }, { status: 404 });
    }
    const submission = rows[0];

    if (action === 'reject') {
      await conn.execute(
        `UPDATE employee_profile_submissions SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ?`,
        [session.username, rejection_reason || null, submissionId]
      );
      return NextResponse.json({ success: true, message: 'Submission rejected' });
    }

    // Approve: merge into employee_profiles and child tables
    let payload;
    try { payload = submission.payload ? JSON.parse(submission.payload) : null; } catch { payload = null; }
    if (!payload || !payload.data) {
      return NextResponse.json({ success: false, error: 'Invalid submission payload' }, { status: 400 });
    }
    const { data, references = [], education = [], experience = [] } = payload;
    const username = submission.username;

    // Fetch existing profile id and existing docs
    const [existing] = await conn.execute(`SELECT id, joining_form_documents FROM employee_profiles WHERE username = ?`, [username]);

    let profileId;
    let previousDocs = [];
    if (existing.length > 0) {
      profileId = existing[0].id;
      try { previousDocs = existing[0].joining_form_documents ? JSON.parse(existing[0].joining_form_documents) : []; } catch { previousDocs = []; }
    }
    let uploadedFiles = [];
    try { uploadedFiles = submission.uploaded_files ? JSON.parse(submission.uploaded_files) : []; } catch { uploadedFiles = []; }

    // Deduplicate documents: If uploadedFiles (from submission) contains URLs, it likely represents the full intended list (including preserved ones).
    // However, to ensure we don't duplicate existing ones if they are merged, we use a Set.
    // If the submission system is working correctly (POST includes existing), then uploadedFiles IS the final list.
    // But to be safe if POST only had new files (old logic), we might want to merge. 
    // Given checks in POST, uploadedFiles should have everything.
    // Let's use a unique set of all non-empty strings.

    const allDocs = [...(Array.isArray(previousDocs) ? previousDocs : []), ...uploadedFiles];
    const uniqueDocs = [...new Set(allDocs)];

    // Wait, if user wanted to DELETE a doc, merging previousDocs will bring it back.
    // The user requirement says "edit... previous data should not be change". It implies adding.
    // But if editing, usually implies ability to remove.
    // If I switched POST to include "Preserved URLs", then `uploadedFiles` has the user's intent.
    // If I merge `previousDocs`, I prevent deletion.
    // But users mostly "add".
    // I will stick to the safer "Merge Unique". Why? Because if there's a bug in frontend not sending old docs, merge saves them. 
    // And users didn't explicitly ask for delete.

    const upsertData = { ...data, joining_form_documents: JSON.stringify(uniqueDocs) };

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
    console.log('[DEBUG][PATCH] Inserting references for profileId:', profileId, 'Count:', references.length, 'Data:', JSON.stringify(references));
    for (const ref of references) {
      if (ref.reference_name || ref.name) {
        await conn.execute(
          `INSERT INTO employee_references (profile_id, reference_name, reference_mobile, reference_type, reference_address, relationship) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, ref.name || ref.reference_name, ref.contact || ref.reference_mobile, ref.reference_type || 'Reference1', ref.address || ref.reference_address, ref.relationship]
        );
      }
    }

    await conn.execute(`DELETE FROM employee_education WHERE profile_id = ?`, [profileId]);
    for (let i = 0; i < (education?.length || 0); i++) {
      const edu = education[i];
      if (edu.exam_name) {
        await conn.execute(
          `INSERT INTO employee_education (profile_id, exam_name, board_university, year_of_passing, grade_percentage, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, edu.exam_name, edu.board_university, edu.year_of_passing, edu.grade_percentage, i]
        );
      }
    }

    await conn.execute(`DELETE FROM employee_experience WHERE profile_id = ?`, [profileId]);
    for (let i = 0; i < (experience?.length || 0); i++) {
      const exp = experience[i];
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
      `UPDATE employee_profile_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = NULL WHERE id = ?`,
      [session.username, submissionId]
    );

    return NextResponse.json({ success: true, message: 'Submission approved and profile updated', profileId });
  } catch (error) {
    console.error('[PROFILE][SUBMISSIONS][PATCH] error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
