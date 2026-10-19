import {
  computeDispatchPendingFromRows,
  dispatchRowMatchesQuotationLine,
} from "@/lib/dispatchQuotationMatch";
import {
  orderRemainBookingBatchDone,
  reconcileDispatchStatusForOrder,
} from "@/lib/orderDeliveryEligibility";
import { ensureDispatchActiveColumn } from "@/lib/dispatchPartialSelection";
import {
  normalizeQuoteKey,
  sqlQuoteTrimEqColumn,
  sqlQuoteTrimEqColumns,
  sqlQuoteTrimIn,
} from "@/lib/sqlQuoteMatch";

/** @param {import("mysql2/promise").PoolConnection} conn */

const TABLE = "order_booking_batches";

export async function ensureOrderBookingBatchesTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      sequence_no INT NOT NULL DEFAULT 1,
      booking_id VARCHAR(255) NULL,
      booking_url TEXT NULL,
      booking_date DATE NULL,
      delivery_date DATE NULL,
      admin_remark TEXT NULL,
      booking_by VARCHAR(100) NULL,
      items_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_order_booking_seq (order_id, sequence_no),
      KEY idx_order_booking_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function parseItemsJson(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapBatchRow(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    sequence_no: Number(row.sequence_no) || 1,
    booking_id: row.booking_id,
    booking_url: row.booking_url,
    booking_date: row.booking_date,
    delivery_date: row.delivery_date,
    admin_remark: row.admin_remark,
    booking_by: row.booking_by,
    items: parseItemsJson(row.items_json),
    created_at: row.created_at,
  };
}

export function syntheticBatchFromNeworder(order) {
  return {
    id: null,
    order_id: order.order_id,
    sequence_no: 1,
    booking_id: order.booking_id,
    booking_url: order.booking_url,
    booking_date: order.booking_date,
    delivery_date: order.delivery_date,
    admin_remark: order.admin_remark,
    booking_by: order.booking_by,
    items: [],
    created_at: order.booking_date || order.created_at,
  };
}

export function orderHasBookingIdOnRow(order) {
  return (
    order?.booking_id !== undefined &&
    order?.booking_id !== null &&
    String(order.booking_id).trim() !== "" &&
    String(order.booking_id) !== "0"
  );
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function fetchBookingBatchesForOrder(conn, orderId) {
  await ensureOrderBookingBatchesTable(conn);
  const [rows] = await conn.execute(
    `SELECT * FROM ${TABLE} WHERE order_id = ? ORDER BY sequence_no ASC`,
    [orderId],
  );
  return (rows || []).map(mapBatchRow);
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function attachBookingBatchesToOrders(conn, orders) {
  if (!orders?.length) return orders || [];
  await ensureOrderBookingBatchesTable(conn);
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
    byOrder.get(oid).push(mapBatchRow(row));
  }

  return orders.map((order) => {
    let booking_batches = byOrder.get(order.order_id) || [];
    if (!booking_batches.length && orderHasBookingIdOnRow(order)) {
      booking_batches = [syntheticBatchFromNeworder(order)];
    }
    return { ...order, booking_batches };
  });
}

/** Accurate pending / open-dispatch counts (quotation ↔ dispatch matching). */
export async function attachDispatchPendingToOrders(conn, orders) {
  if (!orders?.length) return orders || [];
  await ensureDispatchActiveColumn(conn);

  const quoteNumbers = [
    ...new Set(
      orders.map((o) => String(o.quote_number || "").trim()).filter(Boolean),
    ),
  ];
  if (!quoteNumbers.length) return orders;

  const inClause = quoteNumbers.map(() => "?").join(",");

  // Permanent repair: serial filled ⇒ treat as shipped in DB (all orders)
  try {
    await conn.execute(
      `UPDATE dispatch
       SET stock_deducted = 1, dispatch_active = 0, updated_at = NOW()
       WHERE ${sqlQuoteTrimIn("quote_number", inClause)}
         AND COALESCE(stock_deducted, 0) = 0
         AND serial_no IS NOT NULL
         AND TRIM(serial_no) <> ''`,
      quoteNumbers,
    );
  } catch (e) {
    console.error("attachDispatchPending repair stock_deducted:", e);
  }

  const [qiRows] = await conn.execute(
    `SELECT TRIM(CONVERT(quote_number USING utf8mb4)) AS quote_number, item_code, item_name,
            COALESCE(quantity, 1) AS quantity
     FROM quotation_items
     WHERE ${sqlQuoteTrimIn("quote_number", inClause)}`,
    quoteNumbers,
  );
  const [dispatchRows] = await conn.execute(
    `SELECT TRIM(CONVERT(quote_number USING utf8mb4)) AS quote_number, item_code, item_name,
            serial_no,
            COALESCE(stock_deducted, 0) AS stock_deducted,
            COALESCE(dispatch_active, 1) AS dispatch_active
     FROM dispatch
     WHERE ${sqlQuoteTrimIn("quote_number", inClause)}`,
    quoteNumbers,
  );

  const qiByQuote = new Map();
  for (const row of qiRows || []) {
    const q = normalizeQuoteKey(row.quote_number);
    if (!qiByQuote.has(q)) qiByQuote.set(q, []);
    qiByQuote.get(q).push(row);
  }
  const dispByQuote = new Map();
  for (const row of dispatchRows || []) {
    const q = normalizeQuoteKey(row.quote_number);
    if (!dispByQuote.has(q)) dispByQuote.set(q, []);
    dispByQuote.get(q).push(row);
  }

  // Per-order shipped count via order_id join (avoids quote key mismatch)
  const orderIds = orders.map((o) => o.order_id).filter(Boolean);
  const shippedByOrder = new Map();
  if (orderIds.length) {
    const idPh = orderIds.map(() => "?").join(",");
    try {
      const [shipRows] = await conn.execute(
        `SELECT no.order_id, COUNT(*) AS c
         FROM dispatch d
         INNER JOIN neworder no
           ON ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
         WHERE no.order_id IN (${idPh})
           AND (
             COALESCE(d.stock_deducted, 0) = 1
             OR (d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> '')
           )
         GROUP BY no.order_id`,
        orderIds,
      );
      for (const r of shipRows || []) {
        shippedByOrder.set(String(r.order_id), Number(r.c) || 0);
      }
    } catch (e) {
      console.error("attachDispatchPending shippedByOrder:", e);
    }
  }

  const updates = [];
  const enriched = orders.map((order) => {
    const q = normalizeQuoteKey(order.quote_number);
    const disp = dispByQuote.get(q) || [];
    let { pending_units, open_dispatch_units, shipped_units } =
      computeDispatchPendingFromRows(qiByQuote.get(q) || [], disp);

    const remainBooked = orderRemainBookingBatchDone(order);
    // After partial ship, keep remain products inactive until remain booking
    if (shipped_units > 0 && (!remainBooked || pending_units <= 0)) {
      open_dispatch_units = 0;
    }

    const joinShipped = shippedByOrder.get(String(order.order_id)) || 0;
    const sqlShipped = Number(order.dispatched_stock_count) || 0;
    shipped_units = Math.max(shipped_units, sqlShipped, joinShipped);

    const withCounts = {
      ...order,
      pending_dispatch_units: pending_units,
      open_dispatch_units,
      dispatch_shipped_units: shipped_units,
      dispatched_stock_count: Math.max(sqlShipped, shipped_units),
    };
    const dispatch_status = reconcileDispatchStatusForOrder(
      withCounts,
      pending_units,
    );
    if (
      order.order_id &&
      Number(order.dispatch_status) !== Number(dispatch_status)
    ) {
      // Sync 0 (reset stale), 1 (full), 2 (partial)
      if (
        dispatch_status === 0 ||
        dispatch_status === 1 ||
        dispatch_status === 2
      ) {
        updates.push({ orderId: order.order_id, dispatch_status });
      }
    }
    return { ...withCounts, dispatch_status };
  });

  for (const u of updates) {
    try {
      await conn.execute(
        `UPDATE neworder SET dispatch_status = ? WHERE order_id = ?`,
        [u.dispatch_status, u.orderId],
      );
    } catch (e) {
      console.error("attachDispatchPending sync dispatch_status:", e);
    }
  }

  for (const order of enriched) {
    const shipped = Number(order.dispatch_shipped_units) || 0;
    if (shipped <= 0) continue;
    const q = String(order.quote_number || "").trim();
    if (!q) continue;
    const pending = Number(order.pending_dispatch_units) || 0;
    const remainBooked = orderRemainBookingBatchDone(order);
    const shouldCloseOpen =
      pending <= 0 || (pending > 0 && !remainBooked);
    if (!shouldCloseOpen) continue;
    try {
      await conn.execute(
        `UPDATE dispatch
         SET dispatch_active = 0, updated_at = NOW()
         WHERE ${sqlQuoteTrimEqColumn("quote_number")}
           AND COALESCE(stock_deducted, 0) = 0`,
        [q],
      );
      order.open_dispatch_units = 0;
    } catch (e) {
      console.error("attachDispatchPending deactivate pending rows:", e);
    }
  }

  return enriched;
}

/** Active dispatch lines for this booking batch (after prepare). */
export async function captureDispatchedItemsForQuote(conn, quoteNumber) {
  const [rows] = await conn.execute(
    `SELECT TRIM(item_code) AS item_code,
            MAX(item_name) AS item_name,
            COUNT(*) AS quantity
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(stock_deducted, 0) = 1
     GROUP BY TRIM(item_code)`,
    [quoteNumber],
  );
  return (rows || []).map((r) => ({
    item_code: String(r.item_code || "").trim(),
    item_name: String(r.item_name || "").trim(),
    quantity: Number(r.quantity) || 1,
  }));
}

/** Preserve first booking on disk before a follow-up overwrites neworder. */
export async function ensureBatch1SnapshotBeforeFollowUp(conn, orderId, orderRow) {
  await ensureOrderBookingBatchesTable(conn);
  const [existing] = await conn.execute(
    `SELECT id FROM ${TABLE} WHERE order_id = ? AND sequence_no = 1 LIMIT 1`,
    [orderId],
  );
  if (existing?.length) return;

  const items = await captureDispatchedItemsForQuote(conn, orderRow.quote_number);
  const itemsJson = JSON.stringify(items);
  await conn.execute(
    `INSERT INTO ${TABLE}
      (order_id, sequence_no, booking_id, booking_url, booking_date, delivery_date, admin_remark, booking_by, items_json)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      orderRow.booking_id ?? null,
      orderRow.booking_url ?? null,
      orderRow.booking_date ?? null,
      orderRow.delivery_date ?? null,
      orderRow.admin_remark ?? null,
      orderRow.booking_by ?? null,
      itemsJson,
    ],
  );
}

/** Turn on dispatch rows for this follow-up booking batch (undispatched only). */
export async function activateDispatchRowsForBookingItems(
  conn,
  quoteNumber,
  items,
) {
  await ensureDispatchActiveColumn(conn);
  const [pool] = await conn.execute(
    `SELECT id, item_code, item_name
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(stock_deducted, 0) = 0
     ORDER BY id ASC`,
    [quoteNumber],
  );
  const rows = pool || [];
  for (const item of items || []) {
    const qi = {
      item_code: item.item_code,
      item_name: item.item_name,
    };
    let need = Math.max(1, Number(item.quantity) || 1);
    for (const row of rows) {
      if (need <= 0) break;
      if (!dispatchRowMatchesQuotationLine(row, qi)) continue;
      if (Number(row._activated)) continue;
      await conn.execute(
        `UPDATE dispatch SET dispatch_active = 1, updated_at = NOW() WHERE id = ?`,
        [row.id],
      );
      row._activated = 1;
      need -= 1;
    }
  }
}

export async function captureBookingBatchItems(conn, quoteNumber) {
  const [rows] = await conn.execute(
    `SELECT TRIM(item_code) AS item_code,
            MAX(item_name) AS item_name,
            COUNT(*) AS quantity
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(dispatch_active, 1) = 1
     GROUP BY TRIM(item_code)`,
    [quoteNumber],
  );
  if (rows?.length) {
    return rows.map((r) => ({
      item_code: String(r.item_code || "").trim(),
      item_name: String(r.item_name || "").trim(),
      quantity: Number(r.quantity) || 1,
    }));
  }

  const [qi] = await conn.execute(
    `SELECT TRIM(item_code) AS item_code,
            item_name,
            GREATEST(1, COALESCE(quantity, 1)) AS quantity
     FROM quotation_items
     WHERE TRIM(quote_number) = TRIM(?)`,
    [quoteNumber],
  );
  return (qi || []).map((r) => ({
    item_code: String(r.item_code || "").trim(),
    item_name: String(r.item_name || "").trim(),
    quantity: Number(r.quantity) || 1,
  }));
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ isFollowUp: boolean }} opts
 */
export async function persistOrderBookingBatch(
  conn,
  orderId,
  quoteNumber,
  fields,
  opts,
) {
  await ensureOrderBookingBatchesTable(conn);
  const items = await captureBookingBatchItems(conn, quoteNumber);
  const itemsJson = JSON.stringify(items);

  const {
    booking_id,
    booking_url,
    booking_date,
    expected_delivery_date,
    adminremark,
    bookingBy,
  } = fields;

  if (opts.isFollowUp) {
    const [maxRows] = await conn.execute(
      `SELECT COALESCE(MAX(sequence_no), 0) AS mx FROM ${TABLE} WHERE order_id = ?`,
      [orderId],
    );
    const nextSeq = Number(maxRows[0]?.mx || 0) + 1;
    await conn.execute(
      `INSERT INTO ${TABLE}
        (order_id, sequence_no, booking_id, booking_url, booking_date, delivery_date, admin_remark, booking_by, items_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        nextSeq,
        booking_id ?? null,
        booking_url ?? null,
        booking_date ?? null,
        expected_delivery_date ?? null,
        adminremark ?? null,
        bookingBy ?? null,
        itemsJson,
      ],
    );
    await activateDispatchRowsForBookingItems(conn, quoteNumber, items);
    return nextSeq;
  }

  const [existing] = await conn.execute(
    `SELECT id FROM ${TABLE} WHERE order_id = ? AND sequence_no = 1 LIMIT 1`,
    [orderId],
  );
  if (existing?.length) {
    await conn.execute(
      `UPDATE ${TABLE} SET
        booking_id = ?, booking_url = ?, booking_date = ?, delivery_date = ?,
        admin_remark = ?, booking_by = ?, items_json = ?
       WHERE order_id = ? AND sequence_no = 1`,
      [
        booking_id ?? null,
        booking_url ?? null,
        booking_date ?? null,
        expected_delivery_date ?? null,
        adminremark ?? null,
        bookingBy ?? null,
        itemsJson,
        orderId,
      ],
    );
  } else {
    await conn.execute(
      `INSERT INTO ${TABLE}
        (order_id, sequence_no, booking_id, booking_url, booking_date, delivery_date, admin_remark, booking_by, items_json)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        booking_id ?? null,
        booking_url ?? null,
        booking_date ?? null,
        expected_delivery_date ?? null,
        adminremark ?? null,
        bookingBy ?? null,
        itemsJson,
      ],
    );
  }
  return 1;
}

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function getBookingBatchForView(conn, orderId, sequenceNo) {
  const batches = await fetchBookingBatchesForOrder(conn, orderId);
  if (!batches.length) return null;
  if (sequenceNo === "latest" || sequenceNo === "remain") {
    return batches[batches.length - 1];
  }
  const seq = Number(sequenceNo) || 1;
  return batches.find((b) => b.sequence_no === seq) || batches[0];
}

export function filterQuotationItemsForBatch(allItems, batch) {
  const batchItems = batch?.items || [];
  if (!batchItems.length) return allItems;
  const qtyByCode = new Map(
    batchItems.map((i) => [String(i.item_code).trim(), Number(i.quantity) || 1]),
  );
  return (allItems || [])
    .filter((row) => qtyByCode.has(String(row.item_code || "").trim()))
    .map((row) => {
      const code = String(row.item_code || "").trim();
      const batchQty = qtyByCode.get(code);
      return batchQty != null ? { ...row, quantity: batchQty } : row;
    });
}
