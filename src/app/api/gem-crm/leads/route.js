import { getDbConnection } from "@/lib/db";
import { buildGemCustomerScopeWhere } from "@/lib/dataScope";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const connection = await getDbConnection();

    const gemScope = buildGemCustomerScopeWhere({ username, tableAlias: "c" });

    // Count new status leads (same scope as GEM customers page)
    const [newStatusRows] = await connection.execute(
      `SELECT COUNT(*) as count
      FROM customers c
      WHERE ${gemScope.sql}
        AND TRIM(LOWER(c.status)) = 'new'`,
      gemScope.params
    );

    const newStatusCount = newStatusRows[0]?.count || 0;

    // Fetch leads data
    const [leads] = await connection.execute(
      `SELECT cf.*, c.status, c.stage, c.company, c.customer_id, c.first_name, c.phone, c.products_interest
      FROM customers c
      LEFT JOIN customers_followup cf 
          ON cf.customer_id = c.customer_id
          AND cf.time_stamp = (
              SELECT MAX(time_stamp) 
              FROM customers_followup 
              WHERE customer_id = c.customer_id
          )
      WHERE ${gemScope.sql}
        AND c.status != 'DENIED'
      ORDER BY cf.next_followup_date ASC`,
      gemScope.params
    );

    return NextResponse.json({
      newLeadsCount: newStatusCount,
      leads: leads
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
