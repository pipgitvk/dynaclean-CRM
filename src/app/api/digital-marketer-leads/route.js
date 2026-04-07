import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessDigitalMarketerLeadsModule } from "@/lib/digitalMarketerLeadsAuth";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = payload.role ?? payload.userRole;
    if (!canAccessDigitalMarketerLeadsModule(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await getDbConnection();

    // Note: `customers` schema in this app does not include created_by/city/state;
    // use columns that exist across INSERT paths (new-customers, bulk-upload, meta, etc.).
    const [leads] = await db.execute(
      `SELECT
        customer_id,
        first_name,
        last_name,
        email,
        phone,
        company,
        address,
        lead_source,
        assigned_to,
        sales_representative,
        lead_campaign,
        date_created,
        status,
        stage,
        products_interest,
        tags,
        notes,
        COALESCE(dm_reassign_exhausted, 0) AS dm_reassign_exhausted
      FROM customers
      WHERE date_created >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY date_created DESC`,
    );

    const [employeeRows] = await db.execute(
      `SELECT username
       FROM rep_list
       WHERE status = 1
         AND userRole IN ('SALES', 'ADMIN', 'BACK OFFICE', 'SALES HEAD', 'GEM PORTAL')
       ORDER BY username`,
    );

    const employees = employeeRows.map((r) => r.username);

    return NextResponse.json({
      success: true,
      leads,
      employees,
    });
  } catch (error) {
    console.error("digital-marketer-leads GET:", error);
    const msg = error?.message || "";
    if (/Unknown column ['\"]dm_reassign_exhausted['\"]/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Run DB migration: npm run migrate:dm-reassign-exhausted (adds dm_reassign_exhausted on customers)",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load leads" },
      { status: 500 },
    );
  }
}
