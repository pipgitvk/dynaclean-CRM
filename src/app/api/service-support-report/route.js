// app/api/service-support-report/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  const conn = await getDbConnection();

  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(payload.role || payload.userRole || "");
    const roleNorm = role.toUpperCase().trim();

    // Only SUPERADMIN, DIRECTOR, SERVICE HEAD can view this report
    const allowed = ["SUPERADMIN", "DIRECTOR", "SERVICE HEAD", "EA"];
    if (!allowed.includes(roleNorm)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const employee = searchParams.get("employee") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Fetch all SERVICE SUPPORT employees
    const [empRows] = await conn.execute(
      `SELECT username FROM rep_list WHERE userRole = 'SERVICE SUPPORT' AND status = 1 ORDER BY username ASC`
    );
    const employees = empRows.map((r) => r.username);

    // Build employee filter
    const empFilter = employee !== "all" ? [employee] : employees;

    // ─── customers_followup (service followups) ───────────────────────────────
    let cfConditions = [`cf.followed_by IN (${empFilter.map(() => "?").join(",")})`];
    let cfParams = [...empFilter];

    if (startDate && endDate) {
      cfConditions.push(`cf.followed_date BETWEEN ? AND ?`);
      cfParams.push(startDate, endDate);
    }

    const [cfRows] = await conn.execute(
      `SELECT
         cf.s_no,
         cf.customer_id,
         c.first_name AS customer_name,
         c.phone AS customer_phone,
         cf.followed_by,
         cf.followed_date,
         cf.comm_mode,
         cf.notes,
         cf.purpose,
         cf.service_next_followup
       FROM customers_followup cf
       LEFT JOIN customers c ON c.customer_id = cf.customer_id
       WHERE ${cfConditions.join(" AND ")}
         AND cf.followed_by IS NOT NULL
         AND cf.followed_by != ''
       ORDER BY cf.followed_date DESC`,
      cfParams
    );

    // ─── machines_followup ────────────────────────────────────────────────────
    let mfConditions = [`mf.added_by IN (${empFilter.map(() => "?").join(",")})`];
    let mfParams = [...empFilter];

    if (startDate && endDate) {
      mfConditions.push(`mf.followed_at BETWEEN ? AND ?`);
      mfParams.push(startDate, endDate);
    }

    const [mfRows] = await conn.execute(
      `SELECT
         mf.id,
         mf.serial_number,
         mf.product_model,
         mf.contact,
         mf.added_by,
         mf.followed_at,
         mf.next_followup_date,
         mf.notes
       FROM machines_followup mf
       WHERE ${mfConditions.join(" AND ")}
       ORDER BY mf.followed_at DESC`,
      mfParams
    );

    // Serialize dates
    const serializeDates = (rows) =>
      rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = v instanceof Date ? v.toISOString() : v;
        }
        return out;
      });

    return NextResponse.json({
      employees,
      customerFollowups: serializeDates(cfRows),
      machineFollowups: serializeDates(mfRows),
    });
  } catch (error) {
    console.error("service-support-report error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
