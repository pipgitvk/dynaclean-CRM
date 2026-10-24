import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";

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

/** Payment-pending popover / reports: CSV rows + statement linked_payments_json. */
export function buildPaymentLinesForDisplay(order) {
  const csvLines = buildOrderPaymentRows(order).map((row) => ({
    ref: (row.id || "").trim() || null,
    date: (row.date || "").trim() || null,
    amount: Number(row.amount) || 0,
  }));

  const linked = parseOrderLinkedPayments(order);
  if (!linked.length) {
    return csvLines;
  }

  const fromLinked = linked
    .map((p) => ({
      ref: String(p.trans_id ?? "").trim() || null,
      date: p.date ? String(p.date).slice(0, 10) : null,
      amount: Number(p.amount) || 0,
    }))
    .filter((r) => r.amount > 0);

  if (!csvLines.length) {
    return fromLinked;
  }

  const linkedHasMeta = fromLinked.some((l) => l.date || l.ref);
  if (fromLinked.length === csvLines.length) {
    return csvLines.map((line, i) => ({
      amount: line.amount || fromLinked[i]?.amount || 0,
      date: line.date || fromLinked[i]?.date || null,
      ref: line.ref || fromLinked[i]?.ref || null,
    }));
  }

  if (linkedHasMeta && fromLinked.length >= csvLines.length) {
    return fromLinked;
  }

  return csvLines.map((line, i) => ({
    ...line,
    date: line.date || fromLinked[i]?.date || null,
    ref: line.ref || fromLinked[i]?.ref || null,
  }));
}

export function sumOrderPaymentAmounts(order) {
  return buildOrderPaymentRows(order)
    .map((r) => Number(r.amount))
    .filter((n) => !Number.isNaN(n))
    .reduce((sum, n) => sum + n, 0);
}

/** Order list Paid column: CSV + amount_received + linked_payments_json. */
export function getOrderPaidAmountForDisplay(order) {
  const fromCsv = sumOrderPaymentAmounts(order);
  const fromReceived = Number(order?.amount_received);
  const fromLinked = parseOrderLinkedPayments(order).reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0,
  );
  return Math.max(
    fromCsv,
    Number.isFinite(fromReceived) && fromReceived > 0 ? fromReceived : 0,
    fromLinked,
  );
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

/** Sum neworder.payment_amount whether single value or comma-separated. */
export function sumPaymentAmountCsv(value) {
  const parts = (value ?? "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return 0;
  return parts
    .map((p) => Number(p))
    .filter((n) => !Number.isNaN(n))
    .reduce((sum, n) => sum + n, 0);
}

function rowsFromPaymentCsvFields(payment_id, payment_date, payment_amount) {
  const amounts = splitCsv(payment_amount).filter(Boolean);
  if (!amounts.length) return [];

  const dates = splitCsv(payment_date);
  const ids = splitCsv(payment_id);
  return amounts.map((amount, i) => ({
    id: ids[i] || "",
    date: dates[i] || dates[0] || "",
    amount: String(amount).trim(),
  }));
}

/**
 * Keep existing order payments; append statement-linked lines (skip duplicate UTR/trans_id).
 */
export function mergeOrderPaymentWithLinkedCsv(order, linkedCsv) {
  const existing = buildOrderPaymentRows(order);
  if (!linkedCsv?.payment_amount) {
    return paymentFieldsFromRows(existing);
  }

  const linked = rowsFromPaymentCsvFields(
    linkedCsv.payment_id,
    linkedCsv.payment_date,
    linkedCsv.payment_amount,
  ).filter((r) => {
    const amt = Number(r.amount);
    return !Number.isNaN(amt) && amt !== 0;
  });

  if (!linked.length) {
    return paymentFieldsFromRows(existing);
  }

  const seenTransIds = new Set(
    existing
      .map((r) => (r.id || "").trim())
      .filter(Boolean),
  );

  const merged = [...existing];
  for (const row of linked) {
    const id = (row.id || "").trim();
    if (id) {
      if (seenTransIds.has(id)) continue;
      seenTransIds.add(id);
    }
    merged.push(row);
  }

  return paymentFieldsFromRows(merged);
}

/**
 * Accountant order report upload: payment CSV from form + invoice/statement link only.
 * Does not include booking advance already on neworder (order/new).
 */
export function resolveAccountUploadPaymentCsv(
  { payment_id, payment_date, payment_amount },
  linkedCsv,
) {
  const base = {
    payment_id: (payment_id ?? "").toString().trim(),
    payment_date: (payment_date ?? "").toString().trim(),
    payment_amount:
      payment_amount != null && payment_amount !== ""
        ? String(payment_amount).trim()
        : "",
    transaction_id: "",
  };

  if (linkedCsv?.payment_amount) {
    return mergeOrderPaymentWithLinkedCsv(base, linkedCsv);
  }

  return paymentFieldsFromRows(buildOrderPaymentRows(base));
}

/** Map statement-linked payment lines → neworder payment_id / payment_date / payment_amount CSV. */
export function linkedPaymentsToOrderPaymentCsv(payments) {
  const rows = (payments || []).map((p) => ({
    id: p.trans_id ? String(p.trans_id).trim() : "",
    date: p.date ? String(p.date).slice(0, 10) : "",
    amount:
      p.amount != null && p.amount !== "" && !Number.isNaN(Number(p.amount))
        ? String(Number(p.amount))
        : "",
  }));
  return paymentFieldsFromRows(rows.filter((r) => r.amount !== ""));
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
