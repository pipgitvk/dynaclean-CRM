import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  sqlTrimUtf8Eq,
  sqlTrimUtf8EqColumns,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { buildInventorySaleCustomerInfo } from "@/lib/inventorySaleCustomerInfo";

function combinedRow(type, typeColor, data, display, sale = null, meta = {}) {
  return { type, typeColor, data, display, sale, ...meta };
}

function rowDate(value) {
  return value || null;
}

function perUnitFromAmount(amt, qty) {
  const amount = Number(amt) || 0;
  const q = Number(qty) || 0;
  if (amount <= 0) return 0;
  return q > 1 ? amount / q : amount;
}

/** Product history: no cancelled / rejected / non-approved orders. */
function shouldShowOrderInProductHistory(orderRow) {
  if (!orderRow) return false;
  if (Number(orderRow.is_cancelled) === 1) return false;
  const status = String(orderRow.approval_status || "").toLowerCase().trim();
  if (status === "rejected") return false;
  return status === "approved";
}

function stockOutLedgerKey(orderId, productCode) {
  return `${String(orderId || "").trim()}|${String(productCode || "").trim()}`;
}

/** When dispatch marked stock_deducted but product_stock OUT row is missing. */
async function fetchDispatchFallbackOutRows(conn, productCode, itemName) {
  const [rows] = await conn.execute(
    `SELECT d.id, d.item_code, d.updated_at, d.created_at, d.godown,
            no.order_id, no.approval_status, no.is_cancelled,
            COALESCE(qi.quantity, 1) AS quantity,
            COALESCE(qi.total_taxable_amt, qi.taxable_price, qi.price_per_unit, 0) AS line_amt
     FROM dispatch d
     INNER JOIN neworder no ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
     INNER JOIN quotation_items qi ON ${sqlTrimUtf8EqColumns("qi.quote_number", "d.quote_number")}
       AND ${sqlTrimUtf8EqColumns("qi.item_code", "d.item_code")}
     WHERE COALESCE(d.stock_deducted, 0) = 1
       AND (
         ${sqlTrimUtf8Eq("d.item_code")}
         OR LOWER(${sqlUtf8TrimExpr("d.item_name")}) = LOWER(TRIM(?))
       )
     ORDER BY d.updated_at DESC
     LIMIT 300`,
    [productCode, itemName],
  );

  return (rows || [])
    .filter((r) => shouldShowOrderInProductHistory(r))
    .map((r) => {
      const qty = Number(r.quantity) || 1;
      const net = Number(r.line_amt) || 0;
      return {
        id: `dispatch-${r.id}`,
        product_code: String(r.item_code || productCode).trim(),
        order_id: r.order_id,
        quantity: qty,
        net_amount: net,
        amount_per_unit: qty > 0 ? net / qty : net,
        stock_status: "OUT",
        updated_at: r.updated_at,
        added_date: r.created_at,
        created_at: r.created_at,
        godown: r.godown,
        note: "Dispatch",
      };
    });
}

async function loadHiddenOrderIdsForProductHistory(conn, stockRows) {
  const ids = [
    ...new Set(
      (stockRows || [])
        .map((r) => String(r.order_id || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return new Set();

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT order_id, is_cancelled, approval_status
     FROM neworder
     WHERE order_id IN (${placeholders})`,
    ids,
  );

  const hidden = new Set();
  for (const row of rows || []) {
    if (!shouldShowOrderInProductHistory(row)) {
      hidden.add(String(row.order_id).trim());
    }
  }
  return hidden;
}

function stockMovementGroupKey(row, isTransfer) {
  const d = rowDate(row.updated_at || row.added_date || row.created_at);
  const day = d ? new Date(d).toISOString().slice(0, 10) : `id-${row.id}`;
  if (isTransfer) {
    return `transfer|${day}|${row.godown || ""}|${row.note || ""}`;
  }
  const orderId = String(row.order_id || "").trim();
  if (orderId) return `out|order|${orderId}`;
  return `out|${day}|${row.godown || ""}`;
}

function aggregateStockMovements(stockRows) {
  const groups = new Map();
  for (const t of stockRows || []) {
    const st = String(t.stock_status || "").toLowerCase();
    const isOut = st === "out";
    const isTransfer = st === "transfer";
    if (!isOut && !isTransfer) continue;

    const key = stockMovementGroupKey(t, isTransfer);
    const net = Number(t.net_amount) || 0;
    const qty = Number(t.quantity) || 0;
    const date = rowDate(t.updated_at || t.added_date || t.created_at);

    let g = groups.get(key);
    if (!g) {
      g = {
        isTransfer,
        order_id: String(t.order_id || "").trim() || null,
        product_code: t.product_code,
        totalQty: 0,
        totalNet: 0,
        latestDate: date,
        statusLabel: isTransfer ? "Transfer" : String(t.stock_status || "OUT"),
      };
      groups.set(key, g);
    }
    g.totalQty += qty;
    g.totalNet += net;
    if (date && (!g.latestDate || new Date(date) > new Date(g.latestDate))) {
      g.latestDate = date;
    }
  }
  return [...groups.values()];
}

function compareByDisplayDateDesc(a, b) {
  const da = a.display?.date ? new Date(a.display.date) : new Date(0);
  const db = b.display?.date ? new Date(b.display.date) : new Date(0);
  return db - da;
}

/**
 * Newest date first across Purchase / Sale / Invoice / etc.
 * Each approved order is one block: parent row then OUT children underneath.
 */
function sortCombinedInventoryHistory(rows) {
  const used = new Set();
  const blocks = [];

  const orderRows = rows.filter((r) => r.rowRole === "order");
  orderRows.sort(compareByDisplayDateDesc);

  for (const orderRow of orderRows) {
    if (used.has(orderRow)) continue;
    const blockRows = [orderRow];
    used.add(orderRow);
    const oid = orderRow.sortOrderId;
    if (oid) {
      const stockLines = rows
        .filter(
          (r) =>
            r.rowRole === "stock_out" &&
            r.sortOrderId === oid &&
            !used.has(r),
        )
        .sort(compareByDisplayDateDesc);
      for (const line of stockLines) {
        blockRows.push(line);
        used.add(line);
      }
    }
    blocks.push({
      sortDate: orderRow.display?.date,
      rows: blockRows,
    });
  }

  for (const row of rows) {
    if (used.has(row)) continue;
    blocks.push({ sortDate: row.display?.date, rows: [row] });
    used.add(row);
  }

  blocks.sort((a, b) =>
    compareByDisplayDateDesc(
      { display: { date: a.sortDate } },
      { display: { date: b.sortDate } },
    ),
  );

  return blocks.flatMap((b) => b.rows);
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productCode = String(
      request.nextUrl.searchParams.get("product_code") || "",
    ).trim();
    const itemNameParam = String(
      request.nextUrl.searchParams.get("item_name") || "",
    ).trim();

    if (!productCode) {
      return NextResponse.json(
        { error: "product_code is required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();
    const { ensureProductListPurchasePriceColumn } = await import(
      "@/lib/productsListSchema"
    );
    await ensureProductListPurchasePriceColumn(conn);
    const [[product]] = await conn.execute(
      `SELECT item_code, item_name, product_number, gst_rate, gem_price,
              gem_last_negotiation_price, dealer_price, last_negotiation_price,
              dp_no_warranty, dp, min_qty, price_per_unit, purchase_price
       FROM products_list
       WHERE ${sqlTrimUtf8Eq("item_code")}
       LIMIT 1`,
      [productCode],
    );

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const itemName = itemNameParam || String(product.item_name || "").trim();
    const combined = [];

    const [stockRows] = await conn.execute(
      `SELECT ps.id, ps.product_code, ps.quantity, ps.net_amount, ps.amount_per_unit,
              ps.stock_status, ps.updated_at, ps.added_date, ps.created_at, ps.godown,
              ps.note, ps.order_id, ps.quotation_id
       FROM product_stock ps
       WHERE ${sqlTrimUtf8Eq("ps.product_code")}
       ORDER BY COALESCE(ps.updated_at, ps.added_date, ps.created_at) DESC
       LIMIT 400`,
      [productCode],
    );

    const ledgerOutKeys = new Set();
    for (const t of stockRows || []) {
      if (String(t.stock_status || "").toLowerCase() === "out" && t.order_id) {
        ledgerOutKeys.add(stockOutLedgerKey(t.order_id, t.product_code));
      }
    }
    const dispatchFallbackOuts = await fetchDispatchFallbackOutRows(
      conn,
      productCode,
      itemName,
    );
    const stockRowsForHistory = [
      ...(stockRows || []),
      ...dispatchFallbackOuts.filter(
        (r) => !ledgerOutKeys.has(stockOutLedgerKey(r.order_id, r.product_code)),
      ),
    ];

    const hiddenOrderIds = await loadHiddenOrderIdsForProductHistory(
      conn,
      stockRowsForHistory,
    );

    const [purchRows] = await conn.execute(
      `SELECT id, product_code, quantity, price_per_unit, net_amount, from_company,
              created_at, invoice_number, invoice_date, received_date
       FROM product_stock_request
       WHERE ${sqlTrimUtf8Eq("product_code")}
       ORDER BY created_at DESC
       LIMIT 200`,
      [productCode],
    );

    for (const p of purchRows || []) {
      const purchaseInvoiceDate =
        rowDate(p.invoice_date) || rowDate(p.received_date);
      const purchaseInvoiceNumber =
        p.invoice_number != null && String(p.invoice_number).trim() !== ""
          ? String(p.invoice_number).trim()
          : null;

      combined.push(
        combinedRow("Purchase", "bg-green-100 text-green-800", p, {
          main: `${p.product_code} (ID: ${p.id})`,
          sub1: "IN",
          sub2: `₹${(Number(p.net_amount) || 0).toLocaleString()}`,
          quantity: p.quantity,
          date: rowDate(p.created_at),
          invoice_number: purchaseInvoiceNumber,
          invoice_date: purchaseInvoiceDate,
        }),
      );
    }

    const [invRows] = await conn.execute(
      `SELECT i.invoice_number, i.customer_name, i.grand_total,
              COALESCE(i.order_date, i.invoice_date) AS invoice_date,
              ii.quantity, ii.rate, ii.item_name
       FROM invoice_items ii
       INNER JOIN invoices i ON i.id = ii.invoice_id
       WHERE (
         ${sqlTrimUtf8Eq("ii.item_code")}
         OR LOWER(${sqlUtf8TrimExpr("ii.item_name")}) = LOWER(TRIM(?))
       )
       ORDER BY COALESCE(i.order_date, i.invoice_date) DESC
       LIMIT 200`,
      [productCode, itemName],
    );

    for (const inv of invRows || []) {
      combined.push(
        combinedRow("Invoice", "bg-purple-100 text-purple-800", inv, {
          main: inv.invoice_number,
          sub1: inv.customer_name || inv.item_name || "",
          sub2: `₹${(Number(inv.grand_total) || 0).toLocaleString()}`,
          quantity: Number(inv.quantity) || 0,
          date: rowDate(inv.invoice_date),
          id: inv.invoice_number,
        }),
      );
    }

    const [quotRows] = await conn.execute(
      `SELECT qr.quote_number, qr.quote_date, qr.company_name, qr.grand_total,
              qi.quantity, qi.item_name
       FROM quotation_items qi
       INNER JOIN quotations_records qr ON ${sqlTrimUtf8EqColumns("qr.quote_number", "qi.quote_number")}
       WHERE (
         ${sqlTrimUtf8Eq("qi.item_code")}
         OR LOWER(${sqlUtf8TrimExpr("qi.item_name")}) = LOWER(TRIM(?))
       )
       ORDER BY qr.quote_date DESC
       LIMIT 200`,
      [productCode, itemName],
    );

    for (const q of quotRows || []) {
      combined.push(
        combinedRow("Quotation", "bg-orange-100 text-orange-800", q, {
          main: q.quote_number,
          sub1: q.company_name || q.item_name || "",
          sub2: `₹${(Number(q.grand_total) || 0).toLocaleString()}`,
          quantity: Number(q.quantity) || 0,
          date: rowDate(q.quote_date),
          id: q.quote_number,
        }),
      );
    }

    const itemMatchSql = `(
      ${sqlTrimUtf8Eq("qi.item_code")}
      OR LOWER(${sqlUtf8TrimExpr("qi.item_name")}) = LOWER(TRIM(?))
    )`;
    const seenOrderIds = new Set();
    const orderSaleOrderIds = new Set();
    const orderSaleByOrderId = new Map();

    const [orderRows] = await conn.execute(
      `SELECT no.order_id, no.quote_number, no.client_name,
              COALESCE(NULLIF(TRIM(no.company_name), ''), NULLIF(TRIM(qr.company_name), '')) AS company_name,
              COALESCE(no.customer_id, qr.customer_id) AS customer_id,
              no.created_at, no.totalamt, no.approval_status,
              no.is_cancelled,
              qi.quantity, qi.price_per_unit, qi.item_name
       FROM neworder no
       INNER JOIN quotation_items qi ON ${sqlTrimUtf8EqColumns("qi.quote_number", "no.quote_number")}
       LEFT JOIN quotations_records qr ON ${sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number")}
       WHERE ${itemMatchSql}
       ORDER BY no.created_at DESC
       LIMIT 200`,
      [productCode, itemName],
    );

    for (const o of orderRows || []) {
      const oid = String(o.order_id || "").trim();
      if (!oid || seenOrderIds.has(oid)) continue;
      if (!shouldShowOrderInProductHistory(o)) continue;
      seenOrderIds.add(oid);
      const sale = buildInventorySaleCustomerInfo(o);
      if (oid) {
        orderSaleOrderIds.add(oid);
        orderSaleByOrderId.set(oid, sale);
      }
      combined.push(
        combinedRow(
          "Sale",
          "bg-red-100 text-red-800",
          o,
          {
            main: o.order_id,
            sub1: o.client_name || o.item_name || "",
            sub2: `₹${(Number(o.totalamt) || Number(o.price_per_unit) || 0).toLocaleString()}`,
            quantity: Number(o.quantity) || 0,
            date: rowDate(o.created_at),
            id: o.order_id,
          },
          sale,
          { rowRole: "order", sortOrderId: oid },
        ),
      );
    }

    const [orderDirect] = await conn.execute(
      `SELECT no.order_id, no.quote_number, no.client_name,
              COALESCE(NULLIF(TRIM(no.company_name), ''), NULLIF(TRIM(qr.company_name), '')) AS company_name,
              COALESCE(no.customer_id, qr.customer_id) AS customer_id,
              no.created_at, no.totalamt, no.approval_status, no.is_cancelled,
              no.quantity, no.item_name, no.item_code
       FROM neworder no
       LEFT JOIN quotations_records qr ON ${sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number")}
       WHERE (
         ${sqlTrimUtf8Eq("no.item_code")}
         OR LOWER(${sqlUtf8TrimExpr("no.item_name")}) = LOWER(TRIM(?))
       )
       ORDER BY no.created_at DESC
       LIMIT 100`,
      [productCode, itemName],
    );

    for (const o of orderDirect || []) {
      const oid = String(o.order_id || "").trim();
      if (!oid || seenOrderIds.has(oid)) continue;
      if (!shouldShowOrderInProductHistory(o)) continue;
      seenOrderIds.add(oid);
      const sale = buildInventorySaleCustomerInfo(o);
      if (oid) {
        orderSaleOrderIds.add(oid);
        if (!orderSaleByOrderId.has(oid)) {
          orderSaleByOrderId.set(oid, sale);
        }
      }
      combined.push(
        combinedRow(
          "Sale",
          "bg-red-100 text-red-800",
          o,
          {
            main: o.order_id,
            sub1: o.client_name || o.item_name || "",
            sub2: `₹${(Number(o.totalamt) || 0).toLocaleString()}`,
            quantity: Number(o.quantity) || 0,
            date: rowDate(o.created_at),
            id: o.order_id,
          },
          sale,
          { rowRole: "order", sortOrderId: oid },
        ),
      );
    }

    for (const g of aggregateStockMovements(stockRowsForHistory)) {
      const oid = g.order_id;
      if (oid && hiddenOrderIds.has(oid)) {
        continue;
      }

      const isChildOut =
        !g.isTransfer && Boolean(oid && orderSaleOrderIds.has(oid));

      let sale = null;
      if (!isChildOut && oid) {
        sale = orderSaleByOrderId.get(oid) ?? null;
        if (!sale) {
          const [[orderRow]] = await conn.execute(
            `SELECT no.order_id, no.client_name,
                    COALESCE(NULLIF(TRIM(no.company_name), ''), NULLIF(TRIM(qr.company_name), '')) AS company_name,
                    COALESCE(no.customer_id, qr.customer_id) AS customer_id,
                    no.created_at, no.approval_status, no.is_cancelled
             FROM neworder no
             LEFT JOIN quotations_records qr ON ${sqlTrimUtf8EqColumns("qr.quote_number", "no.quote_number")}
             WHERE no.order_id = ? LIMIT 1`,
            [oid],
          );
          if (orderRow && shouldShowOrderInProductHistory(orderRow)) {
            sale = buildInventorySaleCustomerInfo(orderRow);
            orderSaleByOrderId.set(oid, sale);
          } else if (orderRow && !shouldShowOrderInProductHistory(orderRow)) {
            continue;
          }
        }
      }

      const transactionType = g.isTransfer ? "Transfer" : "Sale";
      const typeColor = g.isTransfer
        ? "bg-yellow-100 text-yellow-800"
        : isChildOut
          ? "bg-red-50 text-red-700"
          : "bg-red-100 text-red-800";

      const refLabel =
        !g.isTransfer && oid
          ? `${g.product_code} · ${oid}`
          : g.product_code;

      combined.push(
        combinedRow(
          isChildOut ? "OUT" : transactionType,
          typeColor,
          g,
          {
            main: refLabel,
            sub1: g.isTransfer ? "Transfer" : g.statusLabel,
            sub2: `₹${g.totalNet.toLocaleString()}`,
            quantity: g.totalQty,
            date: g.latestDate,
            id: oid || undefined,
          },
          sale,
          {
            rowRole: g.isTransfer ? "transfer" : "stock_out",
            sortOrderId: oid || null,
            isChild: isChildOut,
          },
        ),
      );
    }

    const finalCombined = sortCombinedInventoryHistory(combined);

    let purchasePricePerUnit = 0;
    const latestPurchase = (purchRows || [])[0];
    if (latestPurchase) {
      purchasePricePerUnit =
        Number(latestPurchase.price_per_unit) ||
        perUnitFromAmount(latestPurchase.net_amount, latestPurchase.quantity);
    }

    let salePricePerUnit = 0;
    const latestSale = (stockRowsForHistory || []).find((t) => {
      const st = String(t.stock_status || "").toLowerCase();
      return st === "out" && Number(t.net_amount) > 0;
    });
    if (latestSale) {
      salePricePerUnit = perUnitFromAmount(
        latestSale.net_amount,
        latestSale.quantity,
      );
    }

    const [[stockSummary]] = await conn.execute(
      `SELECT total_quantity AS total, Delhi AS delhi, South AS south
       FROM product_stock_summary
       WHERE ${sqlTrimUtf8Eq("product_code")}
       LIMIT 1`,
      [productCode],
    );

    const stock = {
      total: Number(stockSummary?.total) || 0,
      delhi: Number(stockSummary?.delhi) || 0,
      south: Number(stockSummary?.south) || 0,
    };

    return NextResponse.json({
      product,
      combined: finalCombined,
      purchasePricePerUnit,
      masterPurchasePrice: Number(product?.purchase_price) || 0,
      salePricePerUnit,
      stock,
    });
  } catch (err) {
    console.error("products item-history:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
