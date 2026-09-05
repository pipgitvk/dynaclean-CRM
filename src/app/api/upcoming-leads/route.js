import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");
  const userRole   = (searchParams.get("userRole") || "").toUpperCase();
  const isServiceSupport = userRole === "SERVICE SUPPORT";

  function getISTTime() {
    const now = new Date();
    const istOffset = 5.5 * 60;
    return new Date(now.getTime() + istOffset * 60 * 1000);
  }

  const istNow = getISTTime();
  const startDate = searchParams.get("startDate") || "";
  const endDate   = searchParams.get("endDate") || "";

  try {
    const connection = await getDbConnection();

    let sqlQuery;
    let queryParams;

    if (isServiceSupport) {
      // SERVICE SUPPORT: filter by service_lead_source, use service_next_followup for dates
      if (startDate && endDate) {
        // With date filter
        sqlQuery = `
          SELECT *
          FROM (
            SELECT
              cf.*,
              c.status,
              c.stage,
              c.first_name,
              c.phone,
              c.company,
              c.products_interest,
              ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
            FROM customers_followup cf
            INNER JOIN customers c ON cf.customer_id = c.customer_id
            WHERE c.service_lead_source = ?
              AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
              AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
          ) AS T
          WHERE T.rn = 1
            AND T.service_next_followup IS NOT NULL
            AND DATE(T.service_next_followup) >= ?
            AND DATE(T.service_next_followup) <= ?
        `;
        queryParams = [leadSource, startDate, endDate];
      } else {
        // Without date filter - show all upcoming followups
        sqlQuery = `
          SELECT *
          FROM (
            SELECT
              cf.*,
              c.status,
              c.stage,
              c.first_name,
              c.phone,
              c.company,
              c.products_interest,
              ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
            FROM customers_followup cf
            INNER JOIN customers c ON cf.customer_id = c.customer_id
            WHERE c.service_lead_source = ?
              AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
              AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
          ) AS T
          WHERE T.rn = 1
            AND T.service_next_followup IS NOT NULL
        `;
        queryParams = [leadSource];
      }
    } else {
      // All other roles: filter by lead_source, use next_followup_date
      if (startDate && endDate) {
        sqlQuery = `
          SELECT *
          FROM (
            SELECT
              cf.*,
              c.status,
              c.stage,
              c.first_name,
              c.phone,
              c.company,
              c.products_interest,
              ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
            FROM customers_followup cf
            INNER JOIN customers c ON cf.customer_id = c.customer_id
            WHERE c.lead_source = ?
              AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
              AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
          ) AS T
          WHERE T.rn = 1
            AND T.next_followup_date IS NOT NULL
            AND DATE(T.next_followup_date) >= ?
            AND DATE(T.next_followup_date) <= ?
        `;
        queryParams = [leadSource, startDate, endDate];
      } else {
        sqlQuery = `
          SELECT *
          FROM (
            SELECT
              cf.*,
              c.status,
              c.stage,
              c.first_name,
              c.phone,
              c.company,
              c.products_interest,
              ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
            FROM customers_followup cf
            INNER JOIN customers c ON cf.customer_id = c.customer_id
            WHERE c.lead_source = ?
              AND c.status NOT IN ('DENIED', 'Invalid', 'Disqualified')
              AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
          ) AS T
          WHERE T.rn = 1
            AND T.next_followup_date IS NOT NULL
        `;
        queryParams = [leadSource];
      }
    }

    const [rows] = await connection.execute(sqlQuery, queryParams);

    return NextResponse.json({ leads: rows });
  } catch (error) {
    console.error("Upcoming leads API error:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
