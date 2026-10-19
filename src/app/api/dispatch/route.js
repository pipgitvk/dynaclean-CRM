import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureAddedAccessoryDispatchRows } from "@/lib/seedAddedAccessoryDispatch";
import { isSalesRole } from "@/lib/isSalesRole";
import { ensureDispatchActiveColumn } from "@/lib/dispatchPartialSelection";

const DISPATCH_VIEW_ROLES = [
  "WAREHOUSE INCHARGE",
  "SUPERADMIN",
  "TEAM LEADER",
  "ADMIN",
  "DIRECTOR",
  "ACCOUNTANT",
  "BACK OFFICE",
  "GEM PORTAL",
];

function canViewDispatchData(role) {
  const roleUpper = String(role || "").toUpperCase();
  return (
    DISPATCH_VIEW_ROLES.includes(roleUpper) ||
    isSalesRole(role) ||
    roleUpper === "GEM" ||
    roleUpper.includes("GEM")
  );
}

export async function GET(req) {
  try {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = tokenPayload.role;
    if (!canViewDispatchData(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const quoteNumberParam = searchParams.get("quote_number");

    const conn = await getDbConnection();

    let quoteNumber = quoteNumberParam;
    if (!quoteNumber && orderId) {
      const [rows] = await conn.execute(
        `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
        [orderId]
      );
      if (rows && rows[0]) {
        quoteNumber = rows[0].quote_number;
      }
    }

    if (!quoteNumber) {
      return NextResponse.json({ success: true, data: [] });
    }

    if (orderId) {
      try {
        await ensureDispatchActiveColumn(conn);
        await ensureAddedAccessoryDispatchRows(conn, quoteNumber);
      } catch (seedErr) {
        console.error("Dispatch GET ensure added accessories:", seedErr);
      }
    }

    const scope = (searchParams.get("scope") || "").trim().toLowerCase();
    let whereExtra = `(
           COALESCE(stock_deducted, 0) = 1
           OR COALESCE(dispatch_active, 1) = 1
         )`;
    if (scope === "active") {
      whereExtra = `COALESCE(stock_deducted, 0) = 0 AND COALESCE(dispatch_active, 1) = 1`;
    } else if (scope === "dispatched") {
      whereExtra = `(
           COALESCE(stock_deducted, 0) = 1
           OR (serial_no IS NOT NULL AND TRIM(serial_no) <> '')
         )`;
    }

    const [dispatchRows] = await conn.execute(
      `SELECT id, quote_number, item_name, item_code, serial_no, remarks, photos, godown, accessories_checklist, created_at, updated_at,
              COALESCE(stock_deducted, 0) AS stock_deducted,
              COALESCE(dispatch_active, 1) AS dispatch_active
       FROM dispatch
       WHERE TRIM(CONVERT(quote_number USING utf8mb4)) = TRIM(?)
         AND ${whereExtra}
       ORDER BY id ASC`,
      [quoteNumber]
    );

    return NextResponse.json({ success: true, data: dispatchRows });
  } catch (e) {
    console.error("Dispatch GET error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


