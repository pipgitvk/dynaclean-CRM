/**
 * GET /api/meta-backfill/leads-report/assigned-by?from=YYYY-MM-DD&to=YYYY-MM-DD&by=username&formIds=xxx,yyy
 * When formIds is provided: Returns lead counts per employee for those specific form IDs
 * When formIds is not provided: Returns leads where customers.assigned_to = assigner (original behavior)
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
    const formIdsParam = searchParams.get("formIds");
    const formIds = formIdsParam ? formIdsParam.split(',') : null;

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

    // If formIds are provided, return employee-wise lead counts for those forms
    if (formIds && formIds.length > 0) {
      // Get lead counts per employee for the specific form IDs
      let query = `
        SELECT 
          CASE 
            WHEN c.assigned_to IS NULL OR c.assigned_to = '' OR c.assigned_to = 'Automatic' 
            THEN COALESCE(c.lead_source, c.sales_representative, 'Unassigned')
            ELSE c.assigned_to 
          END as employee,
          COUNT(*) as lead_count
        FROM customers c
        INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id
        WHERE DATE(c.date_created) BETWEEN ? AND ?
        AND ml.form_id IN (${formIds.map(() => '?').join(',')})
        GROUP BY employee
        ORDER BY lead_count DESC
      `;
      
      const [employeeCounts] = await conn.execute(query, [from, to, ...formIds]);
      
      // Get all active employees from lead_distribution
      const [activeEmployees] = await conn.execute(
        `SELECT username FROM lead_distribution WHERE is_active = 1 ORDER BY priority ASC`
      );
      
      // Filter to only show employees who are in lead_distribution
      const activeEmployeeSet = new Set(activeEmployees.map(e => e.username));
      const filteredCounts = employeeCounts.filter(e => activeEmployeeSet.has(e.employee));
      
      return NextResponse.json({
        success: true,
        from,
        to,
        assignedBy: assigner,
        mode: 'employee_counts',
        employeeCounts: filteredCounts,
      });
    }

    // Original behavior: return leads where assigned_to = assigner
    const [rows] = await conn.execute(
      `SELECT 
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
        c.sales_representative,
        ml.products_interest
       FROM customers c
       LEFT JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id
       WHERE DATE(c.date_created) BETWEEN ? AND ?
       AND c.assigned_to = ?
       AND c.assigned_to IS NOT NULL
       AND c.assigned_to != ''
       AND c.assigned_to != 'Automatic'
       ORDER BY c.date_created DESC`,
      [from, to, assigner]
    );

    return NextResponse.json({
      success: true,
      from,
      to,
      assignedBy: assigner,
      mode: 'leads_list',
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
