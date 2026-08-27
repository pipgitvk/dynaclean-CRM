/**
 * Mark matching pre-bookings as received/partial when an order is processed.
 * Matches by customer_id + product_name OR item_code (names often differ).
 */
export async function syncPreBookingsForOrder(
  conn,
  { orderId, quoteNumber, customerId, deliveryDate },
) {
  if (!orderId || !quoteNumber) return { updated: 0 };

  let customerIdStr = customerId != null ? String(customerId).trim() : "";

  if (!customerIdStr) {
    const [orderRows] = await conn.execute(
      `SELECT customer_id FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (orderRows[0]?.customer_id != null) {
      customerIdStr = String(orderRows[0].customer_id).trim();
    }
  }

  if (!customerIdStr) {
    const [quoteRows] = await conn.execute(
      `SELECT customer_id FROM quotations_records WHERE quote_number = ? LIMIT 1`,
      [quoteNumber],
    );
    if (quoteRows[0]?.customer_id != null) {
      customerIdStr = String(quoteRows[0].customer_id).trim();
    }
  }

  if (!customerIdStr) {
    console.log(`📋 Order ${orderId}: No customer_id for pre-booking sync`);
    return { updated: 0 };
  }

  const [quotationItems] = await conn.execute(
    `SELECT item_name, item_code, quantity FROM quotation_items WHERE quote_number = ?`,
    [quoteNumber],
  );

  if (!quotationItems.length) {
    console.log(`⚠️ Order ${orderId}: No quotation items for pre-booking sync`);
    return { updated: 0 };
  }

  const updatedIds = new Set();
  let updated = 0;

  for (const qi of quotationItems) {
    const productName = qi.item_name;
    const itemCode = String(qi.item_code || "").trim();
    const orderQuantity = Number(qi.quantity) || 0;

    const [preBookings] = await conn.execute(
      `SELECT id, expected_date, quantity FROM pre_booking
       WHERE customer_id = ?
         AND status IN ('pending', 'postponed', 'cancelled')
         AND (
           product_name = ?
           OR (? != '' AND item_code = ?)
         )`,
      [customerIdStr, productName, itemCode, itemCode],
    );

    for (const preBooking of preBookings) {
      if (updatedIds.has(preBooking.id)) continue;
      updatedIds.add(preBooking.id);

      const preBookingQty = Number(preBooking.quantity) || 0;
      const newStatus = orderQuantity < preBookingQty ? "partial" : "received";

      await conn.execute(
        `UPDATE pre_booking
         SET status = ?,
             order_id = ?,
             received_date = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, orderId, deliveryDate, preBooking.id],
      );

      console.log(
        `✅ Pre-booking ${preBooking.id} → ${newStatus} for order ${orderId} (customer=${customerIdStr}, product="${productName}", item_code="${itemCode}")`,
      );
      updated += 1;
    }
  }

  console.log(`🔍 Order ${orderId}: Synced ${updated} pre-booking(s)`);
  return { updated };
}
