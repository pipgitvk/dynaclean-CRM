/**
 * GET /api/meta-backfill/leads-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: leads count per employee (receiver), total, byAssigner (raw assigned_to:
 * Automatic vs manual name), byCampaignAndAssigner (lead_campaign bucket × assigner).
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
    const formIdsParam = searchParams.get("formIds");
    const formIds = formIdsParam ? formIdsParam.split(',') : null;

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // All reps from lead_distribution (who receive leads)
    const [allReps] = await conn.execute(
      `SELECT username FROM lead_distribution WHERE is_active = 1 ORDER BY priority ASC`
    );

    // Leads count per employee in date range
    // When assigned_to = 'Automatic', use lead_source/sales_representative (actual rep)
    let byEmployeeQuery = `
      SELECT 
        CASE 
          WHEN c.assigned_to IS NULL OR c.assigned_to = '' OR c.assigned_to = 'Automatic' 
          THEN COALESCE(c.lead_source, c.sales_representative, 'Unassigned')
          ELSE c.assigned_to 
        END as employee,
        COUNT(*) as lead_count
       FROM customers c`;
    
    let byEmployeeParams = [from, to];

    // Join with meta_leads if formIds filter is present
    if (formIds && formIds.length > 0) {
      byEmployeeQuery += ` INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id`;
    }

    byEmployeeQuery += ` WHERE DATE(c.date_created) BETWEEN ? AND ?`;

    // Add formIds filter if present
    if (formIds && formIds.length > 0) {
      byEmployeeQuery += ` AND ml.form_id IN (${formIds.map(() => '?').join(',')})`;
      byEmployeeParams.push(...formIds);
    }

    byEmployeeQuery += ` GROUP BY employee`;

    const [byEmployee] = await conn.execute(byEmployeeQuery, byEmployeeParams);

    // Build map: employee -> count
    const countMap = Object.fromEntries(
      byEmployee.map((r) => [r.employee, Number(r.lead_count)])
    );

    // When formIds are filtered, only show employees who actually received leads from those forms
    // Otherwise, show all reps from lead_distribution + any others from customers (e.g. Unassigned)
    let repSet;
    if (formIds && formIds.length > 0) {
      // Only show employees who are in the byEmployee results
      repSet = new Set(byEmployee.map((r) => r.employee));
    } else {
      // Combine: all reps from lead_distribution + any others from customers (e.g. Unassigned)
      repSet = new Set(allReps.map((r) => r.username));
      byEmployee.forEach((r) => repSet.add(r.employee));
    }

    const byEmployeeFull = [...repSet]
      .map((emp) => ({
        employee: emp,
        leadCount: countMap[emp] ?? 0,
      }))
      .sort((a, b) => b.leadCount - a.leadCount);

    // Total leads in date range
    let totalQuery = `SELECT COUNT(*) as total FROM customers c`;
    let totalParams = [from, to];

    if (formIds && formIds.length > 0) {
      totalQuery += ` INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id`;
      totalQuery += ` WHERE DATE(c.date_created) BETWEEN ? AND ? AND ml.form_id IN (${formIds.map(() => '?').join(',')})`;
      totalParams.push(...formIds);
    } else {
      totalQuery += ` WHERE DATE(c.date_created) BETWEEN ? AND ?`;
    }

    const [totalResult] = await conn.execute(totalQuery, totalParams);
    const total = totalResult[0]?.total ?? 0;

    // Raw customers.assigned_to: Automatic vs manual assigner name (same semantics as CRM column)
    let byAssignerQuery = `
      SELECT assigner_label, COUNT(*) AS lead_count
       FROM (
         SELECT
           CASE
             WHEN c.assigned_to IS NULL OR TRIM(c.assigned_to) = ''
               OR LOWER(TRIM(c.assigned_to)) = 'automatic'
             THEN 'Automatic'
             ELSE TRIM(c.assigned_to)
           END AS assigner_label
         FROM customers c`;
    
    let byAssignerParams = [from, to];

    if (formIds && formIds.length > 0) {
      byAssignerQuery += ` INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id`;
    }

    byAssignerQuery += ` WHERE DATE(c.date_created) BETWEEN ? AND ?`;

    if (formIds && formIds.length > 0) {
      byAssignerQuery += ` AND ml.form_id IN (${formIds.map(() => '?').join(',')})`;
      byAssignerParams.push(...formIds);
    }

    byAssignerQuery += ` ) t
       GROUP BY assigner_label
       ORDER BY
         CASE WHEN assigner_label = 'Automatic' THEN 0 ELSE 1 END,
         lead_count DESC,
         assigner_label ASC`;

    const [byAssignerRows] = await conn.execute(byAssignerQuery, byAssignerParams);

    const byAssigner = byAssignerRows.map((r) => ({
      assigner: r.assigner_label,
      leadCount: Number(r.lead_count),
    }));

    // Campaign/source × assigner (lead_campaign bucket × assigned_to label)
    let byCampaignAssignerQuery = `
      SELECT campaign_bucket, assigner_label, COUNT(*) AS lead_count
       FROM (
         SELECT
           CASE
             WHEN c.assigned_to IS NULL OR TRIM(c.assigned_to) = ''
               OR LOWER(TRIM(c.assigned_to)) = 'automatic'
             THEN 'Automatic'
             ELSE TRIM(c.assigned_to)
           END AS assigner_label,
           CASE
             WHEN c.lead_campaign IS NULL OR TRIM(c.lead_campaign) = '' THEN 'other'
             WHEN LOWER(REPLACE(REPLACE(TRIM(c.lead_campaign), ' ', '_'), '-', '_'))
               IN ('social_media', 'socialmedia') THEN 'social_media'
             WHEN LOWER(REPLACE(REPLACE(TRIM(c.lead_campaign), ' ', '_'), '-', '_'))
               IN ('google', 'google_ads', 'googleads') THEN 'google'
             WHEN LOWER(REPLACE(REPLACE(TRIM(c.lead_campaign), ' ', '_'), '-', '_'))
               IN ('indiamart', 'india_mart', 'india-mart') THEN 'indiamart'
             ELSE 'other'
           END AS campaign_bucket
         FROM customers c`;
    
    let byCampaignAssignerParams = [from, to];

    if (formIds && formIds.length > 0) {
      byCampaignAssignerQuery += ` INNER JOIN meta_leads ml ON c.customer_id = ml.crm_customer_id`;
    }

    byCampaignAssignerQuery += ` WHERE DATE(c.date_created) BETWEEN ? AND ?`;

    if (formIds && formIds.length > 0) {
      byCampaignAssignerQuery += ` AND ml.form_id IN (${formIds.map(() => '?').join(',')})`;
      byCampaignAssignerParams.push(...formIds);
    }

    byCampaignAssignerQuery += ` ) x
       GROUP BY campaign_bucket, assigner_label
       ORDER BY campaign_bucket ASC, assigner_label ASC`;

    const [byCampaignAssignerRows] = await conn.execute(byCampaignAssignerQuery, byCampaignAssignerParams);

    const byCampaignAndAssigner = byCampaignAssignerRows.map((r) => ({
      campaign: r.campaign_bucket,
      assigner: r.assigner_label,
      leadCount: Number(r.lead_count),
    }));

    return NextResponse.json({
      success: true,
      from,
      to,
      total,
      byEmployee: byEmployeeFull,
      byAssigner,
      byCampaignAndAssigner,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leads report" },
      { status: 500 }
    );
  }
}
