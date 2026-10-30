import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureTrackingDataTable } from "@/lib/ensureTrackingDataTable";
import { shouldShowDelhiveryTrackingRow } from "@/lib/delhiveryLrValidation";
import { enrichTrackingDataRow } from "@/lib/delhiveryTrackingDataMeta";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/** GET — list rows from tracking_data */
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
    await ensureTrackingDataTable(conn);

    let rows;
    if (q) {
      const like = `%${q}%`;
      [rows] = await conn.query(
        `SELECT id, tracking_id, order_id, shipment_type, status, mwbn,
                scan_remark, location, pickup_date, estimated_delivery_date,
                delivered_date, fetch_error, fetched_at, payload
         FROM tracking_data
         WHERE tracking_id LIKE ? OR order_id LIKE ? OR status LIKE ?
         ORDER BY fetched_at DESC, id DESC
         LIMIT ?`,
        [like, like, like, limit],
      );
    } else {
      [rows] = await conn.query(
        `SELECT id, tracking_id, order_id, shipment_type, status, mwbn,
                scan_remark, location, pickup_date, estimated_delivery_date,
                delivered_date, fetch_error, fetched_at, payload
         FROM tracking_data
         ORDER BY fetched_at DESC, id DESC
         LIMIT ?`,
        [limit],
      );
    }

    const list = Array.isArray(rows) ? rows : [];
    const data = list
      .filter(shouldShowDelhiveryTrackingRow)
      .map(enrichTrackingDataRow);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("[delhivery/tracking-data GET]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load tracking data" },
      { status: 500 },
    );
  }
}
