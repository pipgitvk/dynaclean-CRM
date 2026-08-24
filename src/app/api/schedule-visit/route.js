import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import { ensureScheduleVisitTable } from "@/lib/ensureScheduleVisitTable";
import { getReportees } from "@/lib/reportingManager";
import {
  buildScheduleVisitVisibilityWhere,
  isScheduleVisitSuperAdmin,
  userOwnsCustomer,
} from "@/lib/scheduleVisitScope";

/**
 * GET /api/schedule-visit
 * List schedule visits with optional filters.
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureScheduleVisitTable();
    const conn = await getDbConnection();
    const username = payload.username;
    const role = payload.role;
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "";
    const customerId = searchParams.get("customerId") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const search = searchParams.get("search") || "";

    const reportees = isScheduleVisitSuperAdmin(role)
      ? []
      : await getReportees(username);

    const visibility = buildScheduleVisitVisibilityWhere({
      role,
      username,
      reportees,
    });

    let where = "WHERE 1=1";
    const params = [...visibility.params];

    if (visibility.whereClause) {
      where += ` ${visibility.whereClause}`;
    }

    if (status) {
      where += " AND schedule_visit.visit_status = ?";
      params.push(status);
    }
    if (customerId) {
      where += " AND schedule_visit.customer_id = ?";
      params.push(customerId);
    }
    if (dateFrom) {
      where += " AND schedule_visit.scheduled_date >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      where += " AND schedule_visit.scheduled_date <= ?";
      params.push(dateTo + " 23:59:59");
    }
    if (search) {
      where +=
        " AND (schedule_visit.customer_name LIKE ? OR schedule_visit.contact LIKE ? OR schedule_visit.purpose LIKE ? OR schedule_visit.visit_address LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [rows] = await conn.execute(
      `SELECT schedule_visit.id, schedule_visit.customer_id, schedule_visit.customer_name,
              schedule_visit.contact, schedule_visit.visit_address, schedule_visit.purpose,
              schedule_visit.scheduled_date, schedule_visit.visit_status, schedule_visit.visited_by,
              schedule_visit.visit_date, schedule_visit.discussion_summary,
              schedule_visit.created_by, schedule_visit.approved_by, schedule_visit.assigned_to,
              schedule_visit.rejection_reason, schedule_visit.created_at, schedule_visit.updated_at
       FROM schedule_visit
       ${visibility.join}
       ${where}
       ORDER BY schedule_visit.scheduled_date DESC, schedule_visit.id DESC`,
      params
    );

    const [employees] = await conn.execute(
      `SELECT username FROM rep_list WHERE status = 1 ORDER BY username`
    );

    return NextResponse.json({
      success: true,
      data: rows,
      employees: employees.map((e) => e.username),
      username,
      role,
      reportees,
    });
  } catch (error) {
    console.error("GET schedule-visit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch visits" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedule-visit
 * Create a new schedule visit (goes to reporting manager for approval).
 */
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      customerId,
      customerName,
      contact,
      visitAddress,
      purpose,
      scheduledDate,
    } = body;

    if (!customerId || !customerName || !visitAddress || !purpose || !scheduledDate) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    await ensureScheduleVisitTable();
    const conn = await getDbConnection();

    const ownsCustomer = await userOwnsCustomer(conn, customerId, payload);
    if (!ownsCustomer) {
      return NextResponse.json(
        { success: false, error: "You can only schedule visits for your own customers" },
        { status: 403 }
      );
    }

    const [result] = await conn.execute(
      `INSERT INTO schedule_visit
        (customer_id, customer_name, contact, visit_address, purpose, scheduled_date,
         visit_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        customerId,
        customerName,
        contact || null,
        visitAddress,
        purpose,
        scheduledDate,
        payload.username,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
      message: "Visit schedule submitted for approval",
    });
  } catch (error) {
    console.error("POST schedule-visit error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create visit schedule" },
      { status: 500 }
    );
  }
}
