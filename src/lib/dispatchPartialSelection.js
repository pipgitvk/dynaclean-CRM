import {
  canCreateFollowUpBooking,
  ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT,
  ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT,
} from "@/lib/orderDeliveryEligibility";
import {
  computeDispatchPendingFromRows,
  dispatchRowAllocatesUnit,
  dispatchRowIsShipped,
  dispatchRowMatchesQuotationLine,
} from "@/lib/dispatchQuotationMatch";
import { sqlQuoteTrimEqColumn } from "@/lib/sqlQuoteMatch";

/** @param {import("mysql2/promise").PoolConnection} conn */

export async function ensureDispatchActiveColumn(conn) {
  try {
    await conn.execute(
      `ALTER TABLE dispatch ADD COLUMN dispatch_active TINYINT(1) NOT NULL DEFAULT 1
       COMMENT '1 = included in current dispatch batch'`,
    );
  } catch (_) {
    /* column exists */
  }
}

function normCode(code) {
  return String(code ?? "").trim();
}

/**
 * Quotation lines with how many units are already dispatched (stock_deducted).
 */
export async function fetchOrderDispatchLineOptions(conn, orderId) {
  const [orderRows] = await conn.execute(
    `SELECT order_id, quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  if (!orderRows?.[0]?.quote_number) {
    return { quoteNumber: null, lines: [] };
  }
  const quoteNumber = orderRows[0].quote_number;

  await ensureDispatchActiveColumn(conn);

  // Repair: serial saved / stock already moved ⇒ mark shipped (fixes stuck "Pending")
  await conn.execute(
    `UPDATE dispatch
     SET stock_deducted = 1, dispatch_active = 0, updated_at = NOW()
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
       AND COALESCE(stock_deducted, 0) = 0
       AND serial_no IS NOT NULL
       AND TRIM(serial_no) <> ''`,
    [quoteNumber],
  );

  const [qiRows] = await conn.execute(
    `SELECT item_code, item_name, COALESCE(quantity, 1) AS quantity
     FROM quotation_items
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
     ORDER BY item_code`,
    [quoteNumber],
  );

  const [dispatchRows] = await conn.execute(
    `SELECT item_code, item_name, serial_no,
            COALESCE(stock_deducted, 0) AS stock_deducted,
            COALESCE(dispatch_active, 1) AS dispatch_active
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}`,
    [quoteNumber],
  );

  const lines = (qiRows || [])
    .map((row) => {
      const code = normCode(row.item_code);
      const orderQty = Math.max(1, Number(row.quantity) || 1);
      let dispatchedQty = 0;
      let allocatedQty = 0;
      for (const d of dispatchRows || []) {
        if (!dispatchRowMatchesQuotationLine(d, row)) continue;
        if (dispatchRowIsShipped(d)) dispatchedQty += 1;
        if (dispatchRowAllocatesUnit(d, dispatchRows)) allocatedQty += 1;
      }
      const pendingQty = Math.max(0, orderQty - allocatedQty);
      return {
        item_code: code,
        item_name: String(row.item_name || "").trim(),
        order_qty: orderQty,
        dispatched_qty: dispatchedQty,
        pending_qty: pendingQty,
      };
    })
    .filter((l) => l.pending_qty > 0 && (l.item_code || l.item_name));

  return { quoteNumber, lines };
}

/**
 * Activate only selected pending units for dispatch; defer the rest.
 * @param {{ item_code: string, item_name?: string, quantity: number }[]} selectedItems
 */
export async function applyDispatchItemSelection(conn, orderId, selectedItems) {
  await ensureDispatchActiveColumn(conn);

  const [orderRows] = await conn.execute(
    `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  const quoteNumber = orderRows?.[0]?.quote_number;
  if (!quoteNumber) {
    throw new Error("Order or quotation not found");
  }

  const selectionMap = new Map();
  for (const item of selectedItems || []) {
    const code = normCode(item.item_code);
    const qty = Math.max(0, Number(item.quantity) || 0);
    if (!code || qty <= 0) continue;
    selectionMap.set(code, {
      item_code: code,
      item_name: String(item.item_name || "").trim(),
      quantity: qty,
    });
  }
  if (selectionMap.size === 0) {
    throw new Error("Select at least one product to dispatch");
  }

  const { lines: allLines } = await fetchOrderDispatchLineOptions(conn, orderId);
  const pendingByCode = new Map(allLines.map((l) => [l.item_code, l.pending_qty]));

  for (const [code, sel] of selectionMap) {
    const maxPending = pendingByCode.get(code) || 0;
    if (maxPending <= 0) {
      throw new Error(`No pending quantity for ${code}`);
    }
    if (sel.quantity > maxPending) {
      throw new Error(`Quantity for ${code} cannot exceed ${maxPending}`);
    }
  }

  const [undispatchedRows] = await conn.execute(
    `SELECT id, TRIM(item_code) AS item_code, item_name
     FROM dispatch
     WHERE TRIM(quote_number) = TRIM(?)
       AND COALESCE(stock_deducted, 0) = 0
     ORDER BY id ASC`,
    [quoteNumber],
  );

  await conn.execute(
    `UPDATE dispatch SET dispatch_active = 0, updated_at = NOW()
     WHERE TRIM(quote_number) = TRIM(?)
       AND COALESCE(stock_deducted, 0) = 0`,
    [quoteNumber],
  );

  const rowsByCode = new Map();
  for (const row of undispatchedRows || []) {
    const code = normCode(row.item_code);
    if (!rowsByCode.has(code)) rowsByCode.set(code, []);
    rowsByCode.get(code).push(row);
  }

  for (const [code, sel] of selectionMap) {
    let need = sel.quantity;
    const pool = rowsByCode.get(code) || [];
    for (const row of pool) {
      if (need <= 0) break;
      await conn.execute(
        `UPDATE dispatch SET dispatch_active = 1, updated_at = NOW() WHERE id = ?`,
        [row.id],
      );
      need -= 1;
    }
    const itemName = sel.item_name || pool[0]?.item_name || code;
    while (need > 0) {
      await conn.execute(
        `INSERT INTO dispatch (quote_number, item_name, item_code, serial_no, remarks, photos, dispatch_active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, NULL, 1, NOW(), NULL)`,
        [quoteNumber, itemName, code],
      );
      need -= 1;
    }
  }

  const totalPending = allLines.reduce((s, l) => s + l.pending_qty, 0);
  const selectedTotal = [...selectionMap.values()].reduce(
    (s, v) => s + v.quantity,
    0,
  );
  const isPartial =
    selectedTotal < totalPending ||
    allLines.some((l) => {
      const sel = selectionMap.get(l.item_code);
      const take = sel ? sel.quantity : 0;
      return take < l.pending_qty;
    });

  await conn.execute(
    `UPDATE neworder SET dispatch_status = ? WHERE order_id = ?`,
    [isPartial ? 2 : 0, orderId],
  );

  return { isPartial, quoteNumber };
}

export async function computeDispatchCompletionStatus(conn, orderId) {
  const { lines } = await fetchOrderDispatchLineOptions(conn, orderId);
  const remaining = lines.reduce((s, l) => s + l.pending_qty, 0);
  return remaining > 0 ? 2 : 1;
}

/** New booking for remaining lines after at least one unit is already dispatched. */
export async function isFollowUpBookingOrder(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT no.booking_id, no.dispatch_status,
            ${ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT},
            ${ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT}
     FROM neworder no
     WHERE no.order_id = ?
     LIMIT 1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) return false;

  if (canCreateFollowUpBooking(order)) return true;

  const { lines } = await fetchOrderDispatchLineOptions(conn, orderId);
  const pending = lines.reduce((s, l) => s + l.pending_qty, 0);
  const dispatched = lines.reduce((s, l) => s + l.dispatched_qty, 0);
  return pending > 0 && dispatched > 0;
}
