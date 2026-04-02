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
    const [byEmployee] = await conn.execute(
      `SELECT 
        CASE 
          WHEN assigned_to IS NULL OR assigned_to = '' OR assigned_to = 'Automatic' 
          THEN COALESCE(lead_source, sales_representative, 'Unassigned')
          ELSE assigned_to 
        END as employee,
        COUNT(*) as lead_count
       FROM customers
       WHERE DATE(date_created) BETWEEN ? AND ?
       GROUP BY employee`,
      [from, to]
    );

    // Build map: employee -> count
    const countMap = Object.fromEntries(
      byEmployee.map((r) => [r.employee, Number(r.lead_count)])
    );

    // Combine: all reps from lead_distribution + any others from customers (e.g. Unassigned)
    const repSet = new Set(allReps.map((r) => r.username));
    byEmployee.forEach((r) => repSet.add(r.employee));

    const byEmployeeFull = [...repSet]
      .map((emp) => ({
        employee: emp,
        leadCount: countMap[emp] ?? 0,
      }))
      .sort((a, b) => b.leadCount - a.leadCount);

    // Total leads in date range
    const [totalResult] = await conn.execute(
      `SELECT COUNT(*) as total FROM customers WHERE DATE(date_created) BETWEEN ? AND ?`,
      [from, to]
    );

    const total = totalResult[0]?.total ?? 0;

    // Raw customers.assigned_to: Automatic vs manual assigner name (same semantics as CRM column)
    const [byAssignerRows] = await conn.execute(
      `SELECT assigner_label, COUNT(*) AS lead_count
       FROM (
         SELECT
           CASE
             WHEN assigned_to IS NULL OR TRIM(assigned_to) = ''
               OR LOWER(TRIM(assigned_to)) = 'automatic'
             THEN 'Automatic'
             ELSE TRIM(assigned_to)
           END AS assigner_label
         FROM customers
         WHERE DATE(date_created) BETWEEN ? AND ?
       ) t
       GROUP BY assigner_label
       ORDER BY
         CASE WHEN assigner_label = 'Automatic' THEN 0 ELSE 1 END,
         lead_count DESC,
         assigner_label ASC`,
      [from, to]
    );

    const byAssigner = byAssignerRows.map((r) => ({
      assigner: r.assigner_label,
      leadCount: Number(r.lead_count),
    }));

    // Campaign/source × assigner (lead_campaign bucket × assigned_to label)
    const [byCampaignAssignerRows] = await conn.execute(
      `SELECT campaign_bucket, assigner_label, COUNT(*) AS lead_count
       FROM (
         SELECT
           CASE
             WHEN assigned_to IS NULL OR TRIM(assigned_to) = ''
               OR LOWER(TRIM(assigned_to)) = 'automatic'
             THEN 'Automatic'
             ELSE TRIM(assigned_to)
           END AS assigner_label,
           CASE
             WHEN lead_campaign IS NULL OR TRIM(lead_campaign) = '' THEN 'other'
             WHEN LOWER(REPLACE(REPLACE(TRIM(lead_campaign), ' ', '_'), '-', '_'))
               IN ('social_media', 'socialmedia') THEN 'social_media'
             WHEN LOWER(REPLACE(REPLACE(TRIM(lead_campaign), ' ', '_'), '-', '_'))
               IN ('google', 'google_ads', 'googleads') THEN 'google'
             WHEN LOWER(REPLACE(REPLACE(TRIM(lead_campaign), ' ', '_'), '-', '_'))
               IN ('indiamart', 'india_mart', 'india-mart') THEN 'indiamart'
             ELSE 'other'
           END AS campaign_bucket
         FROM customers
         WHERE DATE(date_created) BETWEEN ? AND ?
       ) x
       GROUP BY campaign_bucket, assigner_label
       ORDER BY campaign_bucket ASC, assigner_label ASC`,
      [from, to]
    );

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
