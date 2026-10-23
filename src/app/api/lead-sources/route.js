import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

function distinctCustomerLeadSourcesSql(column, leadType) {
  return `
    SELECT DISTINCT
      TRIM(c.${column}) AS username,
      TRIM(c.${column}) AS name,
      r.status AS status,
      '${leadType}' AS leadType
    FROM customers c
    LEFT JOIN rep_list r
      ON r.username COLLATE utf8mb4_unicode_ci = TRIM(c.${column}) COLLATE utf8mb4_unicode_ci
    WHERE c.${column} IS NOT NULL
      AND TRIM(c.${column}) <> ''
  `;
}

// GET - Lead source options from values stored on customers (bulk reassign filters / assign)
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = String(searchParams.get("type") || "sales").toLowerCase();
    const connection = await getDbConnection();
    let employees = [];

    if (type === "all") {
      const [rows] = await connection.execute(
        `${distinctCustomerLeadSourcesSql("lead_source", "sales")}
         UNION ALL
         ${distinctCustomerLeadSourcesSql("service_lead_source", "service")}
         UNION ALL
         ${distinctCustomerLeadSourcesSql("gem_lead_source", "gem")}
         ORDER BY leadType ASC, username ASC`,
      );
      employees = rows;
    } else if (type === "service") {
      const [rows] = await connection.execute(
        `${distinctCustomerLeadSourcesSql("service_lead_source", "service")}
         ORDER BY username ASC`,
      );
      employees = rows;
    } else if (type === "gem") {
      const [rows] = await connection.execute(
        `${distinctCustomerLeadSourcesSql("gem_lead_source", "gem")}
         ORDER BY username ASC`,
      );
      employees = rows;
    } else {
      const [rows] = await connection.execute(
        `${distinctCustomerLeadSourcesSql("lead_source", "sales")}
         ORDER BY username ASC`,
      );
      employees = rows;
    }

    return NextResponse.json({ success: true, employees, type });
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead sources" },
      { status: 500 },
    );
  }
}
