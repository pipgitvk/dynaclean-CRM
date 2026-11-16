import { sqlQuoteTrimEqColumns } from "@/lib/sqlQuoteMatch";
import { orderHasDeliveryRecord } from "@/lib/orderDeliveryStatus";

const DISPATCH_PHYSICAL_LINE_SQL = `NOT (
  LOWER(COALESCE(d.item_name, '')) LIKE '%amc%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%camc%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%cmc%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%service%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%maintenance%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%installation%'
  OR LOWER(COALESCE(d.item_name, '')) LIKE '%charges%'
  OR LOWER(COALESCE(d.item_code, '')) LIKE '%amc%'
  OR LOWER(COALESCE(d.item_code, '')) LIKE '%camc%'
  OR LOWER(COALESCE(d.item_code, '')) LIKE '%service%'
)`;

/** Completed dispatch rounds (distinct completion timestamps on shipped lines). */
export async function attachDispatchShipmentWavesToOrders(conn, orders) {
  if (!orders?.length) return orders || [];
  const ids = orders.map((o) => o.order_id).filter(Boolean);
  if (!ids.length) return orders;

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT no.order_id,
            COUNT(
              DISTINCT DATE_FORMAT(
                COALESCE(d.updated_at, d.created_at),
                '%Y-%m-%d %H:%i:%s'
              )
            ) AS wave_count
     FROM neworder no
     INNER JOIN dispatch d
       ON ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
     WHERE no.order_id IN (${placeholders})
       AND COALESCE(d.stock_deducted, 0) = 1
       AND ${DISPATCH_PHYSICAL_LINE_SQL}
     GROUP BY no.order_id`,
    ids,
  );

  const byOrder = new Map();
  for (const row of rows || []) {
    byOrder.set(row.order_id, Number(row.wave_count) || 0);
  }

  return orders.map((order) => {
    let waves = byOrder.get(order.order_id) || 0;
    const shipped = Math.max(
      Number(order?.dispatched_stock_count) || 0,
      Number(order?.dispatch_shipped_units) || 0,
    );
    if (shipped > 0 && waves < 1) waves = 1;
    return { ...order, dispatch_shipment_wave_count: waves };
  });
}

export function countSavedDeliveryBatches(order) {
  const batches = order?.delivery_batches || [];
  const saved = batches.filter(
    (b) =>
      b.delivered_on != null &&
      String(b.delivered_on).trim() !== "" &&
      String(b.delivered_on) !== "0",
  ).length;
  if (saved > 0) return saved;
  return orderHasDeliveryRecord(order) ? 1 : 0;
}

/** Each booking batch (2+) or each dispatch wave needs its own delivery proof. */
export function getRequiredDeliveryProofCount(order) {
  const waves = Math.max(0, Number(order?.dispatch_shipment_wave_count) || 0);
  const bookingCount = (order?.booking_batches || []).length;
  if (bookingCount >= 2) {
    return Math.max(bookingCount, 1);
  }
  return Math.max(1, waves || 1);
}

export function orderNeedsAnotherDeliverySave(order) {
  const required = getRequiredDeliveryProofCount(order);
  const saved = countSavedDeliveryBatches(order);
  return saved > 0 && saved < required;
}

export function getDeliveryBatchBySequence(order, sequenceNo) {
  const seq = Number(sequenceNo) || 1;
  const batches = order?.delivery_batches || [];
  const hit = batches.find((b) => Number(b.sequence_no) === seq);
  if (hit) return hit;
  if (seq === 1 && batches.length === 1 && !batches[0]?.sequence_no) {
    return batches[0];
  }
  if (seq === 1 && orderHasDeliveryRecord(order) && !batches.length) {
    return null;
  }
  return null;
}

export function isOrderDeliveredOnList(order) {
  const required = getRequiredDeliveryProofCount(order);
  const saved = countSavedDeliveryBatches(order);
  if (saved < required) return false;
  return Number(order?.delivery_status) === 1;
}

/** List / badge: Partial Delivery until all required delivery proofs are saved. */
export function orderShowsPartialDeliveryOnList(order) {
  if (isOrderDeliveredOnList(order)) return false;
  const required = getRequiredDeliveryProofCount(order);
  const saved = countSavedDeliveryBatches(order);
  if (Number(order?.delivery_status) === 2) return true;
  if (Number(order?.delivery_status) === 1 && saved < required) return true;
  if (saved > 0 && saved < required) return true;
  const bookings = order?.booking_batches?.length || 0;
  if (bookings >= 2 && saved < required) return true;
  return false;
}

export function deliveryMenuLabelForBatch(sequenceNo, mode = "view") {
  const seq = Number(sequenceNo) || 1;
  if (seq <= 1) {
    return mode === "update" ? "Update Delivery" : "View Delivery";
  }
  return mode === "update"
    ? `Update Delivery (Batch ${seq})`
    : `View Delivery (Batch ${seq})`;
}