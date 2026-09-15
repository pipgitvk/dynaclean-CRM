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

    const roleNorm = String(payload.role || payload.userRole || "")
      .toUpperCase()
      .trim();
    const allowed = ["SUPERADMIN", "ADMIN", "DIRECTOR", "SERVICE HEAD", "EA"];
    if (!allowed.includes(roleNorm)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const employee = searchParams.get("employee") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const [empRows] = await conn.execute(
      `SELECT username FROM rep_list WHERE userRole = 'SERVICE SUPPORT' AND status = 1 ORDER BY username ASC`,
    );
    const employees = empRows.map((r) => r.username).filter(Boolean);
    const empFilter = employee !== "all" ? [employee] : employees;

    if (empFilter.length === 0) {
      return NextResponse.json({ quotations: [], orders: [] });
    }

    const placeholders = empFilter.map(() => "?").join(",");

    const quoteConditions = [`qr.emp_name IN (${placeholders})`];
    const quoteParams = [...empFilter];
    if (startDate && endDate) {
      quoteConditions.push(`qr.created_at BETWEEN ? AND ?`);
      quoteParams.push(startDate, endDate);
    }

    const [quotations] = await conn.execute(
      `SELECT
         qr.quote_number,
         qr.quote_date,
         qr.created_at,
         qr.customer_id,
         qr.company_name,
         qr.emp_name,
         qr.grand_total
       FROM quotations_records qr
       WHERE ${quoteConditions.join(" AND ")}
       ORDER BY qr.created_at DESC`,
      quoteParams,
    );

    const orderConditions = [`no.created_by IN (${placeholders})`];
    const orderParams = [...empFilter];
    if (startDate && endDate) {
      orderConditions.push(`no.created_at BETWEEN ? AND ?`);
      orderParams.push(startDate, endDate);
    }

    const [orders] = await conn.execute(
      `SELECT
         no.order_id,
         no.client_name,
         no.contact,
         no.quote_number,
         no.created_by,
         no.created_at,
         no.totalamt,
         no.approval_status
       FROM neworder no
       WHERE ${orderConditions.join(" AND ")}
       ORDER BY no.created_at DESC`,
      orderParams,
    );

    return NextResponse.json({ quotations, orders });
  } catch (error) {
    console.error("service-support-quotes-orders:", error);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
