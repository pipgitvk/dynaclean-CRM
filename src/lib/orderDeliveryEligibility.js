import { sqlQuoteTrimEqColumns } from "@/lib/sqlQuoteMatch";
import { isOrderFullyDelivered } from "@/lib/orderDeliveryStatus";

function orderHasBookingId(order) {
  return (
    order?.booking_id !== undefined &&
    order?.booking_id !== null &&
    String(order.booking_id).trim() !== "" &&
    String(order.booking_id) !== "0"
  );
}

/** Second booking batch saved (remaining products). */
export function orderRemainBookingBatchDone(order) {
  const batches = order?.booking_batches || [];
  if (batches.length >= 2) return true;
  return batches.some((b) => Number(b.sequence_no) >= 2);
}

/**
 * Order list SQL fragment: count dispatch rows with stock already deducted.
 * Use in SELECT with alias `no` for neworder.
 */
export const ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT = `(
  SELECT COUNT(*)
  FROM dispatch d
  WHERE ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
    AND (
      COALESCE(d.stock_deducted, 0) = 1
      OR (d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> '')
    )
) AS dispatched_stock_count`;

/** Quotation units not yet dispatched (stock_deducted / serial). */
export const ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT = `(
  SELECT COALESCE(SUM(
    GREATEST(
      0,
      GREATEST(1, COALESCE(qi.quantity, 1)) - COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN COALESCE(d2.stock_deducted, 0) = 1 THEN 1
              WHEN d2.serial_no IS NOT NULL AND TRIM(d2.serial_no) <> '' THEN 1
              ELSE 0
            END
          )
          FROM dispatch d2
          WHERE ${sqlQuoteTrimEqColumns("d2.quote_number", "no.quote_number")}
            AND TRIM(CONVERT(d2.item_code USING utf8mb4)) = TRIM(CONVERT(qi.item_code USING utf8mb4))
        ),
        0
      )
    )
  ), 0)
  FROM quotation_items qi
  WHERE ${sqlQuoteTrimEqColumns("qi.quote_number", "no.quote_number")}
) AS pending_dispatch_units`;

function sqlCountValue(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True only when real dispatch rows are shipped (count > 0) — never status-only. */
export function orderHasDispatchedStock(order) {
  return orderShippedUnits(order) > 0;
}

export function orderShippedUnits(order) {
  return Math.max(
    sqlCountValue(order?.dispatch_shipped_units),
    sqlCountValue(order?.dispatched_stock_count),
  );
}

/** Align list UI with quotation↔dispatch matching (not only DB dispatch_status). */
export function reconcileDispatchStatusForOrder(order, pendingUnits) {
  const pending = Number(
    pendingUnits ?? order?.pending_dispatch_units ?? 0,
  );
  const shipped = Math.max(
    sqlCountValue(order?.dispatch_shipped_units),
    sqlCountValue(order?.dispatched_stock_count),
  );
  if (shipped > 0 && pending <= 0) return 1;
  if (shipped > 0 && pending > 0) return 2;
  // Stale Partial/Dispatch Done with zero shipped rows → reset
  if (shipped <= 0) return 0;
  return Number(order?.dispatch_status) || 0;
}

export function orderIsFullyDispatched(order) {
  return (
    orderShippedUnits(order) > 0 && orderPendingDispatchUnits(order) <= 0
  );
}

export function canViewDispatchPanelForOrder(order) {
  if (!orderHasBookingId(order)) return false;
  return orderHasDispatchedStock(order);
}

/** Pehli booking complete + batch 1 ke products dispatch pending (doosri booking optional). */
export function canOpenFirstDispatchForOrder(order) {
  if (!orderHasBookingId(order)) return false;
  if (orderIsFullyDispatched(order)) return false;
  const batch1 = Number(order.batch1_dispatch_pending);
  if (Number.isFinite(batch1)) return batch1 > 0;
  if (orderHasDispatchedStock(order)) return false;
  return (
    orderHasPendingDispatchUnits(order) || Number(order?.dispatch_status) === 0
  );
}

/** Doosri booking (batch 2+) complete + us batch ke products dispatch pending. */
export function canOpenRemainDispatchForOrder(order) {
  if (!orderHasBookingId(order)) return false;
  if (orderIsFullyDispatched(order)) return false;
  if (canCreateRemainProductBooking(order)) return false;
  if (!orderRemainBookingBatchDone(order)) return false;
  const remain = Number(order.remain_batch_dispatch_pending);
  if (Number.isFinite(remain)) return remain > 0;
  return orderHasPendingDispatchUnits(order);
}

export function isRemainDispatchRound(order) {
  return canOpenRemainDispatchForOrder(order);
}

export function canOpenDispatchForOrder(order) {
  return (
    canOpenFirstDispatchForOrder(order) ||
    canOpenRemainDispatchForOrder(order)
  );
}

/** View / Update Delivery — after at least one unit shipped. */
export function canShowOrderDeliveryActions(order) {
  if (isOrderFullyDelivered(order)) return true;
  // Delivery only after at least one real shipped dispatch row
  return orderHasDispatchedStock(order);
}

export function dispatchStatusAllowsDeliveryUpdate(dispatchStatus, hasDispatchedStock) {
  const ds = Number(dispatchStatus);
  if (ds === 1) return true;
  if (ds === 2 && hasDispatchedStock) return true;
  if (hasDispatchedStock) return true;
  return false;
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function orderHasDispatchedStockForOrderId(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM dispatch d
     INNER JOIN neworder no ON ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
     WHERE no.order_id = ?
       AND (
         COALESCE(d.stock_deducted, 0) = 1
         OR (d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> '')
       )`,
    [orderId],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export function orderPendingDispatchUnits(order) {
  return sqlCountValue(order?.pending_dispatch_units);
}

export function orderHasOpenDispatchBatch(order) {
  return sqlCountValue(order?.open_dispatch_units) > 0;
}

export function orderHasPendingDispatchUnits(order) {
  return orderPendingDispatchUnits(order) > 0;
}

/**
 * Create Booking (Remaining): after some units shipped, remaining qty left,
 * and 2nd booking not yet saved. Open-batch flag must not block this.
 */
export function canCreateFollowUpBooking(order) {
  if (!orderHasBookingId(order)) return false;
  if (orderRemainBookingBatchDone(order)) return false;
  if (orderIsFullyDispatched(order)) return false;
  if (!orderHasDispatchedStock(order)) return false;
  if (!orderHasPendingDispatchUnits(order)) return false;
  return true;
}

/** Partial booking: first batch saved but quotation lines still unbooked (no dispatch required). */
export function canCreateRemainProductBooking(order) {
  if (!orderHasBookingId(order)) return false;
  if (Number(order.dispatch_status) === 1) return false;
  if (orderIsFullyDispatched(order)) return false;
  const pending = Number(order.pending_booking_units);
  if (Number.isFinite(pending)) return pending > 0;
  return false;
}

/** Show "Create Booking (Remaining)" — unbooked products or post-dispatch remain flow. */
export function canCreateAdditionalBooking(order) {
  return (
    canCreateRemainProductBooking(order) || canCreateFollowUpBooking(order)
  );
}
