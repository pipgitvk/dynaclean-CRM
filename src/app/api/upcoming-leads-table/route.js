import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");
  const userRole   = (searchParams.get("userRole") || "").toUpperCase();
  const startDate  = searchParams.get("startDate") || "";
  const endDate    = searchParams.get("endDate") || "";
  const isServiceSupport = userRole === "SERVICE SUPPORT";

  try {
    const connection = await getDbConnection();

    let sqlQuery;
    let queryParams;

    if (isServiceSupport) {
      // SERVICE SUPPORT: filter by service_lead_source, use service_next_followup for dates
      if (startDate && endDate) {
        sqlQuery = `
          SELECT
            cf.*,
            c.status,
            c.stage,
            c.first_name,
            c.phone,
            c.company,
            c.products_interest
          FROM customers_followup cf
          INNER JOIN customers c ON cf.customer_id = c.customer_id
          WHERE c.service_lead_source = ?
            AND c.status NOT IN ('Invalid', 'Disqualified')
            AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
            AND cf.service_next_followup IS NOT NULL
            AND DATE(cf.service_next_followup) >= ? 
            AND DATE(cf.service_next_followup) <= ?
          ORDER BY cf.service_next_followup ASC, cf.time_stamp DESC
        `;
        queryParams = [leadSource, startDate, endDate];
      } else {
        // No date filter - show all upcoming followups (saare followups)
        sqlQuery = `
          SELECT
            cf.*,
            c.status,
            c.stage,
            c.first_name,
            c.phone,
            c.company,
            c.products_interest
          FROM customers_followup cf
          INNER JOIN customers c ON cf.customer_id = c.customer_id
          WHERE c.service_lead_source = ?
            AND c.status NOT IN ('Invalid', 'Disqualified')
            AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
            AND cf.service_next_followup IS NOT NULL
          ORDER BY cf.service_next_followup ASC, cf.time_stamp DESC
        `;
        queryParams = [leadSource];
      }
    } else {
      // All other roles: filter by lead_source, use next_followup_date
      if (startDate && endDate) {
        sqlQuery = `
          SELECT
            cf.*,
            c.status,
            c.stage,
            c.first_name,
            c.phone,
            c.company,
            c.products_interest
          FROM customers_followup cf
          INNER JOIN customers c ON cf.customer_id = c.customer_id
          WHERE c.lead_source = ?
            AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
            AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
            AND cf.next_followup_date IS NOT NULL
            AND DATE(cf.next_followup_date) >= ? 
            AND DATE(cf.next_followup_date) <= ?
          ORDER BY cf.next_followup_date ASC, cf.time_stamp DESC
        `;
        queryParams = [leadSource, startDate, endDate];
      } else {
        // No date filter - show all upcoming followups (saare followups)
        sqlQuery = `
          SELECT
            cf.*,
            c.status,
            c.stage,
            c.first_name,
            c.phone,
            c.company,
            c.products_interest
          FROM customers_followup cf
          INNER JOIN customers c ON cf.customer_id = c.customer_id
          WHERE c.lead_source = ?
            AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
            AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
            AND cf.next_followup_date IS NOT NULL
          ORDER BY cf.next_followup_date ASC, cf.time_stamp DESC
        `;
        queryParams = [leadSource];
      }
    }

    const [rows] = await connection.execute(sqlQuery, queryParams);

    return NextResponse.json({ leads: rows });
  } catch (error) {
    console.error("Upcoming leads table API error:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
