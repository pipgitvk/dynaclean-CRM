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

export function isRemainDispatchRound(order) {
  return (
    orderHasDispatchedStock(order) &&
    orderRemainBookingBatchDone(order) &&
    orderHasPendingDispatchUnits(order) &&
    !orderIsFullyDispatched(order)
  );
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

/**
 * Dispatch form menu:
 * - First round: nothing shipped yet
 * - Remain round: remain booking done + still pending
 * Never show after partial/full ship without remain booking.
 */
export function canOpenDispatchForOrder(order) {
  if (!orderHasBookingId(order)) return false;
  if (orderIsFullyDispatched(order)) return false;

  // Real units already shipped → only after remain booking
  if (orderHasDispatchedStock(order)) {
    return (
      orderRemainBookingBatchDone(order) && orderHasPendingDispatchUnits(order)
    );
  }

  // Nothing shipped yet — first Dispatch
  return orderHasPendingDispatchUnits(order) || Number(order?.dispatch_status) === 0;
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
