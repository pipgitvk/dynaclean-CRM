export function parseOrderLinkedPayments(order) {
  if (Array.isArray(order?.linked_payments)) return order.linked_payments;
  const raw = order?.linked_payments_json;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      /* ignore */
    }
  }
  const received = Number(order.amount_received);
  if (Number.isFinite(received) && received > 0) {
    return [
      {
        trans_id: order.payment_id ? String(order.payment_id).split(",")[0].trim() : "",
        date: order.payment_received_date || null,
        amount: received,
      },
    ];
  }
  return [];
}
