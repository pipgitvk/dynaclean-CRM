/**
 * GET /api/meta-backfill/leads-report/details?from=YYYY-MM-DD&to=YYYY-MM-DD&employee=...&formIds=xxx,yyy
 * Lists customers (leads) counted for that employee in leads-report, same CASE as aggregate.
 * When formIds is provided, filters to only show leads from those specific form IDs.
 */
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

const EMPLOYEE_CASE = `CASE 
  WHEN c.assigned_to IS NULL OR c.assigned_to = '' OR c.assigned_to = 'Automatic' 
  THEN COALESCE(c.lead_source, c.sales_representative, 'Unassigned')
  ELSE c.assigned_to 
END`;

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
    const employee = searchParams.get("employee");
    const formIdsParam = searchParams.get("formIds");
    const formIds = formIdsParam ? formIdsParam.split(',') : null;

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    if (employee == null || String(employee).trim() === "") {
      return NextResponse.json({ error: "Parameter 'employee' is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    let query = `
      SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        c.status,
        c.stage,
        c.lead_campaign,
        c.date_created,
        c.assigned_to,
        c.lead_source,
        c.sales_representative
       FROM customers c`;
    
    let params = [from, to, employee];

    // Join with meta_leads if formIds filter is present
    if (formIds && formIds.length > 0) {
      query += ` INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id`;
    }

    query += ` WHERE DATE(c.date_created) BETWEEN ? AND ?
       AND (${EMPLOYEE_CASE}) = ?`;

    // Add formIds filter if present
    if (formIds && formIds.length > 0) {
      query += ` AND ml.form_id IN (${formIds.map(() => '?').join(',')})`;
      params.push(...formIds);
    }

    query += ` ORDER BY c.date_created DESC`;

    const [rows] = await conn.execute(query, params);

    return NextResponse.json({
      success: true,
      from,
      to,
      employee,
      leads: rows,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report/details error:", err);
    return NextResponse.json(
      { error: "Failed to fetch lead details" },
      { status: 500 }
    );
  }
}
