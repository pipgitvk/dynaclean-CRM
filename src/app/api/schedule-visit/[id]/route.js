import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import { ensureScheduleVisitTable } from "@/lib/ensureScheduleVisitTable";
import { getReportees, isReportingManagerOf } from "@/lib/reportingManager";

const PRIVILEGED_ROLES = ["SUPERADMIN", "DIRECTOR", "ADMIN"];

function isPrivileged(role) {
  return PRIVILEGED_ROLES.includes(String(role || "").toUpperCase());
}

/**
 * PATCH /api/schedule-visit/[id]
 * Actions: approve, reject, record_visit, complete
 */
export async function PATCH(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, assignedTo, rejectionReason, visitDate, discussionSummary } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
    }

    await ensureScheduleVisitTable();
    const conn = await getDbConnection();
    const username = payload.username;
    const role = payload.role;

    const [rows] = await conn.execute(
      `SELECT * FROM schedule_visit WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ success: false, error: "Visit not found" }, { status: 404 });
    }

    const visit = rows[0];

    if (action === "approve" || action === "reject") {
      const isManager =
        isPrivileged(role) ||
        (await isReportingManagerOf(username, visit.created_by));

      if (!isManager) {
        return NextResponse.json(
          { success: false, error: "Only reporting manager can approve/reject" },
          { status: 403 }
        );
      }

      if (visit.visit_status !== "pending") {
        return NextResponse.json(
          { success: false, error: "Visit is not pending approval" },
          { status: 400 }
        );
      }

      if (action === "approve") {
        if (!assignedTo) {
          return NextResponse.json(
            { success: false, error: "assigned_to is required for approval" },
            { status: 400 }
          );
        }
        await conn.execute(
          `UPDATE schedule_visit
           SET visit_status = 'approved', approved_by = ?, assigned_to = ?
           WHERE id = ?`,
          [username, assignedTo, id]
        );
      } else {
        await conn.execute(
          `UPDATE schedule_visit
           SET visit_status = 'rejected', approved_by = ?, rejection_reason = ?
           WHERE id = ?`,
          [username, rejectionReason || null, id]
        );
      }
    } else if (action === "record_visit") {
      const canRecord =
        isPrivileged(role) ||
        visit.assigned_to === username ||
        visit.created_by === username ||
        (await isReportingManagerOf(username, visit.created_by));

      if (!canRecord) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }

      if (visit.visit_status !== "approved") {
        return NextResponse.json(
          { success: false, error: "Visit must be approved before recording" },
          { status: 400 }
        );
      }

      await conn.execute(
        `UPDATE schedule_visit
         SET visit_status = 'visited', visited_by = ?, visit_date = ?, discussion_summary = ?
         WHERE id = ?`,
        [username, visitDate || new Date(), discussionSummary || null, id]
      );
    } else if (action === "complete") {
      const isManager =
        isPrivileged(role) ||
        (await isReportingManagerOf(username, visit.created_by));

      if (!isManager) {
        return NextResponse.json(
          { success: false, error: "Only reporting manager can complete" },
          { status: 403 }
        );
      }

      if (visit.visit_status !== "visited") {
        return NextResponse.json(
          { success: false, error: "Visit must be marked as visited first" },
          { status: 400 }
        );
      }

      await conn.execute(
        `UPDATE schedule_visit SET visit_status = 'completed' WHERE id = ?`,
        [id]
      );
    } else {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Visit ${action} successful` });
  } catch (error) {
    console.error("PATCH schedule-visit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update visit" },
      { status: 500 }
    );
  }
}
