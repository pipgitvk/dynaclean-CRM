import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureProspectSubmissionsTable } from "@/lib/ensureProspectSubmissionsTable";
import {
  getReportingManagerForEmployee,
  getReportees,
} from "@/lib/reportingManager";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { canSubmitProspect } from "@/lib/prospectSubmissionAccess";
import {
  isAllowedProspectUpload,
  uploadProspectSubmissionFile,
} from "@/lib/uploadProspectSubmissionFile";

function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");
    const username = String(payload.username).trim();
    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get("scope") || "").toLowerCase();
    const fromDate = String(searchParams.get("fromDate") || "").trim();
    const toDate = String(searchParams.get("toDate") || "").trim();
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;

    await ensureProspectSubmissionsTable();
    const conn = await getDbConnection();

    const whereParts = [];
    let params = [];
    let effectiveScope = scope;

    if (
      (roleNorm === "SUPERADMIN" || roleNorm === "ADMIN") &&
      (scope === "all" || !scope)
    ) {
      whereParts.push("1=1");
      effectiveScope = "all";
    } else if (scope === "team") {
      const reportees = await getReportees(username);
      if (!reportees.length) {
        return NextResponse.json({
          success: true,
          scope: "team",
          rows: [],
          pendingCount: 0,
          hasReportees: false,
          reportingManager: await getReportingManagerForEmployee(username),
        });
      }
      const placeholders = reportees.map(() => "?").join(", ");
      whereParts.push(`ps.submitted_by IN (${placeholders})`);
      params = [...reportees];
      effectiveScope = "team";
    } else {
      whereParts.push("ps.submitted_by = ?");
      params = [username];
      effectiveScope = "mine";
    }

    if (fromDate && dateRe.test(fromDate)) {
      whereParts.push("DATE(ps.created_at) >= ?");
      params.push(fromDate);
    }
    if (toDate && dateRe.test(toDate)) {
      whereParts.push("DATE(ps.created_at) <= ?");
      params.push(toDate);
    }

    const whereSql = whereParts.join(" AND ");

    const [rows] = await conn.execute(
      `SELECT
         ps.id,
         ps.submitted_by,
         ps.reporting_manager,
         ps.notes,
         ps.pdf_path,
         ps.pdf_original_name,
         ps.status,
         ps.acknowledgment_notes,
         ps.acknowledged_by,
         DATE_FORMAT(ps.acknowledged_at, '%Y-%m-%d %H:%i:%s') AS acknowledged_at,
         DATE_FORMAT(ps.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(ps.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM prospect_submissions ps
       WHERE ${whereSql}
       ORDER BY ps.created_at DESC`,
      params,
    );

    let pendingCount = 0;
    if (
      effectiveScope === "team" ||
      effectiveScope === "all" ||
      roleNorm === "SUPERADMIN" ||
      roleNorm === "ADMIN"
    ) {
      pendingCount = rows.filter(
        (r) => String(r.status).toLowerCase() === "pending",
      ).length;
    }

    const reportees = await getReportees(username);

    return NextResponse.json({
      success: true,
      scope: effectiveScope,
      rows: rows.map(serializeRow),
      pendingCount,
      hasReportees: reportees.length > 0,
      reportingManager: await getReportingManagerForEmployee(username),
    });
  } catch (error) {
    console.error("prospect-submissions GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prospect submissions" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = String(payload.username).trim();
    const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");
    if (!canSubmitProspect(roleNorm)) {
      return NextResponse.json(
        { error: "This role cannot submit prospects." },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const notes = String(formData.get("notes") || "").trim();
    const uploadFile = formData.get("pdf") || formData.get("file");

    if (!uploadFile || typeof uploadFile === "string") {
      return NextResponse.json(
        { error: "PDF or image file is required." },
        { status: 400 },
      );
    }

    const originalName = String(uploadFile.name || "prospect-file");
    if (!isAllowedProspectUpload(uploadFile, originalName)) {
      return NextResponse.json(
        { error: "Only PDF or image files are allowed." },
        { status: 400 },
      );
    }

    const reportingManager = await getReportingManagerForEmployee(username);
    if (!reportingManager) {
      return NextResponse.json(
        { error: "Reporting manager is not assigned. Please contact HR/Admin." },
        { status: 400 },
      );
    }

    const uploaded = await uploadProspectSubmissionFile(uploadFile, username);

    await ensureProspectSubmissionsTable();
    const conn = await getDbConnection();

    const [insertResult] = await conn.execute(
      `INSERT INTO prospect_submissions
        (submitted_by, reporting_manager, notes, pdf_path, pdf_original_name, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        username,
        reportingManager,
        notes || null,
        uploaded.url,
        uploaded.originalName || originalName,
      ],
    );

    return NextResponse.json({
      success: true,
      id: insertResult.insertId,
      reportingManager,
      pdf_path: uploaded.url,
      message: "Prospect submitted to your reporting manager.",
    });
  } catch (error) {
    console.error("prospect-submissions POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit prospect" },
      { status: 500 },
    );
  }
}
