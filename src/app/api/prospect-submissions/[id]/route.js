import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureProspectSubmissionsTable } from "@/lib/ensureProspectSubmissionsTable";
import { getReportees } from "@/lib/reportingManager";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

export async function PATCH(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = Number(id);
    if (!submissionId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "").toLowerCase();
    const acknowledgmentNotes = String(body?.acknowledgment_notes || "").trim();

    if (!["pending", "acknowledged", "reviewed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (status === "acknowledged" && !acknowledgmentNotes) {
      return NextResponse.json(
        { error: "Acknowledgment notes are required." },
        { status: 400 },
      );
    }

    await ensureProspectSubmissionsTable();
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id, submitted_by, reporting_manager FROM prospect_submissions WHERE id = ? LIMIT 1`,
      [submissionId],
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");
    const username = String(payload.username).trim();
    const reportees = await getReportees(username);
    const canUpdate =
      roleNorm === "SUPERADMIN" ||
      roleNorm === "ADMIN" ||
      String(row.reporting_manager || "").trim() === username ||
      reportees.includes(String(row.submitted_by || "").trim());

    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalizedStatus = status === "reviewed" ? "acknowledged" : status;

    if (normalizedStatus === "acknowledged") {
      await conn.execute(
        `UPDATE prospect_submissions
         SET status = ?,
             acknowledgment_notes = ?,
             acknowledged_by = ?,
             acknowledged_at = NOW()
         WHERE id = ?`,
        [normalizedStatus, acknowledgmentNotes, username, submissionId],
      );
    } else {
      await conn.execute(
        `UPDATE prospect_submissions
         SET status = ?,
             acknowledgment_notes = NULL,
             acknowledged_by = NULL,
             acknowledged_at = NULL
         WHERE id = ?`,
        [normalizedStatus, submissionId],
      );
    }

    return NextResponse.json({
      success: true,
      status: normalizedStatus,
      acknowledgment_notes: normalizedStatus === "acknowledged" ? acknowledgmentNotes : null,
    });
  } catch (error) {
    console.error("prospect-submissions PATCH error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
