import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

function pushRow(rows, row) {
  rows.push(row);
}

function rowDate(value) {
  if (!value) return null;
  return value;
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spareId = String(
      request.nextUrl.searchParams.get("spare_id") || ""
    ).trim();
    if (!spareId) {
      return NextResponse.json({ error: "spare_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [[spare]] = await conn.execute(
      `SELECT id, spare_number, item_name, purchase_price, sale_price, tax
       FROM spare_list WHERE id = ? LIMIT 1`,
      [spareId]
    );
    if (!spare) {
      return NextResponse.json({ error: "Spare not found" }, { status: 404 });
    }

    const codeId = String(spare.id);
    const codeNum = String(spare.spare_number ?? "").trim();
    const codeName = String(spare.item_name ?? "").trim();
    const itemMatchParams = [codeId, codeNum, codeName];

    const rows = [];

    const [stockRows] = await conn.execute(
      `SELECT id, quantity, net_amount, amount_per_unit, stock_status, note,
              added_date, updated_at, godown
       FROM stock_list
       WHERE spare_id = ?
       ORDER BY COALESCE(updated_at, added_date) DESC
       LIMIT 400`,
      [spareId]
    );

    for (const t of stockRows || []) {
      const st = String(t.stock_status || "").toLowerCase();
      const amt = Number(t.net_amount) || Number(t.amount_per_unit) || 0;
      const qty = Number(t.quantity) || 0;
      const date = rowDate(t.updated_at || t.added_date);
      if (st === "in") {
        pushRow(rows, {
          type: "Purchase",
          ref: `Stock IN #${t.id}`,
          name: t.note || t.godown || "Stock in",
          amount: amt,
          quantity: qty,
          date,
          link: null,
        });
      } else if (st === "out") {
        pushRow(rows, {
          type: "Sale",
          ref: `Stock OUT #${t.id}`,
          name: t.note || "Stock out",
          amount: amt,
          quantity: qty,
          date,
          link: null,
        });
      } else if (st === "transfer") {
        pushRow(rows, {
          type: "Transfer",
          ref: `Transfer #${t.id}`,
          name: t.godown || t.note || "Transfer",
          amount: amt,
          quantity: qty,
          date,
          link: null,
        });
      }
    }

    const [sparePurch] = await conn.execute(
      `SELECT id, quantity, price_per_unit, net_amount, from_company, created_at, status
       FROM spare_stock_request
       WHERE spare_id = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [spareId]
    );
    for (const p of sparePurch || []) {
      pushRow(rows, {
        type: "Purchase",
        ref: `Spare request #${p.id}`,
        name: p.from_company || p.status || "Purchase request",
        amount: Number(p.net_amount) || Number(p.price_per_unit) || 0,
        quantity: Number(p.quantity) || 0,
        date: rowDate(p.created_at),
        link: null,
      });
    }

    const productCodeParams = [codeId, codeNum];
    const [prodPurch] = await conn.execute(
      `SELECT id, product_code, quantity, price_per_unit, net_amount, from_company, created_at
       FROM product_stock_request
       WHERE TRIM(CAST(product_code AS CHAR)) = TRIM(CAST(? AS CHAR))
          OR TRIM(CAST(product_code AS CHAR)) = TRIM(CAST(? AS CHAR))
       ORDER BY created_at DESC
       LIMIT 200`,
      productCodeParams
    );
    for (const p of prodPurch || []) {
      pushRow(rows, {
        type: "Purchase",
        ref: `${p.product_code} (ID: ${p.id})`,
        name: p.from_company || "IN",
        amount: Number(p.net_amount) || Number(p.price_per_unit) || 0,
        quantity: Number(p.quantity) || 0,
        date: rowDate(p.created_at),
        link: null,
      });
    }

    const itemMatchSql = `(
      TRIM(CAST(qi.item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
      OR TRIM(CAST(qi.item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
      OR LOWER(TRIM(qi.item_name)) = LOWER(TRIM(?))
    )`;

    const [quotRows] = await conn.execute(
      `SELECT qr.quote_number, qr.quote_date, qr.company_name, qr.grand_total,
              qi.quantity, qi.price_per_unit, qi.item_name
       FROM quotation_items qi
       INNER JOIN quotations_records qr ON qr.quote_number = qi.quote_number
       WHERE ${itemMatchSql}
       ORDER BY qr.quote_date DESC
       LIMIT 200`,
      itemMatchParams
    );
    for (const q of quotRows || []) {
      pushRow(rows, {
        type: "Quotation",
        ref: q.quote_number,
        name: q.company_name || q.item_name || "",
        amount: Number(q.grand_total) || 0,
        quantity: Number(q.quantity) || 0,
        date: rowDate(q.quote_date),
        link: `/admin-dashboard/quotations/${encodeURIComponent(q.quote_number)}`,
      });
    }

    const [orderRows] = await conn.execute(
      `SELECT no.order_id, no.quote_number, no.client_name, no.created_at, no.totalamt,
              no.approval_status, qi.quantity, qi.price_per_unit, qi.item_name
       FROM neworder no
       INNER JOIN quotation_items qi ON qi.quote_number = no.quote_number
       WHERE ${itemMatchSql}
       ORDER BY no.created_at DESC
       LIMIT 200`,
      itemMatchParams
    );
    const seenOrders = new Set();
    for (const o of orderRows || []) {
      const key = `${o.order_id}|${o.quote_number}`;
      if (seenOrders.has(key)) continue;
      seenOrders.add(key);
      const isApproved =
        String(o.approval_status || "").toLowerCase() === "approved";
      pushRow(rows, {
        type: isApproved ? "Sale" : "Order",
        ref: o.order_id,
        name: o.client_name || o.item_name || "",
        amount: Number(o.totalamt) || Number(o.price_per_unit) || 0,
        quantity: Number(o.quantity) || 0,
        date: rowDate(o.created_at),
        link: `/admin-dashboard/order?search=${encodeURIComponent(o.order_id)}`,
      });
    }

    const [orderDirect] = await conn.execute(
      `SELECT order_id, quote_number, client_name, created_at, totalamt, approval_status,
              quantity, item_name, item_code
       FROM neworder
       WHERE TRIM(CAST(item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
          OR TRIM(CAST(item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
          OR LOWER(TRIM(item_name)) = LOWER(TRIM(?))
       ORDER BY created_at DESC
       LIMIT 100`,
      itemMatchParams
    );
    for (const o of orderDirect || []) {
      const key = `direct-${o.order_id}`;
      if (seenOrders.has(key)) continue;
      seenOrders.add(key);
      const isApproved =
        String(o.approval_status || "").toLowerCase() === "approved";
      pushRow(rows, {
        type: isApproved ? "Sale" : "Order",
        ref: o.order_id,
        name: o.client_name || o.item_name || "",
        amount: Number(o.totalamt) || 0,
        quantity: Number(o.quantity) || 0,
        date: rowDate(o.created_at),
        link: `/admin-dashboard/order?search=${encodeURIComponent(o.order_id)}`,
      });
    }

    const [invRows] = await conn.execute(
      `SELECT i.invoice_number,
              COALESCE(i.order_date, i.invoice_date) AS invoice_date,
              i.customer_name,
              i.grand_total,
              ii.quantity, ii.rate AS price_per_unit, ii.item_name
       FROM invoice_items ii
       INNER JOIN invoices i ON i.id = ii.invoice_id
       WHERE (
         TRIM(CAST(ii.item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
         OR TRIM(CAST(ii.item_code AS CHAR)) = TRIM(CAST(? AS CHAR))
         OR LOWER(TRIM(ii.item_name)) = LOWER(TRIM(?))
       )
       ORDER BY COALESCE(i.order_date, i.invoice_date) DESC
       LIMIT 200`,
      itemMatchParams
    );
    for (const inv of invRows || []) {
      pushRow(rows, {
        type: "Invoice",
        ref: inv.invoice_number,
        name: inv.customer_name || inv.item_name || "",
        amount: Number(inv.grand_total) || Number(inv.price_per_unit) || 0,
        quantity: Number(inv.quantity) || 0,
        date: rowDate(inv.invoice_date),
        link: `/admin-dashboard/invoices/${encodeURIComponent(inv.invoice_number)}`,
      });
    }

    rows.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    return NextResponse.json({ spare, rows });
  } catch (err) {
    console.error("spare item-history:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
