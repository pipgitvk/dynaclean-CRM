import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

/**
 * Latest follow-up per customer for anyone this user "owns":
 * lead_source, sales_representative, or assigned_to (same as customers list / CRM).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");
  if (!leadSource) {
    return NextResponse.json({ error: "leadSource required", leads: [] }, { status: 400 });
  }

  try {
    const connection = await getDbConnection();

    const sqlQuery = `
      SELECT *
      FROM (
        SELECT
          cf.*,
          c.status,
          c.stage,
          c.first_name,
          c.phone,
          c.products_interest,
          ROW_NUMBER() OVER (PARTITION BY cf.customer_id ORDER BY cf.time_stamp DESC) AS rn
        FROM customers_followup cf
        INNER JOIN customers c ON cf.customer_id = c.customer_id
        WHERE (c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)
          AND c.status != 'DENIED'
      ) AS T
      WHERE T.rn = 1
      ORDER BY T.next_followup_date ASC
    `;
    const queryParams = [leadSource, leadSource, leadSource];

    const [rows] = await connection.execute(sqlQuery, queryParams);

    return NextResponse.json({
      leads: rows,
    });
  } catch (error) {
    console.error("An error occurred during upcoming-leads API call:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads", leads: [] },
      { status: 500 }
    );
  }
}
