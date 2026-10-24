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
