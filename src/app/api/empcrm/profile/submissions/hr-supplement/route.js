import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

function isEmpcrmProfileAdmin(session) {
  if (!session?.role) return false;
  const r = String(session.role).trim();
  return ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].some((a) => a.toLowerCase() === r.toLowerCase());
}

const parseMaybeJson = (val, fallback) => {
  if (val == null) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  if (typeof val === "object") return val;
  return fallback;
};

/**
 * POST multipart: submissionId, documents_submitted (JSON string), file fields doc_* for HR-only uploads.
 * Only when submission.status === pending_hr_docs.
 */
export async function POST(request) {
  let conn;
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isEmpcrmProfileAdmin(session)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const formData = await request.formData();
    const submissionId = Number(formData.get("submissionId"));
    if (!Number.isFinite(submissionId)) {
      return NextResponse.json({ success: false, error: "submissionId is required" }, { status: 400 });
    }

    conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT * FROM employee_profile_submissions WHERE id = ?`, [submissionId]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
    }
    const sub = rows[0];
    const st = String(sub.status ?? "").trim().toLowerCase();
    if (st !== "pending_hr_docs") {
      return NextResponse.json(
        {
          success: false,
          error:
            st === ""
              ? "Submission status is empty in the database (often ENUM rejected pending_hr_docs). Run: ALTER TABLE employee_profile_submissions MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending'; then set this row to pending_hr_docs."
              : "HR documents can only be saved while the request is in the HR documents step.",
        },
        { status: 400 }
      );
    }

    const username = String(sub.username || "").trim();
    if (!username) {
      return NextResponse.json({ success: false, error: "Invalid submission" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "employee_profiles", username);
    await mkdir(uploadDir, { recursive: true });
    const fileExt = (name) => {
      try {
        return path.extname(name || "").slice(0, 16);
      } catch {
        return "";
      }
    };

    let uploadedFiles = [];
    try {
      uploadedFiles = sub.uploaded_files ? JSON.parse(sub.uploaded_files) : [];
    } catch {
      uploadedFiles = [];
    }
    if (!Array.isArray(uploadedFiles)) uploadedFiles = [];

    for (const [key, val] of formData.entries()) {
      if (key === "submissionId" || key === "documents_submitted") continue;
      if (!key.startsWith("doc_")) continue;
      if (val && typeof val === "object" && "arrayBuffer" in val && val.size > 0) {
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
        const name = `${safeKey}_${Date.now()}${fileExt(val.name)}`;
        const p = path.join(uploadDir, name);
        const buffer = Buffer.from(await val.arrayBuffer());
        await writeFile(p, buffer);
        uploadedFiles.push(`/employee_profiles/${encodeURIComponent(username)}/${encodeURIComponent(name)}`);
      }
    }

    let payload = parseMaybeJson(sub.payload, {});
    const data = payload.data && typeof payload.data === "object" ? { ...payload.data } : {};

    const newSubmitted = parseMaybeJson(formData.get("documents_submitted"), {});
    let existingSubmitted = {};
    try {
      existingSubmitted =
        typeof data.documents_submitted === "string"
          ? JSON.parse(data.documents_submitted)
          : data.documents_submitted || {};
    } catch {
      existingSubmitted = {};
    }
    if (typeof existingSubmitted !== "object" || existingSubmitted === null) existingSubmitted = {};
    const mergedSubmitted = { ...existingSubmitted, ...newSubmitted };
    data.documents_submitted = JSON.stringify(mergedSubmitted);

    payload = { ...payload, data };
    const uniqueDocs = [...new Set(uploadedFiles)];

    await conn.execute(
      `UPDATE employee_profile_submissions SET payload = ?, uploaded_files = ? WHERE id = ?`,
      [JSON.stringify(payload), JSON.stringify(uniqueDocs), submissionId]
    );

    return NextResponse.json({ success: true, message: "HR documents saved." });
  } catch (error) {
    console.error("[PROFILE][SUBMISSIONS][HR-SUPPLEMENT] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
