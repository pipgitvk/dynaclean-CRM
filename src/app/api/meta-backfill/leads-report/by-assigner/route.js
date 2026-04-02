/**
 * GET /api/meta-backfill/leads-report/by-assigner?from=&to=&assigner=
 * Lists customers where normalized assigned_to label matches (same logic as leads-report byAssigner).
 */
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

const ASSIGNER_CASE = `CASE
  WHEN assigned_to IS NULL OR TRIM(assigned_to) = ''
    OR LOWER(TRIM(assigned_to)) = 'automatic'
  THEN 'Automatic'
  ELSE TRIM(assigned_to)
END`;

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
    const assigner = searchParams.get("assigner");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }
    if (assigner == null || String(assigner).trim() === "") {
      return NextResponse.json({ error: "Parameter 'assigner' is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT
        customer_id,
        first_name,
        last_name,
        phone,
        email,
        status,
        stage,
        lead_campaign,
        date_created,
        assigned_to,
        lead_source,
        sales_representative
       FROM customers
       WHERE DATE(date_created) BETWEEN ? AND ?
       AND (${ASSIGNER_CASE}) = ?
       ORDER BY date_created DESC`,
      [from, to, assigner]
    );

    return NextResponse.json({
      success: true,
      from,
      to,
      assigner,
      leads: rows,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report/by-assigner error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leads by assigner" },
      { status: 500 }
    );
  }
}
