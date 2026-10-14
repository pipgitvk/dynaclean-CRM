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
  if (!amounts.length) return [];

  const dates = splitCsv(order?.payment_date);
  const idsFromPaymentId = splitCsv(order?.payment_id);
  const transactionId = (order?.transaction_id ?? "").toString().trim();

  let rows = amounts.map((amount, i) => {
    let id = idsFromPaymentId[i] || "";
    if (!id && i === 0 && transactionId) id = transactionId;
    const date =
      dates[i] ||
      dates[0] ||
      (i === 0 ? (order?.payment_date ?? "") : "") ||
      "";
    return { id, date, amount };
  });

  rows = collapseDuplicateAdvanceEntry(rows);
  return rows.filter((r) => {
    const amt = Number(r.amount);
    return !Number.isNaN(amt) && amt !== 0;
  });
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

function paymentFieldsFromRows(rows) {
  if (!rows.length) {
    return { payment_id: null, payment_date: null, payment_amount: null };
  }
  return {
    payment_id: rows.map((r) => (r.id || "").trim()).join(",") || null,
    payment_date: rows.map((r) => (r.date || "").trim()).join(",") || null,
    payment_amount: rows.map((r) => (r.amount || "").trim()).join(",") || null,
  };
}

/**
 * When recording payment via API: avoid appending duplicate advance from booking.
 */
export function resolveNextPaymentCsv(order, { paymentId, paymentDate, paymentAmount }) {
  const prevIdsRaw = (order.payment_id || "").toString().trim();
  const prevDatesRaw = (order.payment_date || "").toString().trim();
  const prevAmountsRaw = (order.payment_amount || "").toString().trim();

  const transactionId = (order.transaction_id ?? "").toString().trim();
  const hasMultipleAmounts = prevAmountsRaw.includes(",");

  const addingAmount =
    paymentAmount !== null && paymentAmount !== undefined && !Number.isNaN(Number(paymentAmount));

  const legacyAdvanceOnly =
    transactionId &&
    prevAmountsRaw &&
    !hasMultipleAmounts &&
    !prevIdsRaw;

  if (legacyAdvanceOnly && addingAmount) {
    const existingAmt = Number(prevAmountsRaw);
    const sameAmount = Number(paymentAmount) === existingAmt;
    const newId = (paymentId ?? "").toString().trim();
    const sameOrMissingId = !newId || newId === transactionId;

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

  // No new amount: only attach UTR to existing line(s) — never append extra date/amount CSV slots
  if (!addingAmount) {
    const rows = buildOrderPaymentRows(order);
    const newId = (paymentId ?? "").toString().trim();
    if (newId && rows.length === 1 && !(rows[0].id || "").trim()) {
      rows[0].id = newId;
      if (paymentDate) rows[0].date = paymentDate;
      return { ...paymentFieldsFromRows(rows), skipAppend: true };
    }
    return {
      nextIds: prevIdsRaw || null,
      nextDates: prevDatesRaw || null,
      nextAmounts: prevAmountsRaw || null,
      skipAppend: true,
    };
  }

  let prevIds = prevIdsRaw;
  if (!prevIds && transactionId && prevAmountsRaw && !hasMultipleAmounts) {
    prevIds = transactionId;
  }

  const nextIds = paymentId
    ? prevIds ? `${prevIds},${paymentId}` : String(paymentId)
    : prevIds || null;
  const nextDates = paymentDate
    ? prevDatesRaw ? `${prevDatesRaw},${paymentDate}` : paymentDate
    : prevDatesRaw || null;
  const nextAmounts = prevAmountsRaw
    ? `${prevAmountsRaw},${paymentAmount}`
    : String(paymentAmount);

  return { nextIds, nextDates, nextAmounts, skipAppend: false };
}

/** Fix misaligned CSV (extra dates, duplicate advance). Returns null if unchanged. */
export function normalizeStoredPaymentFields(order) {
  const rows = buildOrderPaymentRows(order);
  const next = paymentFieldsFromRows(rows);

  const same =
    (order.payment_id || "").toString().trim() === (next.payment_id || "").trim() &&
    (order.payment_date || "").toString().trim() === (next.payment_date || "").trim() &&
    (order.payment_amount || "").toString().trim() === (next.payment_amount || "").trim();

  return same ? null : next;
}
