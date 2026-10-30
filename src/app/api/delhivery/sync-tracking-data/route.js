import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureTrackingIdTable } from "@/lib/orderTrackingIdPersist";
import { ensureTrackingDataTable } from "@/lib/ensureTrackingDataTable";
import {
  defaultDelhiveryTrackDelayMs,
  fetchDelhiveryB2bTrackWithRetry,
} from "@/lib/delhiveryB2bTrackFetch";
import {
  isDelhiveryB2bLrNumber,
  isDelhiveryInvalidLrnFetchError,
} from "@/lib/delhiveryLrValidation";
import { pickDelhiveryTrackingDates } from "@/lib/delhiveryTrackingDataMeta";

export const maxDuration = 120;

function pickMetaFromPayload(data) {
  if (!data || typeof data !== "object") {
    return {
      status: null,
      mwbn: null,
      scan_remark: null,
      location: null,
      pickup_date: null,
      estimated_delivery_date: null,
      delivered_date: null,
    };
  }
  const dates = pickDelhiveryTrackingDates(data);
  return {
    status: data.status != null ? String(data.status).slice(0, 128) : null,
    mwbn: data.mwbn != null ? String(data.mwbn).slice(0, 64) : null,
    scan_remark:
      data.scan_remark != null ? String(data.scan_remark).slice(0, 512) : null,
    location: data.location != null ? String(data.location).slice(0, 255) : null,
    pickup_date: dates.pickup_date,
    estimated_delivery_date: dates.estimated_delivery_date,
    delivered_date: dates.delivered_date,
  };
}

async function upsertTrackingRow(conn, row, fetchResult) {
  const lr = String(row.lr_number).trim();
  const orderId = row.order_id != null ? String(row.order_id).trim() : null;
  const shipmentType = row.type != null ? String(row.type).trim() : null;

  if (fetchResult.ok && fetchResult.data) {
    const meta = pickMetaFromPayload(fetchResult.data);
    await conn.execute(
      `INSERT INTO tracking_data
        (tracking_id, order_id, shipment_type, status, mwbn, scan_remark, location, pickup_date, estimated_delivery_date, delivered_date, payload, fetch_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         order_id = VALUES(order_id),
         shipment_type = VALUES(shipment_type),
         status = COALESCE(VALUES(status), status),
         mwbn = COALESCE(VALUES(mwbn), mwbn),
         scan_remark = COALESCE(VALUES(scan_remark), scan_remark),
         location = COALESCE(VALUES(location), location),
         pickup_date = COALESCE(VALUES(pickup_date), pickup_date),
         estimated_delivery_date = COALESCE(VALUES(estimated_delivery_date), estimated_delivery_date),
         delivered_date = COALESCE(VALUES(delivered_date), delivered_date),
         payload = VALUES(payload),
         fetch_error = NULL,
         fetched_at = CURRENT_TIMESTAMP`,
      [
        lr,
        orderId,
        shipmentType,
        meta.status,
        meta.mwbn,
        meta.scan_remark,
        meta.location,
        meta.pickup_date,
        meta.estimated_delivery_date,
        meta.delivered_date,
        JSON.stringify(fetchResult.data),
      ],
    );
    return { lr, ok: true };
  }

  const errMsg = String(fetchResult.error || "Fetch failed").slice(0, 2000);

  const [existingRows] = await conn.execute(
    `SELECT status, fetch_error FROM tracking_data WHERE tracking_id = ? LIMIT 1`,
    [lr],
  );
  const existing = existingRows?.[0];
  const hasGoodSnapshot =
    existing &&
    existing.fetch_error == null &&
    existing.status != null &&
    String(existing.status).trim() !== "";

  /** Never overwrite a successful snapshot when Delhivery returns a transient/error response. */
  if (hasGoodSnapshot) {
    return { lr, ok: false, error: errMsg, preserved: true };
  }

  await conn.execute(
    `INSERT INTO tracking_data
      (tracking_id, order_id, shipment_type, status, mwbn, scan_remark, location, payload, fetch_error)
     VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       order_id = VALUES(order_id),
       shipment_type = VALUES(shipment_type),
       fetch_error = VALUES(fetch_error),
       fetched_at = CURRENT_TIMESTAMP`,
    [
      lr,
      orderId,
      shipmentType,
      JSON.stringify(fetchResult.data || { error: errMsg }),
      errMsg,
    ],
  );
  return { lr, ok: false, error: errMsg };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadEligibleJobs(conn, { force, retryErrorsOnly, freshHours }) {
  const [rows] = await conn.query(
    `SELECT t.order_id, t.lr_number, t.type, t.created_at,
            d.fetch_error AS cached_error,
            d.fetched_at AS cached_fetched_at
     FROM tracking_id t
     LEFT JOIN tracking_data d
       ON d.tracking_id COLLATE utf8mb4_general_ci = t.lr_number COLLATE utf8mb4_general_ci
     WHERE t.lr_number IS NOT NULL AND TRIM(t.lr_number) <> ''
     ORDER BY t.created_at DESC, t.id DESC`,
  );

  const seen = new Set();
  const jobs = [];
  for (const row of rows || []) {
    const lr = String(row.lr_number || "").trim();
    if (!lr || seen.has(lr)) continue;
    if (!isDelhiveryB2bLrNumber(lr)) continue;
    if (isDelhiveryInvalidLrnFetchError(row.cached_error)) continue;
    seen.add(lr);

    if (retryErrorsOnly) {
      if (!row.cached_error) continue;
    } else if (!force) {
      const hasOk =
        row.cached_error == null &&
        row.cached_fetched_at != null &&
        new Date(row.cached_fetched_at).getTime() >
          Date.now() - freshHours * 3600 * 1000;
      if (hasOk) continue;
    }

    jobs.push(row);
  }
  return jobs;
}

/**
 * POST — batch sync Delhivery track → tracking_data (avoids API rate limits).
 * Body: { offset?, batchSize?, force?, retryErrorsOnly?, freshHours? }
 */
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const batchSize = Math.min(
      40,
      Math.max(1, Number(body.batchSize) || 15),
    );
    const offset = Math.max(0, Number(body.offset) || 0);
    const force = Boolean(body.force);
    const retryErrorsOnly = Boolean(body.retryErrorsOnly);
    const freshHours = Math.max(
      1,
      Math.min(168, Number(body.freshHours) || 6),
    );
    const delayMs = defaultDelhiveryTrackDelayMs();

    const conn = await getDbConnection();
    await ensureTrackingIdTable(conn);
    await ensureTrackingDataTable(conn);

    const allJobs = await loadEligibleJobs(conn, {
      force,
      retryErrorsOnly,
      freshHours,
    });
    const batch = allJobs.slice(offset, offset + batchSize);
    const nextOffset = offset + batch.length;
    const hasMore = nextOffset < allJobs.length;

    let saved = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const fetchResult = await fetchDelhiveryB2bTrackWithRetry(row.lr_number);
      const upsert = await upsertTrackingRow(conn, row, fetchResult);
      results.push(upsert);
      if (upsert.ok) saved += 1;
      else failed += 1;
      if (i < batch.length - 1) {
        await sleep(delayMs);
      }
    }

    const [countRows] = await conn.query(
      `SELECT COUNT(DISTINCT lr_number) AS c FROM tracking_id
       WHERE lr_number IS NOT NULL AND TRIM(lr_number) <> ''`,
    );
    const uniqueLrs = Number(countRows?.[0]?.c) || 0;
    const skippedRecent =
      !force && !retryErrorsOnly
        ? Math.max(0, uniqueLrs - allJobs.length)
        : 0;

    return NextResponse.json({
      success: true,
      batchSize: batch.length,
      offset,
      nextOffset,
      hasMore,
      totalEligible: allJobs.length,
      uniqueLrsInSystem: uniqueLrs,
      saved,
      failed,
      skippedRecent,
      delayMs,
      results,
    });
  } catch (err) {
    console.error("[delhivery/sync-tracking-data]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Sync failed" },
      { status: 500 },
    );
  }
}
