/**
 * Order payments are stored as comma-separated CSV on neworder:
 * payment_id, payment_date, payment_amount.
 * Booking advance may only set transaction_id + payment_amount (payment_id empty).
 */

function splitCsv(value) {
  return (value ?? "")
    .toString()
    .split(",")
    .map((s) => s.trim());
}

export function buildOrderPaymentRows(order) {
  const amounts = splitCsv(order?.payment_amount).filter(Boolean);
  const dates = splitCsv(order?.payment_date);
  const idsFromPaymentId = splitCsv(order?.payment_id);

  const transactionId = (order?.transaction_id ?? "").toString().trim();
  const ids = [...idsFromPaymentId];

  // Legacy booking: amount saved without payment_id; UTR is in transaction_id
  if (amounts.length > 0 && ids.filter(Boolean).length === 0 && transactionId) {
    ids[0] = transactionId;
  }

  const len = Math.max(amounts.length, dates.length, ids.length, 0);
  let rows = Array.from({ length: len }, (_, i) => ({
    id: ids[i] || "",
    date: dates[i] || "",
    amount: amounts[i] || "",
  }));

  rows = collapseDuplicateAdvanceEntry(rows);
  return rows;
}

/** Same advance recorded at booking and again via Edit Payment (amount CSV doubled). */
function collapseDuplicateAdvanceEntry(rows) {
  if (rows.length !== 2) return rows;
  const amt0 = Number(rows[0].amount);
  const amt1 = Number(rows[1].amount);
  if (Number.isNaN(amt0) || amt0 !== amt1) return rows;

  const withId = rows.filter((r) => (r.id || "").trim());
  const withoutId = rows.filter((r) => !(r.id || "").trim());
  if (withId.length === 1 && withoutId.length === 1) {
    return [withId[0]];
  }
  return rows;
}

export function sumOrderPaymentAmounts(order) {
  return buildOrderPaymentRows(order)
    .map((r) => Number(r.amount))
    .filter((n) => !Number.isNaN(n))
    .reduce((sum, n) => sum + n, 0);
}

/**
 * When recording payment via API: avoid appending duplicate advance from booking.
 * Returns { nextIds, nextDates, nextAmounts, skipAppend } or null if normal append.
 */
export function resolveNextPaymentCsv(order, { paymentId, paymentDate, paymentAmount }) {
  const prevIdsRaw = (order.payment_id || "").toString().trim();
  const prevDatesRaw = (order.payment_date || "").toString().trim();
  const prevAmountsRaw = (order.payment_amount || "").toString().trim();

  const transactionId = (order.transaction_id ?? "").toString().trim();
  const hasMultipleAmounts = prevAmountsRaw.includes(",");

  const legacyAdvanceOnly =
    transactionId &&
    prevAmountsRaw &&
    !hasMultipleAmounts &&
    !prevIdsRaw;

  if (
    legacyAdvanceOnly &&
    paymentAmount !== null &&
    !Number.isNaN(paymentAmount)
  ) {
    const existingAmt = Number(prevAmountsRaw);
    const sameAmount = Number(paymentAmount) === existingAmt;
    const newId = (paymentId ?? "").toString().trim();
    const sameOrMissingId =
      !newId || newId === transactionId;

    if (sameAmount && sameOrMissingId) {
      const nextIds = newId || transactionId;
      const nextDates =
        paymentDate ||
        prevDatesRaw ||
        (order.payment_date ? String(order.payment_date).trim() : null);
      return {
        nextIds,
        nextDates: nextDates || null,
        nextAmounts: prevAmountsRaw,
        skipAppend: true,
      };
    }
  }

  let prevIds = prevIdsRaw;
  if (!prevIds && transactionId && prevAmountsRaw && !hasMultipleAmounts) {
    prevIds = transactionId;
  }

  const nextIds = paymentId
    ? prevIds ? `${prevIds},${paymentId}` : paymentId
    : prevIds || null;
  const nextDates = paymentDate
    ? prevDatesRaw ? `${prevDatesRaw},${paymentDate}` : paymentDate
    : prevDatesRaw || null;
  const nextAmounts =
    paymentAmount !== null && !Number.isNaN(paymentAmount)
      ? prevAmountsRaw
        ? `${prevAmountsRaw},${paymentAmount}`
        : String(paymentAmount)
      : prevAmountsRaw || null;

  return { nextIds, nextDates, nextAmounts, skipAppend: false };
}

/** Fix DB row when duplicate advance was stored (returns null if unchanged). */
export function normalizeStoredPaymentFields(order) {
  const rawAmounts = splitCsv(order?.payment_amount).filter(Boolean);
  const rows = buildOrderPaymentRows(order);
  if (rows.length >= rawAmounts.length) return null;

  const ids = rows.map((r) => (r.id || "").trim()).filter(Boolean);
  const dates = rows.map((r) => (r.date || "").trim()).filter(Boolean);
  const amounts = rows.map((r) => (r.amount || "").trim()).filter(Boolean);

  return {
    payment_id: ids.length ? ids.join(",") : null,
    payment_date: dates.length ? dates.join(",") : null,
    payment_amount: amounts.length ? amounts.join(",") : null,
  };
}
