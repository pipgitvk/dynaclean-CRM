/** neworder.is_returned values used in return / credit-note flow. */
export const IS_RETURNED = {
  NONE: 0,
  FULLY_RETURNED: 1,
  PARTIALLY_RETURNED: 2,
  RETURN_INITIATED: 3,
  PARTIAL_RETURN_INITIATED: 4,
};

export function isReturnInitiatedStatus(isReturned) {
  const n = Number(isReturned || 0);
  return n === IS_RETURNED.RETURN_INITIATED || n === IS_RETURNED.PARTIAL_RETURN_INITIATED;
}

/** Block starting another return from order menu. */
export function blocksNewReturnInitiate(isReturned) {
  const n = Number(isReturned || 0);
  return [1, 2, 3, 4].includes(n);
}

export function initiatedStatusForReturnType(returnType) {
  return returnType === "full"
    ? IS_RETURNED.RETURN_INITIATED
    : IS_RETURNED.PARTIAL_RETURN_INITIATED;
}

export function returnInitiatedStatusLabel(order) {
  const n = Number(order?.is_returned || 0);
  if (n === IS_RETURNED.PARTIAL_RETURN_INITIATED) {
    if (Number(order.return_booking_done) === 1) {
      return "Return Booking Done";
    }
    return "Partial Return Initiated";
  }
  if (n === IS_RETURNED.RETURN_INITIATED) {
    if (Number(order.return_booking_done) === 1) {
      return "Return Booking Done";
    }
    return "Return Initiated";
  }
  return null;
}

/**
 * @param {Array<{id: number, quantity?: number}>} allQuotationLines
 * @param {Array<{id: number, qty?: number}>} returnItems
 */
export function classifyReturnType(allQuotationLines, returnItems) {
  const returnMap = new Map(
    (returnItems || []).map((r) => [
      r.id,
      Math.max(1, Math.floor(Number(r.qty) || 1)),
    ]),
  );
  if (!allQuotationLines?.length || returnMap.size === 0) return "partial";
  if (returnMap.size !== allQuotationLines.length) return "partial";
  for (const line of allQuotationLines) {
    const orderQty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    const rq = returnMap.get(line.id);
    if (rq == null || rq < orderQty) return "partial";
  }
  return "full";
}
