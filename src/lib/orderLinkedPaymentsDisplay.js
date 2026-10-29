function sumBookingPaymentCsv(raw) {
  if (raw == null || String(raw).trim() === "") return 0;
  return String(raw)
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);
}

function bookingTransId(order) {
  const fromPaymentId = String(order?.payment_id || "")
    .split(",")[0]
    .trim();
  if (fromPaymentId) return fromPaymentId;
  return String(order?.transaction_id || "").trim();
}

export function parseInvoiceLinkedTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch (_) {
    /* ignore */
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Bank statement / invoice payment-link rows only (not booking UTR). */
export function isStatementLinkedOrderPayment(payment) {
  const sid = payment?.statement_id;
  return (
    sid != null && String(sid).trim() !== "" && String(sid).trim() !== "0"
  );
}

export function orderHasInvoiceNumber(order) {
  return Boolean(
    String(order?.invoice_number || order?.active_invoice_number || "").trim(),
  );
}

/**
 * True only when invoice.linked_trans_ids has payment links (Link Payment).
 * Booking / order statement_id alone does not count.
 */
export function orderInvoiceHasPaymentLink(order) {
  if (!orderHasInvoiceNumber(order)) return false;
  return parseInvoiceLinkedTransIds(order?.invoice_linked_trans_ids).length > 0;
}

/**
 * Hover / linked-payment cell: only rows whose trans_id is on the invoice link.
 */
export function getOrderPaymentsLinkedToInvoice(order) {
  const linkedIds = parseInvoiceLinkedTransIds(order?.invoice_linked_trans_ids);
  if (!linkedIds.length) return [];

  const idSet = new Set(linkedIds.map((id) => id.toLowerCase()));
  const fromOrder = parseOrderLinkedPayments(order).filter((p) => {
    const tid = String(p.trans_id || "").trim();
    return tid && idSet.has(tid.toLowerCase());
  });

  if (fromOrder.length) {
    const deduped = new Map();
    for (const p of fromOrder) {
      const tid = String(p.trans_id || "").trim();
      if (!tid) continue;
      const key = tid.toLowerCase();
      if (deduped.has(key)) continue;
      deduped.set(key, p);
    }
    return [...deduped.values()];
  }

  // Invoice has linked trans_ids but order JSON missing rows — still show those IDs
  return linkedIds.map((trans_id) => ({
    trans_id,
    date: null,
    amount: null,
    statement_id: null,
  }));
}

/**
 * Payments to show on order list / balance / hover.
 * Only after invoice Link Payment — booking advance never shown alone.
 */
export function getOrderPaymentsForDisplay(order) {
  if (!orderInvoiceHasPaymentLink(order)) return [];
  return getOrderPaymentsLinkedToInvoice(order);
}

export function sumStatementLinkedOrderPayments(order) {
  return getOrderPaymentsForDisplay(order).reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0,
  );
}

export function parseOrderLinkedPayments(order) {
  if (Array.isArray(order?.linked_payments)) return order.linked_payments;
  const raw = order?.linked_payments_json;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (_) {
      /* ignore */
    }
  }
  const received = Number(order.amount_received);
  if (Number.isFinite(received) && received > 0) {
    return [
      {
        trans_id: bookingTransId(order),
        date: order.payment_received_date || null,
        amount: received,
      },
    ];
  }

  const amountParts = String(order?.payment_amount ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (amountParts.length > 1) {
    const ids = String(order?.payment_id ?? "")
      .split(",")
      .map((s) => s.trim());
    const txn = bookingTransId(order);
    const dates = String(order?.payment_date ?? "")
      .split(",")
      .map((s) => s.trim());
    return amountParts
      .map((part, i) => {
        const amount = Number(part);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
          trans_id: ids[i] || (i === 0 ? txn : "") || "",
          date: dates[i] || dates[0] || null,
          amount,
          statement_id: null,
        };
      })
      .filter(Boolean);
  }

  const bookingPaid = sumBookingPaymentCsv(order?.payment_amount);
  if (bookingPaid > 0) {
    const pDate = order?.payment_date
      ? String(order.payment_date).split(",")[0].trim().slice(0, 10)
      : null;
    return [
      {
        trans_id: bookingTransId(order),
        date: pDate,
        amount: bookingPaid,
      },
    ];
  }

  return [];
}
