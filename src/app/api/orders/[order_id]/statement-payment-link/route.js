import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { appendOrderStatementPaymentLink } from "@/lib/appendOrderStatementPaymentLink";

const LINK_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "PRODUCTION ACCOUNTANT",
  "DIRECTOR",
  "HR HEAD",
  "SALES CUM BACKOFFICE",
];

export async function POST(req, { params }) {
  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = payload.role;
    if (!LINK_ROLES.includes(role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { order_id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const body = await req.json();
    const transIds = Array.isArray(body?.trans_ids) ? body.trans_ids : [];
    if (!transIds.length) {
      return NextResponse.json(
        { error: "trans_ids array is required" },
        { status: 400 },
      );
    }

    const pool = await getDbConnection();
    conn = await pool.getConnection();
    const result = await appendOrderStatementPaymentLink(conn, orderId, transIds);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("POST statement-payment-link:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to link payment" },
      { status: 500 },
    );
  } finally {
    conn?.release?.();
  }
}