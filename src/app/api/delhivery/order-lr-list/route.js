import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { shouldShowDelhiveryTrackingRow } from "@/lib/delhiveryLrValidation";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    const limitRaw = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const conn = await getDbConnection();

    let rows;
    if (q) {
      const like = `%${q}%`;
      [rows] = await conn.query(
        `SELECT order_id, lr_number, booking_url, source, batch_sequence_no, type, created_at
         FROM tracking_id
         WHERE order_id LIKE ? OR lr_number LIKE ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [like, like, limit],
      );
    } else {
      [rows] = await conn.query(
        `SELECT order_id, lr_number, booking_url, source, batch_sequence_no, type, created_at
         FROM tracking_id
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [limit],
      );
    }

    const list = Array.isArray(rows) ? rows : [];
    const data = list.filter(shouldShowDelhiveryTrackingRow);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[delhivery/order-lr-list]", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to load Delhivery LRs",
        data: [],
      },
      { status: 500 },
    );
  }
}
