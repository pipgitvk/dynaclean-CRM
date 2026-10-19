import { fetchOrderDispatchLineOptions } from "@/lib/dispatchPartialSelection";
import { activateDispatchRowsForBookingItems } from "@/lib/orderBookingBatches";
import { sqlQuoteTrimEqColumn } from "@/lib/sqlQuoteMatch";

function parseItemsJson(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function activateRemainDispatchBatch(conn, orderId) {
  const [orderRows] = await conn.execute(
    `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  const quoteNumber = orderRows?.[0]?.quote_number;
  if (!quoteNumber) {
    return { activated: false, reason: "Order not found" };
  }

  const [batchRows] = await conn.execute(
    `SELECT sequence_no, items_json
     FROM order_booking_batches
     WHERE order_id = ? AND sequence_no >= 2
     ORDER BY sequence_no DESC
     LIMIT 1`,
    [orderId],
  );

  if (!batchRows?.length) {
    return {
      activated: false,
      reason:
        "Create Booking (Remaining) first before Dispatch (Remain)",
    };
  }

  let items = parseItemsJson(batchRows[0].items_json);

  if (!items.length) {
    const { lines } = await fetchOrderDispatchLineOptions(conn, orderId);
    items = (lines || [])
      .filter((l) => l.pending_qty > 0)
      .map((l) => ({
        item_code: l.item_code,
        item_name: l.item_name,
        quantity: l.pending_qty,
      }));
  }

  if (!items.length) {
    return { activated: false, reason: "No remaining products to dispatch" };
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
    reason: count > 0 ? null : "Could not activate dispatch rows for remaining items",
  };
}
