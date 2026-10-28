import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  sqlTrimUtf8Eq,
  sqlTrimUtf8EqColumns,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";

function combinedRow(type, typeColor, data, display) {
  return { type, typeColor, data, display };
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
      `SELECT ps.product_code, ps.quantity, ps.net_amount, ps.stock_status,
              ps.updated_at, ps.added_date, ps.created_at, ps.godown, ps.note
       FROM product_stock ps
       WHERE ${sqlTrimUtf8Eq("ps.product_code")}
       ORDER BY COALESCE(ps.updated_at, ps.added_date, ps.created_at) DESC
       LIMIT 400`,
      [productCode],
    );

    for (const t of stockRows || []) {
      const st = String(t.stock_status || "").toLowerCase();
      const isOut = st === "out";
      const isTransfer = st === "transfer";
      if (!isOut && !isTransfer) continue;

      const transactionType = isTransfer ? "Transfer" : "Sale";
      const typeColor = isTransfer
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

      combined.push(
        combinedRow(transactionType, typeColor, t, {
          main: t.product_code,
          sub1: t.stock_status,
          sub2: `₹${(Number(t.net_amount) || 0).toLocaleString()}`,
          quantity: t.quantity,
          date: rowDate(t.updated_at || t.added_date || t.created_at),
        }),
      );
    }

    const [purchRows] = await conn.execute(
      `SELECT id, product_code, quantity, price_per_unit, net_amount, from_company, created_at
       FROM product_stock_request
       WHERE ${sqlTrimUtf8Eq("product_code")}
       ORDER BY created_at DESC
       LIMIT 200`,
      [productCode],
    );

    for (const p of purchRows || []) {
      combined.push(
        combinedRow("Purchase", "bg-green-100 text-green-800", p, {
          main: `${p.product_code} (ID: ${p.id})`,
          sub1: "IN",
          sub2: `₹${(Number(p.net_amount) || 0).toLocaleString()}`,
          quantity: p.quantity,
          date: rowDate(p.created_at),
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

    combined.sort((a, b) => {
      const da = a.display.date ? new Date(a.display.date) : new Date(0);
      const db = b.display.date ? new Date(b.display.date) : new Date(0);
      return db - da;
    });

    let purchasePricePerUnit = 0;
    const latestPurchase = (purchRows || [])[0];
    if (latestPurchase) {
      purchasePricePerUnit =
        Number(latestPurchase.price_per_unit) ||
        perUnitFromAmount(latestPurchase.net_amount, latestPurchase.quantity);
    }

    let salePricePerUnit = 0;
    const latestSale = (stockRows || []).find((t) => {
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
      combined,
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
