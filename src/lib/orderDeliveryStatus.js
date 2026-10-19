/** neworder.delivery_status: 0 = none, 2 = partial (batch delivered), 1 = fully delivered */

export const DELIVERY_STATUS_PARTIAL = 2;
export const DELIVERY_STATUS_FULL = 1;

export function isOrderFullyDelivered(order) {
  return Number(order?.delivery_status) === DELIVERY_STATUS_FULL;
}

export function isOrderPartialDelivery(order) {
  return Number(order?.delivery_status) === DELIVERY_STATUS_PARTIAL;
}

/** Has at least one delivery proof / date saved (partial or full). */
export function orderHasDeliveryRecord(order) {
  if (isOrderFullyDelivered(order) || isOrderPartialDelivery(order)) return true;
  const on = order?.delivered_on;
  return on != null && String(on).trim() !== "" && String(on) !== "0";
}

/** After 1st delivery save (partial) — show View + Update Delivery in menu. */
export function shouldShowSplitDeliveryMenus(order) {
  return orderHasDeliveryRecord(order) && !isOrderFullyDelivered(order);
}

/**
 * After saving delivery: full delivered only when entire order is dispatched
 * and no quotation units remain pending dispatch.
 */
export async function resolveDeliveryStatusAfterUpdate(conn, orderId, dispatchStatus) {
  const { fetchOrderDispatchLineOptions } = await import(
    "@/lib/dispatchPartialSelection"
  );
  const { lines } = await fetchOrderDispatchLineOptions(conn, orderId);
  const pendingDispatch = (lines || []).reduce(
    (s, l) => s + (Number(l.pending_qty) || 0),
    0,
  );
  const fullyDispatched =
    Number(dispatchStatus) === 1 && pendingDispatch === 0;
  return fullyDispatched ? DELIVERY_STATUS_FULL : DELIVERY_STATUS_PARTIAL;
}
