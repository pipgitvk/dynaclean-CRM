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

function parseInvoiceLinkedTransIds(raw) {
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
 * True only when invoice has real payment links (Link Payment / statements).
 * Booking amounts on the order alone do not count.
 */
export function orderInvoiceHasPaymentLink(order) {
  if (!orderHasInvoiceNumber(order)) return false;
  if (parseInvoiceLinkedTransIds(order?.invoice_linked_trans_ids).length > 0) {
    return true;
  }
  return parseOrderLinkedPayments(order).some(isStatementLinkedOrderPayment);
}

/**
 * Payments to show on order list / balance.
 * Invoice without payment link → hide booking/received amounts.
 * Invoice with payment link → statement-linked lines only.
 * No invoice yet → booking advances as before.
 */
export function getOrderPaymentsForDisplay(order) {
  const all = parseOrderLinkedPayments(order);
  if (!orderHasInvoiceNumber(order)) return all;
  if (!orderInvoiceHasPaymentLink(order)) return [];
  return all.filter(isStatementLinkedOrderPayment);
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
