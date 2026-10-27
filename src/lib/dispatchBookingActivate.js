import {
  activateDispatchRowsForBookingItems,
  fetchOrderBookingLineOptions,
  fetchBookingBatchesForOrder,
} from "@/lib/orderBookingBatches";
import { sqlQuoteTrimEqColumn } from "@/lib/sqlQuoteMatch";

function normCode(code) {
  return String(code ?? "").trim();
}

async function getQuoteNumber(conn, orderId) {
  const [orderRows] = await conn.execute(
    `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  return orderRows?.[0]?.quote_number || null;
}

/** Shipped units per item_code (stock_deducted or serial). */
async function shippedQtyByCodeForQuote(conn, quoteNumber) {
  const [rows] = await conn.execute(
    `SELECT TRIM(item_code) AS item_code,
            SUM(
              CASE
                WHEN COALESCE(stock_deducted, 0) = 1 THEN 1
                WHEN serial_no IS NOT NULL AND TRIM(serial_no) <> '' THEN 1
                ELSE 0
              END
            ) AS shipped
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
     GROUP BY TRIM(item_code)`,
    [quoteNumber],
  );
  const map = new Map();
  for (const row of rows || []) {
    const code = normCode(row.item_code);
    if (!code) continue;
    map.set(code, (map.get(code) || 0) + (Number(row.shipped) || 0));
  }
  return map;
}

/** Booking batch lines minus already shipped — no dispatch-allocation fallback. */
function batchItemsStillToShip(batchItems, shippedByCode) {
  const out = [];
  for (const it of batchItems || []) {
    const code = normCode(it.item_code);
    if (!code) continue;
    const booked = Math.max(1, Number(it.quantity) || 1);
    const shipped = shippedByCode.get(code) || 0;
    const pending = Math.max(0, booked - shipped);
    if (pending <= 0) continue;
    out.push({
      item_code: code,
      item_name: String(it.item_name || "").trim(),
      quantity: pending,
    });
  }
  return out;
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function activateDispatchForItemList(conn, orderId, batchItems) {
  const quoteNumber = await getQuoteNumber(conn, orderId);
  if (!quoteNumber) {
    return { activated: false, reason: "Order not found" };
  }

  const shippedByCode = await shippedQtyByCodeForQuote(conn, quoteNumber);
  const items = batchItemsStillToShip(batchItems, shippedByCode);

  if (!items.length) {
    return {
      activated: false,
      reason: "No products left to dispatch for this booking batch",
    };
  }

  await conn.execute(
    `UPDATE dispatch
     SET dispatch_active = 0, updated_at = NOW()
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(stock_deducted, 0) = 0`,
    [quoteNumber],
  );

  await activateDispatchRowsForBookingItems(conn, quoteNumber, items);

  const [activeCount] = await conn.execute(
    `SELECT COUNT(*) AS c FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(stock_deducted, 0) = 0
       AND COALESCE(dispatch_active, 1) = 1`,
    [quoteNumber],
  );

  const count = Number(activeCount?.[0]?.c ?? 0);
  return {
    activated: count > 0,
    active_rows: count,
    reason:
      count > 0
        ? null
        : "Could not activate dispatch rows for booking items",
  };
}

/** Booking batch 1 products only (first Dispatch). */
export async function activateFirstDispatchBatch(conn, orderId) {
  const batches = await fetchBookingBatchesForOrder(conn, orderId);
  const batch1 =
    batches.find((b) => Number(b.sequence_no) === 1) || batches[0];
  const items = batch1?.items || [];
  return activateDispatchForItemList(conn, orderId, items);
}

/** Booking batch 2+ products (Dispatch Remain). */
export async function activateRemainDispatchBatch(conn, orderId) {
  const batches = await fetchBookingBatchesForOrder(conn, orderId);
  const remainBatches = batches.filter((b) => Number(b.sequence_no) >= 2);
  const remainBatch = remainBatches[remainBatches.length - 1];
  const items = remainBatch?.items || [];

  if (!items.length) {
    return {
      activated: false,
      reason: "Doosri booking (Remaining) save karein, phir Dispatch (Remain).",
    };
  }

  return activateDispatchForItemList(conn, orderId, items);
}
