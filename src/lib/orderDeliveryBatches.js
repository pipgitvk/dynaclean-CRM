import { orderRemainBookingBatchDone } from "@/lib/orderDeliveryEligibility";

/** @param {import("mysql2/promise").PoolConnection} conn */

const TABLE = "order_delivery_batches";

let orderDeliveryBatchesTableReady = false;

export async function ensureOrderDeliveryBatchesTable(conn) {
  if (orderDeliveryBatchesTableReady) return;
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      sequence_no INT NOT NULL DEFAULT 1,
      delivered_on DATE NULL,
      delivery_proof TEXT NULL,
      delivery_remark TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_order_delivery_seq (order_id, sequence_no),
      KEY idx_order_delivery_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  orderDeliveryBatchesTableReady = true;
}

function mapRow(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    sequence_no: Number(row.sequence_no) || 1,
    delivered_on: row.delivered_on,
    delivery_proof: row.delivery_proof,
    delivery_remark: row.delivery_remark,
    created_at: row.created_at,
  };
}

export function syntheticDeliveryBatchFromNeworder(order, sequenceNo = 1) {
  return {
    id: null,
    order_id: order.order_id,
    sequence_no: sequenceNo,
    delivered_on: order.delivered_on,
    delivery_proof: order.delivery_proof,
    delivery_remark: order.delivery_remark,
    created_at: order.delivered_on || order.created_at,
  };
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function attachDeliveryBatchesToOrders(conn, orders) {
  if (!orders?.length) return orders || [];
  await ensureOrderDeliveryBatchesTable(conn);
  const ids = orders.map((o) => o.order_id).filter(Boolean);
  if (!ids.length) return orders;

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT * FROM ${TABLE} WHERE order_id IN (${placeholders}) ORDER BY order_id, sequence_no ASC`,
    ids,
  );
  const byOrder = new Map();
  for (const row of rows || []) {
    const oid = row.order_id;
    if (!byOrder.has(oid)) byOrder.set(oid, []);
    byOrder.get(oid).push(mapRow(row));
  }

  return orders.map((order) => {
    let delivery_batches = byOrder.get(order.order_id) || [];
    const hasNeworderDelivery =
      order.delivered_on ||
      order.delivery_proof ||
      Number(order.delivery_status) === 1 ||
      Number(order.delivery_status) === 2;
    if (!delivery_batches.length && hasNeworderDelivery) {
      delivery_batches = [syntheticDeliveryBatchFromNeworder(order, 1)];
    }
    return { ...order, delivery_batches };
  });
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function persistOrderDeliveryBatch(
  conn,
  orderId,
  { delivered_on, delivery_proof, delivery_remark },
) {
  await ensureOrderDeliveryBatchesTable(conn);
  const [maxRows] = await conn.execute(
    `SELECT COALESCE(MAX(sequence_no), 0) AS mx FROM ${TABLE} WHERE order_id = ?`,
    [orderId],
  );
  const nextSeq = Number(maxRows[0]?.mx || 0) + 1;
  await conn.execute(
    `INSERT INTO ${TABLE}
      (order_id, sequence_no, delivered_on, delivery_proof, delivery_remark)
     VALUES (?, ?, ?, ?, ?)`,
    [
      orderId,
      nextSeq,
      delivered_on || null,
      delivery_proof || null,
      delivery_remark || null,
    ],
  );
  return nextSeq;
}

export function getDeliveryBatchForView(order, which) {
  const batches = order?.delivery_batches || [];
  if (!batches.length) return null;
  if (which === "first" || which === "1") {
    return batches.find((b) => b.sequence_no === 1) || batches[0];
  }
  if (which === "remain" || which === "latest") {
    if (batches.length >= 2) {
      return batches[batches.length - 1];
    }
    return null;
  }
  return batches[0];
}

export function orderHasSecondDeliveryBatch(order) {
  const batches = order?.delivery_batches || [];
  return batches.length >= 2 || batches.some((b) => Number(b.sequence_no) >= 2);
}

/** 2nd booking batch saved but fewer than 2 delivery proofs on file. */
export function orderNeedsRemainDeliverySave(order) {
  if (!orderRemainBookingBatchDone(order)) return false;
  return !orderHasSecondDeliveryBatch(order);
}
