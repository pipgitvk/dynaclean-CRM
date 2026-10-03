import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");
  const userRole   = (searchParams.get("userRole") || "").toUpperCase();
  const startDate  = searchParams.get("startDate") || "";
  const endDate    = searchParams.get("endDate") || "";
  const isServiceSupport = userRole === "SERVICE SUPPORT";
  const dateField = isServiceSupport ? "service_next_followup" : "next_followup_date";
  const sourceField = isServiceSupport ? "service_lead_source" : "lead_source";
  const excludedStatuses = isServiceSupport
    ? "('Invalid', 'Disqualified')"
    : "('DENIED', 'Invalid', 'Disqualified')";

  try {
    const connection = await getDbConnection();
    const params = [leadSource];

    let sql = `
      SELECT *
      FROM (
        SELECT
          cf.*,
          c.status, c.stage, c.first_name, c.company, c.phone, c.products_interest,
          ROW_NUMBER() OVER(PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
        FROM customers_followup cf
        INNER JOIN customers c ON cf.customer_id = c.customer_id
        WHERE c.${sourceField} = ?
          AND c.status NOT IN ${excludedStatuses}
          AND (c.stage IS NULL OR c.stage != 'Disqualified / Invalid Lead')
      ) AS T
      WHERE T.rn = 1
        AND T.${dateField} IS NOT NULL
    `;

    if (startDate && endDate) {
      sql += ` AND DATE(T.${dateField}) >= ? AND DATE(T.${dateField}) <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND DATE(T.${dateField}) >= ?`;
      params.push(startDate);
    } else if (endDate) {
      sql += ` AND DATE(T.${dateField}) <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY T.${dateField} ASC`;

    const [rows] = await connection.execute(sql, params);
    return NextResponse.json({ leads: rows });
  } catch (error) {
    console.error("Upcoming leads table API error:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
