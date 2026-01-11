import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

// GET: Fetch profile by username (query param)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let username = searchParams.get("username");
    let session = null;
    // Fallback to session username if not provided and capture session for more fallbacks
    try { session = await getSessionPayload(); } catch { }
    if (!username && session?.username) {
      username = session.username;
    }

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    console.log('[EMPCRM][GET] Incoming:', {
      requestedUsername: username,
      sessionUsername: session?.username || null,
      sessionEmpId: session?.empId || null,
      sessionEmail: session?.email || null,
    });

    let profiles = [];
    if (username) {
      // Strict lookup by username when provided
      const [rows] = await conn.execute(
        `SELECT * FROM employee_profiles WHERE username = ? LIMIT 1`,
        [username]
      );
      profiles = rows;
      // Fallback attempts only if not found by username
      if (profiles.length === 0) {
        console.log('[EMPCRM][GET] Username not found, trying fallbacks for:', username);
        const attempts = [];
        attempts.push(['employee_code', username]);
        attempts.push(['empId', username]);
        attempts.push(['email', username]);
        if (session?.empId) {
          attempts.push(['employee_code', String(session.empId)]);
          attempts.push(['empId', String(session.empId)]);
        }
        if (session?.email) attempts.push(['email', session.email]);
        for (const [column, value] of attempts) {
          if (!value) continue;
          const [r2] = await conn.execute(
            `SELECT * FROM employee_profiles WHERE ${column} = ? LIMIT 1`,
            [value]
          );
          if (r2.length > 0) { profiles = r2; console.log('[EMPCRM][GET] Matched by fallback', column, value); break; }
        }
      }
    } else {
      // No username provided: attempt multiple identifiers from session
      const attempts = [];
      if (session?.username) attempts.push(['username', session.username]);
      if (session?.empId) {
        attempts.push(['employee_code', String(session.empId)]);
        attempts.push(['empId', String(session.empId)]);
      }
      if (session?.email) attempts.push(['email', session.email]);

      for (const [column, value] of attempts) {
        if (!value) continue;
        const [rows] = await conn.execute(
          `SELECT * FROM employee_profiles WHERE ${column} = ? LIMIT 1`,
          [value]
        );
        if (rows.length > 0) { profiles = rows; console.log('[EMPCRM][GET] Matched by session', column, value); break; }
      }
    }

    if (profiles.length === 0) {
      console.log('[EMPCRM][GET] Profile not found for request:', { requestedUsername: username });
      return NextResponse.json({
        success: true,
        profile: null,
        message: "Profile not found",
      });
    }

    const profile = profiles[0];
    console.log('[EMPCRM][GET] Returning profile id:', profile?.id);

    // Normalize date fields to YYYY-MM-DD for UI consistency
    const normalizeDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      // Assume string already in acceptable format
      return val;
    };
    profile.date_of_joining = normalizeDate(profile.date_of_joining);
    profile.date_of_birth = normalizeDate(profile.date_of_birth);

    // Fetch references
    const [references] = await conn.execute(
      `SELECT * FROM employee_references WHERE profile_id = ? ORDER BY reference_type`,
      [profile.id]
    );

    // Fetch education
    const [education] = await conn.execute(
      `SELECT * FROM employee_education WHERE profile_id = ? ORDER BY display_order, year_of_passing DESC`,
      [profile.id]
    );

    // Fetch experience
    const [experience] = await conn.execute(
      `SELECT * FROM employee_experience WHERE profile_id = ? ORDER BY display_order, period_from DESC`,
      [profile.id]
    );

    // Parse JSON fields
    profile.joining_form_documents = profile.joining_form_documents
      ? JSON.parse(profile.joining_form_documents)
      : [];
    profile.documents_submitted = profile.documents_submitted
      ? JSON.parse(profile.documents_submitted)
      : {};
    // leave_policy JSON
    if (profile.leave_policy) {
      try { profile.leave_policy = JSON.parse(profile.leave_policy); } catch { }
    } else {
      profile.leave_policy = {};
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        references,
        education,
        experience,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper for saving profile (Create or Update)
async function saveProfile(request, methodType) {
  let conn;
  try {
    const session = await getSessionPayload();
    const currentUser = session?.username;

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const url = new URL(request.url);
    const modeParam = url.searchParams.get('mode');
    const entryModeField = formData.get('entryMode');
    const isManual = (entryModeField && String(entryModeField).toLowerCase() === 'manual') || (modeParam && modeParam.toLowerCase() === 'manual');

    // Helpers
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
    const data = {};

    // Extract all text fields
    console.log(`[EMPCRM][${methodType}] Raw FormData Keys:`, Array.from(formData.keys()));
    for (const [key, value] of formData.entries()) {
      const isFileObject = value && typeof value === 'object' && 'arrayBuffer' in value;
      if (
        isFileObject ||
        key.startsWith("file_") ||
        key.startsWith("education[") ||
        key.startsWith("experience[") ||
        key.startsWith("reference[") ||
        key.startsWith("document_") ||
        key === "references" ||
        key === "education" ||
        key === "experience" ||
        key === "fileUrls"
      ) {
        continue;
      }
      data[key] = value;
    }

    // Normalize boolean/numeric fields
    if (data.is_experienced !== undefined) {
      data.is_experienced = toBoolean(data.is_experienced) ? 1 : 0;
    }

    const username = data.username;
    const empId = data.empId;

    if (!username || !empId) {
      return NextResponse.json(
        { success: false, error: "Username and empId are required" },
        { status: 400 }
      );
    }

    // Handle file uploads
    const uploadDir = path.join(process.cwd(), "public", "employee_profiles", username);
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];
    const sanitizeToken = (val) => String(val || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileExt = (name) => {
      try { return path.extname(name || '').slice(0, 16); } catch { return ''; }
    };

    const processFile = async (file, prefix) => {
      const name = `${prefix}_${Date.now()}${fileExt(file.name)}`;
      const p = path.join(uploadDir, name);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(p, buffer);
      return `/employee_profiles/${username}/${name}`;
    };

    const profilePhoto = formData.get("profile_photo");
    if (profilePhoto && profilePhoto.size > 0) {
      data.profile_photo = await processFile(profilePhoto, 'profile_photo');
    }

    const signature = formData.get("signature");
    if (signature && signature.size > 0) {
      data.signature = await processFile(signature, 'signature');
    }

    const documents = formData.getAll("joining_form_documents");
    for (const doc of documents) {
      if (typeof doc === 'string' && doc.trim() !== '') {
        uploadedFiles.push(doc);
      } else if (doc && typeof doc === 'object' && 'arrayBuffer' in doc && doc.size > 0) {
        const url = await processFile(doc, 'joining_document');
        uploadedFiles.push(url);
      }
    }

    // Strategy B: Per-document fields
    for (const [key, val] of formData.entries()) {
      if (key === 'profile_photo' || key === 'signature' || key === 'joining_form_documents') continue;
      if (!key.startsWith('document_')) continue;
      if (val && typeof val === 'object' && 'arrayBuffer' in val && val.size > 0) {
        const safeKey = sanitizeToken(key);
        const url = await processFile(val, safeKey);
        uploadedFiles.push(url);
      }
    }

    console.log(`[EMPCRM][${methodType}] Upload summary:`, {
      username,
      uploadedFilesCount: uploadedFiles.length,
    });

    // Checklists
    const rawDocumentsSubmitted = formData.get('documents_submitted') ?? data.documents_submitted;
    const documentsSubmittedObj = parseMaybeJson(rawDocumentsSubmitted, {});
    if (Object.keys(documentsSubmittedObj).length === 0) {
      for (const [k, v] of formData.entries()) {
        if (!String(k).startsWith('document_')) continue;
        const isFile = v && typeof v === 'object' && 'arrayBuffer' in v && v.size > 0;
        if (isFile) {
          documentsSubmittedObj[k] = true;
          continue;
        }
        if (typeof v === 'string' && ['on', 'true', '1'].includes(v.toLowerCase())) {
          documentsSubmittedObj[k] = true;
        }
      }
    }
    data.documents_submitted = JSON.stringify(documentsSubmittedObj);

    // Dates
    const toYyyyMmDd = (val) => {
      if (!val) return null;
      if (typeof val !== 'string') return val;
      const s = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      return s;
    };
    if (data.date_of_joining) data.date_of_joining = toYyyyMmDd(data.date_of_joining) || null;
    if (data.date_of_birth) data.date_of_birth = toYyyyMmDd(data.date_of_birth) || null;

    conn = await getDbConnection();

    // Check Existence
    const [existing] = await conn.execute(
      `SELECT id, joining_form_documents FROM employee_profiles WHERE username = ?`,
      [username]
    );

    let profileId;
    let previousDocs = [];
    if (existing.length > 0) {
      try { previousDocs = existing[0].joining_form_documents ? JSON.parse(existing[0].joining_form_documents) : []; } catch { }
    }

    // Method constraints
    if (methodType === 'PUT') { // Create or Upsert
      if (existing.length > 0) {
        console.log('[EMPCRM][PUT] Profile exists, updating...');
      }
    } else if (methodType === 'PATCH') { // Update
      if (existing.length === 0) {
        return NextResponse.json({ success: false, error: "Profile not found for update" }, { status: 404 });
      }
    }

    // Merge docs
    // Use Unique Merge
    const allDocs = [...(Array.isArray(previousDocs) ? previousDocs : []), ...uploadedFiles];
    const uniqueDocs = [...new Set(allDocs)];
    data.joining_form_documents = JSON.stringify(uniqueDocs);

    // Validation (AUTO MODE ONLY): if any checklist item is selected, at least one document must exist (old or new)
    if (!isManual) {
      const anyChecklistSelected = Object.values(documentsSubmittedObj).some((v) => toBoolean(v));
      if (anyChecklistSelected && uniqueDocs.length === 0) {
        return NextResponse.json(
          { success: false, error: "Please upload the required document(s) for the selected checklist." },
          { status: 400 }
        );
      }
    }

    if (existing.length > 0) {
      // UPDATE
      profileId = existing[0].id;
      const updateFields = [];
      const updateValues = [];
      for (const [key, value] of Object.entries(data)) {
        if (key !== 'username' && key !== 'empId' && key !== 'id') {
          const isFileObject = value && typeof value === 'object' && 'arrayBuffer' in value;
          if (isFileObject || key.startsWith('document_')) continue;
          updateFields.push(`\`${key}\` = ?`);
          updateValues.push(value);
        }
      }
      updateFields.push('updated_at = NOW()');
      updateValues.push(username);

      await conn.execute(
        `UPDATE employee_profiles SET ${updateFields.join(', ')} WHERE username = ?`,
        updateValues
      );
    } else {
      // INSERT
      data.created_by = currentUser;
      const fields = Object.keys(data).map((k) => `\`${k}\``).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);
      const [result] = await conn.execute(
        `INSERT INTO employee_profiles (${fields}) VALUES (${placeholders})`,
        values
      );
      profileId = result.insertId;
    }

    // Child Tables (References, Education, Experience)
    // Common logic for child tables
    // References
    await conn.execute(`DELETE FROM employee_references WHERE profile_id = ?`, [profileId]);
    let references = parseMaybeJson(formData.get("references"), []);
    if (!Array.isArray(references) && references && typeof references === 'object') references = [references];
    for (const ref of references) {
      if (ref.reference_name || ref.name) {
        await conn.execute(
          `INSERT INTO employee_references (profile_id, reference_name, reference_mobile, reference_type, reference_address, relationship) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, ref.name || ref.reference_name, ref.contact || ref.reference_mobile, ref.reference_type || 'Professional', ref.address || ref.reference_address, ref.relationship]
        );
      }
    }

    // Education
    await conn.execute(`DELETE FROM employee_education WHERE profile_id = ?`, [profileId]);
    let education = parseMaybeJson(formData.get("education"), []);
    if (!Array.isArray(education) && education && typeof education === 'object') education = [education];
    for (let i = 0; i < education.length; i++) {
      const edu = education[i];
      if (edu.exam_name) {
        await conn.execute(
          `INSERT INTO employee_education (profile_id, exam_name, board_university, year_of_passing, grade_percentage, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [profileId, edu.exam_name, edu.board_university, edu.year_of_passing, edu.grade_percentage, i]
        );
      }
    }

    // Experience
    await conn.execute(`DELETE FROM employee_experience WHERE profile_id = ?`, [profileId]);
    let experience = parseMaybeJson(formData.get("experience"), []);
    if (!Array.isArray(experience) && experience && typeof experience === 'object') experience = [experience];
    for (let i = 0; i < experience.length; i++) {
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

    console.log(`[EMPCRM][${methodType}] Completed successfully for`, username);

    return NextResponse.json({
      success: true,
      message: existing.length > 0 ? "Profile updated successfully" : "Profile created successfully",
      profileId
    });

  } catch (error) {
    console.error(`[EMPCRM][${methodType}] Error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  // Legacy support or fallback
  return saveProfile(request, 'POST');
}

export async function PUT(request) {
  return saveProfile(request, 'PUT');
}

export async function PATCH(request) {
  return saveProfile(request, 'PATCH');
}

// DELETE: Delete profile
export async function DELETE(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    await conn.execute(
      `DELETE FROM employee_profiles WHERE username = ?`,
      [username]
    );

    return NextResponse.json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
