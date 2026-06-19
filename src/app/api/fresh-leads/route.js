import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// Returns leads created within the last 7 days assigned to the given user
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leadSource = searchParams.get("leadSource");

  if (!leadSource) {
    return NextResponse.json({ error: "leadSource is required" }, { status: 400 });
  }

  try {
    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `
      SELECT
        c.customer_id,
        c.first_name,
        c.phone,
        c.company,
        c.products_interest,
        c.status,
        c.stage,
        c.date_created,
        TIMESTAMPDIFF(HOUR, c.date_created, NOW()) AS lead_age_hours,
        (
          SELECT cf.next_followup_date
          FROM customers_followup cf
          WHERE cf.customer_id = c.customer_id
          ORDER BY cf.time_stamp DESC
          LIMIT 1
        ) AS next_followup_date,
        (
          SELECT cf.notes
          FROM customers_followup cf
          WHERE cf.customer_id = c.customer_id
          ORDER BY cf.time_stamp DESC
          LIMIT 1
        ) AS notes
      FROM customers c
      WHERE
        (c.lead_source = ? OR c.assigned_to = ?)
        AND c.status != 'DENIED'
        AND c.status != 'Invalid'
        AND c.date_created >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY c.date_created DESC
      `,
      [leadSource, leadSource]
    );

    return NextResponse.json({ leads: rows });
  } catch (error) {
    console.error("fresh-leads API error:", error);
    return NextResponse.json({ error: "Failed to fetch fresh leads" }, { status: 500 });
  }
}
