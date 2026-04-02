/**
 * GET /api/meta-backfill/leads-report/assigned-by?from=YYYY-MM-DD&to=YYYY-MM-DD&by=username
 * Leads where customers.assigned_to = assigner (TL/bulk assign & manual flows — not Meta "Automatic").
 */
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = payload.role?.toUpperCase() || "";
    if (!["ADMIN", "SUPERADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const by = searchParams.get("by");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    const assigner = by != null ? String(by).trim() : "";
    if (!assigner) {
      return NextResponse.json({ error: "Parameter 'by' (assigner username) is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT 
        customer_id,
        first_name,
        last_name,
        phone,
        email,
        status,
        stage,
        lead_campaign,
        date_created,
        assigned_to,
        lead_source,
        sales_representative
       FROM customers
       WHERE DATE(date_created) BETWEEN ? AND ?
       AND assigned_to = ?
       AND assigned_to IS NOT NULL
       AND assigned_to != ''
       AND assigned_to != 'Automatic'
       ORDER BY date_created DESC`,
      [from, to, assigner]
    );

    return NextResponse.json({
      success: true,
      from,
      to,
      assignedBy: assigner,
      leads: rows,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report/assigned-by error:", err);
    return NextResponse.json(
      { error: "Failed to fetch assigned-by leads" },
      { status: 500 }
    );
  }
}
