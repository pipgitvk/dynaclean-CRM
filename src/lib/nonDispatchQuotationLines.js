import { isNonDispatchQuotationLine } from "@/lib/dispatchSerialRules";
import { dispatchRowMatchesQuotationLine, dispatchRowIsShipped } from "@/lib/dispatchQuotationMatch";
import { ensureDispatchActiveColumn } from "@/lib/dispatchPartialSelection";
import { sqlQuoteTrimEqColumn } from "@/lib/sqlQuoteMatch";

export { isNonDispatchQuotationLine };

/**
 * Order quotation lines are all AMC/service/installation/maintenance (no warehouse products).
 */
export function orderIsServiceChargeOnlyOrder(order) {
  const items = order?.line_items;
  if (Array.isArray(items) && items.length > 0) {
    return items.every((it) =>
      isNonDispatchQuotationLine(it.item_name, it.item_code),
    );
  }
  const name = String(order?.item_name || "").trim();
  const code = String(order?.item_code || "").trim();
  if (!name && !code) return false;
  if (name.includes(",")) {
    return name
      .split(",")
      .every((part) => isNonDispatchQuotationLine(part.trim(), code));
  }
  return isNonDispatchQuotationLine(name, code);
}

export function orderServiceChargeOnlyInvoiced(order) {
  return (
    Boolean(order?.report_file && String(order.report_file).trim()) ||
    Number(order?.account_status) === 1
  );
}

/** Blue "Completed" for service-only orders after accountant invoice upload. */
export function serviceChargeOnlyCompletedStatus(order) {
  if (!orderIsServiceChargeOnlyOrder(order)) return null;
  if (!orderServiceChargeOnlyInvoiced(order)) return null;
  return {
    text: "Completed",
    bg: "bg-blue-100",
    textCol: "text-blue-800",
  };
}

/**
 * Mark AMC/CAMC/service/installation/maintenance units as dispatch-complete
 * (no warehouse). Idempotent — safe to call multiple times.
 */
export async function completeNonDispatchLinesForQuote(conn, quoteNumber) {
  if (!quoteNumber) return;

  await ensureDispatchActiveColumn(conn);

  const [qiRows] = await conn.execute(
    `SELECT item_code, item_name, COALESCE(quantity, 1) AS quantity
     FROM quotation_items
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
     ORDER BY item_code`,
    [quoteNumber],
  );

  const [dispatchRows] = await conn.execute(
    `SELECT id, item_code, item_name,
            COALESCE(stock_deducted, 0) AS stock_deducted,
            COALESCE(dispatch_active, 1) AS dispatch_active
     FROM dispatch
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}
     ORDER BY id ASC`,
    [quoteNumber],
  );

  const rows = dispatchRows || [];

  for (const qi of qiRows || []) {
    if (!isNonDispatchQuotationLine(qi.item_name, qi.item_code)) continue;

    const orderQty = Math.max(1, Number(qi.quantity) || 1);

    for (const d of rows) {
      if (!dispatchRowMatchesQuotationLine(d, qi)) continue;
      if (dispatchRowIsShipped(d)) continue;
      await conn.execute(
        `UPDATE dispatch
         SET stock_deducted = 1,
             dispatch_active = 0,
             remarks = COALESCE(NULLIF(TRIM(remarks), ''), 'Auto-completed (service/AMC)'),
             updated_at = NOW()
         WHERE id = ?`,
        [d.id],
      );
      d.stock_deducted = 1;
      d.dispatch_active = 0;
    }

    let completed = 0;
    for (const d of rows) {
      if (!dispatchRowMatchesQuotationLine(d, qi)) continue;
      if (dispatchRowIsShipped(d) || Number(d.stock_deducted) === 1) {
        completed += 1;
      }
    }

    const itemName = String(qi.item_name || qi.item_code || "Service").trim();
    const itemCode = String(qi.item_code || qi.item_name || "").trim();

    while (completed < orderQty) {
      await conn.execute(
        `INSERT INTO dispatch
           (quote_number, item_name, item_code, serial_no, remarks, photos,
            stock_deducted, dispatch_active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'Auto-completed (service/AMC)', NULL, 1, 0, NOW(), NOW())`,
        [quoteNumber, itemName, itemCode],
      );
      completed += 1;
    }
  }
}

/** When invoice is uploaded, close service lines and service-only orders. */
export async function syncNonDispatchLinesAfterAccountUpload(conn, orderId) {
  const [orderRows] = await conn.execute(
    `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  const quoteNumber = orderRows?.[0]?.quote_number;
  if (!quoteNumber) return;

  await completeNonDispatchLinesForQuote(conn, quoteNumber);

  const [qiRows] = await conn.execute(
    `SELECT item_code, item_name FROM quotation_items
     WHERE ${sqlQuoteTrimEqColumn("quote_number")}`,
    [quoteNumber],
  );

  const hasPhysicalLines = (qiRows || []).some(
    (qi) => !isNonDispatchQuotationLine(qi.item_name, qi.item_code),
  );

  if (!hasPhysicalLines) {
    await conn.execute(
      `UPDATE neworder SET dispatch_status = 1 WHERE order_id = ?`,
      [orderId],
    );
  }
}

/** Repair legacy orders that already have report_file but open AMC dispatch rows. */
export async function ensureNonDispatchLinesCompletedIfInvoiced(conn, orderId) {
  const [rows] = await conn.execute(
    `SELECT quote_number, report_file, account_status
     FROM neworder WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  const order = rows?.[0];
  if (!order?.quote_number) return;
  const hasReport =
    Number(order.account_status) === 1 ||
    (order.report_file && String(order.report_file).trim() !== "");
  if (!hasReport) return;
  await syncNonDispatchLinesAfterAccountUpload(conn, orderId);
}
