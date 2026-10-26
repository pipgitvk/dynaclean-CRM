import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getPartyPaymentHistory } from "@/lib/partyPaymentHistory";

export async function GET(_req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const partyPaymentId = Number(id);
    if (!partyPaymentId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [pp] = await conn.execute(
      `SELECT id, name, customer_id, created_by FROM party_payments WHERE id = ? LIMIT 1`,
      [partyPaymentId],
    );
    if (!pp?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const history = await getPartyPaymentHistory(conn, partyPaymentId);
    return NextResponse.json({
      success: true,
      party_payment_id: partyPaymentId,
      name: pp[0].name,
      customer_id: pp[0].customer_id,
      created_by: pp[0].created_by,
      history,
    });
  } catch (err) {
    console.error("[party-payments/history] GET:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
