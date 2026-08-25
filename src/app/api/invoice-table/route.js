import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
// import { cookies } from "next/headers";

/** Parse linked_trans_ids JSON or plain string → array of strings */
function parseTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parse linked_purchase_ids (JSON, comma-separated, or single token) → array of strings */
function parseLinkedPurchaseIds(raw) {
  if (!raw) return [];
  let arr = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!arr) return [];
  const keys = [];
  for (const v of arr) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      keys.push(s);
    } else if (/^\d+$/.test(s)) {
      keys.push(`IP${s}`);
    }
  }
  return keys;
}

const LATEST_ORDER_JOIN = `
  LEFT JOIN quotations_records qr
    ON qr.quote_number COLLATE utf8mb4_unicode_ci = no.quote_number COLLATE utf8mb4_unicode_ci
`;

const LATEST_ORDER_MATCH = `
  (
    no.invoice_number COLLATE utf8mb4_unicode_ci = invoices.invoice_number COLLATE utf8mb4_unicode_ci
    OR no.quote_number COLLATE utf8mb4_unicode_ci = CAST(invoices.quotation_id AS CHAR) COLLATE utf8mb4_unicode_ci
    OR CAST(qr.\`S.No.\` AS CHAR) = CAST(invoices.quotation_id AS CHAR)
  )
`;

const LATEST_ORDER_ORDER = `
  COALESCE(no.invoice_date, DATE(no.created_at)) DESC,
  no.created_at DESC,
  no.id DESC
`;

function buildLatestOrderStatusSql() {
  return `
    (
      SELECT
        CASE
          WHEN no.is_cancelled = 1
               OR LOWER(COALESCE(no.approval_status, '')) = 'rejected'
          THEN 'CANCELLED'
          WHEN LOWER(COALESCE(no.payment_status, '')) IN ('paid')
          THEN 'PAID'
          WHEN LOWER(COALESCE(no.payment_status, '')) IN ('partial', 'partial paid', 'partially paid')
          THEN 'PARTIAL PAID'
          ELSE NULL
        END
      FROM neworder no
      ${LATEST_ORDER_JOIN}
      WHERE ${LATEST_ORDER_MATCH}
      ORDER BY ${LATEST_ORDER_ORDER}
      LIMIT 1
    )
  `;
}

function buildLatestOrderIdSql() {
  return `
    (
      SELECT no.order_id
      FROM neworder no
      ${LATEST_ORDER_JOIN}
      WHERE ${LATEST_ORDER_MATCH}
      ORDER BY ${LATEST_ORDER_ORDER}
      LIMIT 1
    )
  `;
}

function buildDerivedStatusSql(latestOrderStatusSql) {
  return `
    COALESCE(
      ${latestOrderStatusSql},
      CASE
        WHEN COALESCE(status, '') <> '' THEN status
        WHEN COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) = 0 AND grand_total > 0 THEN 'PAID'
        WHEN COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) > 0
             AND COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) < grand_total THEN 'PARTIAL PAID'
        ELSE NULL
      END
    )
  `;
}

function buildInvoiceSelectSql(derivedStatusSql, latestOrderIdSql) {
  return `
    id,
    invoice_number,
    quotation_id,
    customer_name AS buyer_name,
    customer_id,
    gst_number,
    gst_consignee,
    employee_name,
    parent_id,
    invoice_date,
    invoice_date AS order_date,
    (cgst + sgst + igst) AS tax_amount,
    grand_total,
    amount_paid,
    COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) AS balance_amount,
    created_at,
    type,
    (${derivedStatusSql}) AS status,
    (${latestOrderIdSql}) AS order_id
  `;
}

function buildSimpleInvoiceSelectSql() {
  return `
    id,
    invoice_number,
    quotation_id,
    customer_name AS buyer_name,
    customer_id,
    gst_number,
    gst_consignee,
    employee_name,
    parent_id,
    invoice_date,
    invoice_date AS order_date,
    (cgst + sgst + igst) AS tax_amount,
    grand_total,
    amount_paid,
    COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) AS balance_amount,
    created_at,
    type,
    status
  `;
}

function mapOrderToStatus(order) {
  if (!order) return null;
  if (
    order.is_cancelled === 1 ||
    String(order.approval_status || "").toLowerCase() === "rejected"
  ) {
    return "CANCELLED";
  }
  const paymentStatus = String(order.payment_status || "").toLowerCase();
  if (paymentStatus === "paid") return "PAID";
  if (
    paymentStatus === "partial" ||
    paymentStatus === "partial paid" ||
    paymentStatus === "partially paid"
  ) {
    return "PARTIAL PAID";
  }
  return null;
}

function deriveInvoiceStatus(invoice, order) {
  const fromOrder = mapOrderToStatus(order);
  if (fromOrder) return fromOrder;

  if (invoice.status && String(invoice.status).trim() !== "") {
    return invoice.status;
  }

  const grandTotal = Number(invoice.grand_total) || 0;
  const balance =
    Number(invoice.balance_amount) ||
    grandTotal - Number(invoice.amount_paid || 0);

  if (balance === 0 && grandTotal > 0) return "PAID";
  if (balance > 0 && balance < grandTotal) return "PARTIAL PAID";
  return null;
}

function orderMatchesInvoice(invoice, order) {
  if (
    invoice.invoice_number &&
    order.invoice_number &&
    invoice.invoice_number === order.invoice_number
  ) {
    return true;
  }

  if (invoice.quotation_id == null || invoice.quotation_id === "") {
    return false;
  }

  const quotationId = String(invoice.quotation_id);
  if (order.quote_number != null && String(order.quote_number) === quotationId) {
    return true;
  }
  if (order.qr_sno != null && String(order.qr_sno) === quotationId) {
    return true;
  }
  return false;
}

function compareOrdersLatest(a, b) {
  const dateA = a.invoice_date || String(a.created_at || "").slice(0, 10);
  const dateB = b.invoice_date || String(b.created_at || "").slice(0, 10);
  if (dateA !== dateB) return dateB.localeCompare(dateA);

  const createdA = String(a.created_at || "");
  const createdB = String(b.created_at || "");
  if (createdA !== createdB) return createdB.localeCompare(createdA);

  return Number(b.id || 0) - Number(a.id || 0);
}

async function bulkFetchLatestOrdersForInvoices(conn, invoices) {
  if (!invoices.length) return new Map();

  const invoiceNumbers = [
    ...new Set(invoices.map((inv) => inv.invoice_number).filter(Boolean)),
  ];
  const quotationIds = [
    ...new Set(
      invoices
        .map((inv) => inv.quotation_id)
        .filter((value) => value != null && value !== ""),
    ),
  ];

  if (!invoiceNumbers.length && !quotationIds.length) return new Map();

  const conditions = [];
  const values = [];

  if (invoiceNumbers.length) {
    conditions.push(
      `no.invoice_number COLLATE utf8mb4_unicode_ci IN (${invoiceNumbers.map(() => "?").join(",")})`,
    );
    values.push(...invoiceNumbers);
  }

  if (quotationIds.length) {
    const placeholders = quotationIds.map(() => "?").join(",");
    conditions.push(
      `no.quote_number COLLATE utf8mb4_unicode_ci IN (${placeholders})`,
    );
    values.push(...quotationIds.map(String));
    conditions.push(`CAST(qr.\`S.No.\` AS CHAR) IN (${placeholders})`);
    values.push(...quotationIds.map(String));
  }

  const [orders] = await conn.execute(
    `SELECT
      no.id,
      no.order_id,
      no.invoice_number,
      no.quote_number,
      no.invoice_date,
      no.created_at,
      no.is_cancelled,
      no.approval_status,
      no.payment_status,
      CAST(qr.\`S.No.\` AS CHAR) AS qr_sno
    FROM neworder no
    ${LATEST_ORDER_JOIN}
    WHERE ${conditions.join(" OR ")}`,
    values,
  );

  const result = new Map();
  for (const invoice of invoices) {
    const matches = orders.filter((order) => orderMatchesInvoice(invoice, order));
    if (!matches.length) continue;
    matches.sort(compareOrdersLatest);
    result.set(invoice.id, matches[0]);
  }
  return result;
}

function applyOrderMetaToRows(rows, orderMap) {
  return rows.map((invoice) => {
    const order = orderMap.get(invoice.id);
    return {
      ...invoice,
      status: deriveInvoiceStatus(invoice, order),
      order_id: order?.order_id ?? null,
    };
  });
}

async function fetchInvoicesFast(
  conn,
  { where, values, sortBy, sortOrder, limit, offset },
) {
  const [rows] = await conn.execute(
    `
    SELECT ${buildSimpleInvoiceSelectSql()}
    FROM invoices
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
    `,
    [...values, limit, offset],
  );

  console.time("[invoice-table] bulk-orders");
  const orderMap = await bulkFetchLatestOrdersForInvoices(conn, rows);
  console.timeEnd("[invoice-table] bulk-orders");

  return applyOrderMetaToRows(rows, orderMap);
}

async function fetchInvoicesFastWithStatusFilter(
  conn,
  { where, values, sortBy, sortOrder, limit, offset, statusFilter },
) {
  const [[countRow]] = await conn.execute(
    `SELECT COUNT(*) AS total FROM invoices ${where}`,
    values,
  );
  const candidateTotal = Number(countRow.total || 0);

  if (candidateTotal === 0) return [];

  // Small date/filter windows: one query + one bulk order lookup beats correlated SQL.
  if (candidateTotal <= 3000) {
    const [candidates] = await conn.execute(
      `
      SELECT ${buildSimpleInvoiceSelectSql()}
      FROM invoices
      ${where}
      ORDER BY ${sortBy} ${sortOrder}
      `,
      values,
    );

    console.time("[invoice-table] bulk-orders-filtered");
    const orderMap = await bulkFetchLatestOrdersForInvoices(conn, candidates);
    console.timeEnd("[invoice-table] bulk-orders-filtered");

    return applyOrderMetaToRows(candidates, orderMap)
      .filter((row) => row.status === statusFilter)
      .slice(offset, offset + limit);
  }

  const batchSize = Math.max(limit * 5, 300);
  let dbOffset = 0;
  let skipped = 0;
  const matched = [];

  while (matched.length < limit) {
    const [batch] = await conn.execute(
      `
      SELECT ${buildSimpleInvoiceSelectSql()}
      FROM invoices
      ${where}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
      `,
      [...values, batchSize, dbOffset],
    );

    if (!batch.length) break;

    const orderMap = await bulkFetchLatestOrdersForInvoices(conn, batch);
    const enriched = applyOrderMetaToRows(batch, orderMap);

    for (const row of enriched) {
      if (row.status !== statusFilter) continue;
      if (skipped < offset) {
        skipped++;
        continue;
      }
      matched.push(row);
      if (matched.length >= limit) break;
    }

    dbOffset += batch.length;
    if (batch.length < batchSize) break;
  }

  return matched;
}

function getRelatedInvoicesForRow(invoice, relatedById) {
  const relatedInvoices = [{ id: invoice.id, number: invoice.invoice_number }];
  if (invoice.parent_id) {
    const parent = relatedById.get(invoice.parent_id);
    if (parent) {
      relatedInvoices.push({ id: parent.id, number: parent.invoice_number });
    }
    for (const inv of relatedById.values()) {
      if (inv.parent_id === invoice.parent_id && inv.id !== invoice.id) {
        relatedInvoices.push({ id: inv.id, number: inv.invoice_number });
      }
    }
  } else {
    for (const inv of relatedById.values()) {
      if (inv.parent_id === invoice.id) {
        relatedInvoices.push({ id: inv.id, number: inv.invoice_number });
      }
    }
  }

  const uniqueRelatedInvoices = [];
  const seenInvoiceIds = new Set();
  for (const inv of relatedInvoices) {
    if (!seenInvoiceIds.has(inv.id)) {
      seenInvoiceIds.add(inv.id);
      uniqueRelatedInvoices.push(inv);
    }
  }
  return uniqueRelatedInvoices;
}

function statementMatchesInvoice(stmt, inv) {
  if (inv.number && stmt.invoice_number) {
    const stmtNumbers = String(stmt.invoice_number)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (stmtNumbers.includes(inv.number)) return true;
  }
  const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
  return tokens.includes(`IP${inv.id}`);
}

async function enrichInvoicesWithDetails(conn, rows) {
  if (!rows.length) return [];

  const invoiceMap = {};
  const invoiceNumberToIdMap = {};
  for (const inv of rows) {
    invoiceMap[inv.id] = { ...inv };
    if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
  }

  const pageIds = rows.map((inv) => inv.id);
  const parentIds = [...new Set(rows.map((inv) => inv.parent_id).filter(Boolean))];
  const anchorIds = [...new Set([...pageIds, ...parentIds])];

  console.time("[invoice-table] related-invoices");
  let relatedRows = [];
  if (anchorIds.length > 0) {
    const placeholders = anchorIds.map(() => "?").join(",");
    const [result] = await conn.execute(
      `SELECT id, invoice_number, grand_total, parent_id
       FROM invoices
       WHERE id IN (${placeholders}) OR parent_id IN (${placeholders})`,
      [...anchorIds, ...anchorIds],
    );
    relatedRows = result;
  }
  console.timeEnd("[invoice-table] related-invoices");

  const relatedById = new Map();
  for (const inv of relatedRows) {
    relatedById.set(inv.id, inv);
    if (!invoiceMap[inv.id]) invoiceMap[inv.id] = inv;
    if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
  }

  const relatedInvoiceIds = Object.keys(invoiceMap).map(Number);
  const relatedInvoiceNumbers = [
    ...new Set(
      Object.values(invoiceMap)
        .map((inv) => inv.invoice_number)
        .filter(Boolean),
    ),
  ];

  console.time("[invoice-table] statements");
  let allLinkedStatements = [];
  if (relatedInvoiceIds.length > 0 || relatedInvoiceNumbers.length > 0) {
    const stmtWhere = [];
    const stmtValues = [];
    if (relatedInvoiceNumbers.length > 0) {
      stmtWhere.push(
        `invoice_number IN (${relatedInvoiceNumbers.map(() => "?").join(",")})`,
      );
      stmtValues.push(...relatedInvoiceNumbers);
    }
    if (relatedInvoiceIds.length > 0) {
      const likeParts = relatedInvoiceIds.map(() => "linked_purchase_ids LIKE ?");
      stmtWhere.push(`(${likeParts.join(" OR ")})`);
      stmtValues.push(...relatedInvoiceIds.map((id) => `%IP${id}%`));
    }
    const [statements] = await conn.execute(
      `SELECT id, trans_id, date, description, amount, invoice_status, linked_purchase_ids, invoice_number
       FROM statements
       WHERE ${stmtWhere.join(" OR ")}`,
      stmtValues,
    );
    allLinkedStatements = statements;
  }
  console.timeEnd("[invoice-table] statements");

  const transToInvoiceIdsMap = {};
  for (const stmt of allLinkedStatements) {
    const linkedIds = [];
    const seenIds = new Set();
    const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
    for (const token of tokens) {
      if (token.startsWith("IP")) {
        const invId = parseInt(token.replace("IP", ""), 10);
        if (invoiceMap[invId] && !seenIds.has(invId)) {
          linkedIds.push(invId);
          seenIds.add(invId);
        }
      }
    }
    const stmtInvoiceNumbers = String(stmt.invoice_number || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const num of stmtInvoiceNumbers) {
      if (invoiceNumberToIdMap[num] && !seenIds.has(invoiceNumberToIdMap[num])) {
        linkedIds.push(invoiceNumberToIdMap[num]);
        seenIds.add(invoiceNumberToIdMap[num]);
      }
    }
    transToInvoiceIdsMap[stmt.trans_id] = linkedIds;
  }

  const allocationMap = {};
  const invoiceRemainingMap = {};
  for (const invId in invoiceMap) {
    invoiceRemainingMap[invId] = Number(invoiceMap[invId].grand_total) || 0;
  }

  for (const stmt of allLinkedStatements) {
    const linkedInvIds = transToInvoiceIdsMap[stmt.trans_id] || [];
    if (linkedInvIds.length === 0) continue;

    let remainingToAllocate = Math.abs(Number(stmt.amount) || 0);
    const invoicePaidForStmt = {};
    for (const invId of linkedInvIds) {
      if (remainingToAllocate <= 0) break;
      const invRemaining = invoiceRemainingMap[invId] || 0;
      if (invRemaining <= 0) continue;
      const toAllocate = Math.min(invRemaining, remainingToAllocate);
      if (toAllocate > 0) {
        invoicePaidForStmt[invId] = toAllocate;
        invoiceRemainingMap[invId] -= toAllocate;
        remainingToAllocate -= toAllocate;
      }
    }
    for (const invId of linkedInvIds) {
      const key = `${invId}-${stmt.trans_id}`;
      allocationMap[key] = invoicePaidForStmt[invId] || 0;
    }
  }

  console.time("[invoice-table] invoice-items");
  const itemsByInvoiceId = new Map();
  if (pageIds.length > 0) {
    const placeholders = pageIds.map(() => "?").join(",");
    const [items] = await conn.execute(
      `SELECT invoice_id, item_code as product_code, product_number, item_name, quantity, rate as price_per_unit, image_url as imageUrl, hsn_code, taxable_value, cgst_amount, sgst_amount, igst_amount
       FROM invoice_items
       WHERE invoice_id IN (${placeholders})`,
      pageIds,
    );
    for (const item of items) {
      if (!itemsByInvoiceId.has(item.invoice_id)) {
        itemsByInvoiceId.set(item.invoice_id, []);
      }
      itemsByInvoiceId.get(item.invoice_id).push(item);
    }
  }
  console.timeEnd("[invoice-table] invoice-items");

  return rows.map((invoice) => {
    const uniqueRelatedInvoices = getRelatedInvoicesForRow(invoice, relatedById);
    const linkedStatements = [];
    const seenStmtIds = new Set();
    for (const inv of uniqueRelatedInvoices) {
      for (const stmt of allLinkedStatements) {
        if (!seenStmtIds.has(stmt.id) && statementMatchesInvoice(stmt, inv)) {
          seenStmtIds.add(stmt.id);
          linkedStatements.push(stmt);
        }
      }
    }

    const totalLinkedAmount = linkedStatements.reduce((sum, stmt) => {
      const key = `${invoice.id}-${stmt.trans_id}`;
      return sum + (allocationMap[key] || 0);
    }, 0);
    const newBalanceAmount = Math.max(
      0,
      Number(invoice.grand_total) - totalLinkedAmount,
    );

    const grandTotal = Number(invoice.grand_total) || 0;
    let derivedPaymentStatus = invoice.payment_status || "UNPAID";
    if (grandTotal > 0) {
      if (newBalanceAmount === 0) {
        derivedPaymentStatus = "PAID";
      } else if (newBalanceAmount < grandTotal) {
        derivedPaymentStatus = "PARTIAL";
      } else {
        derivedPaymentStatus = "UNPAID";
      }
    }

    return {
      ...invoice,
      items: itemsByInvoiceId.get(invoice.id) || [],
      linkedStatements,
      balance_amount: newBalanceAmount,
      payment_status: derivedPaymentStatus,
    };
  });
}

export async function GET(req) {
  try {
    // const cookieStore = cookies();
    // const token = cookieStore.get("token")?.value;
    // if (!token) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const offset = (page - 1) * limit;

    const sortByRaw = searchParams.get("sort") || "created_at";
    const allowedSort = ["created_at", "invoice_date", "invoice_number"];
    const sortBy = allowedSort.includes(sortByRaw) ? sortByRaw : "created_at";
    const sortOrder = searchParams.get("order") === "asc" ? "ASC" : "DESC";

    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const invoiceType = searchParams.get("invoiceType");
    const statusFilter = searchParams.get("status");
    const includeDetails = searchParams.get("includeDetails") !== "0";
    const includeCount = searchParams.get("includeCount") !== "0";

    console.time("[invoice-table] total");
    const conn = await getDbConnection();

    let where = "WHERE 1=1";
    const values = [];

    if (search) {
      where += " AND (invoice_number LIKE ? OR customer_name LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    if (fromDate) {
      where += " AND invoice_date >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      where += " AND invoice_date <= ?";
      values.push(toDate);
    }

    if (invoiceType) {
      where += " AND type = ?";
      values.push(invoiceType);
    }

    let total = null;
    let totalPages = null;
    let rows;

    console.time("[invoice-table] main-query");
    if (statusFilter) {
      rows = await fetchInvoicesFastWithStatusFilter(conn, {
        where,
        values,
        sortBy,
        sortOrder,
        limit,
        offset,
        statusFilter,
      });
    } else {
      rows = await fetchInvoicesFast(conn, {
        where,
        values,
        sortBy,
        sortOrder,
        limit,
        offset,
      });
    }
    console.timeEnd("[invoice-table] main-query");

    let data;
    if (!includeDetails) {
      data = rows.map((invoice) => ({
        ...invoice,
        items: [],
        linkedStatements: [],
      }));
    } else {
      console.time("[invoice-table] enrich");
      data = await enrichInvoicesWithDetails(conn, rows);
      console.timeEnd("[invoice-table] enrich");
    }

    const hasMore = rows.length === limit;
    console.timeEnd("[invoice-table] total");

    return NextResponse.json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (err) {
    console.error("Invoice list error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch invoices",
        detail: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  let conn;
  try {
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    console.log("Invoice creation request body:", { quotation_id: body.quotation_id, customer_name: body.customer_name });

    const {
      quotation_id = null,
      invoice_date,
      order_date = null,
      due_date,
      customer_name,
      customer_email = null,
      customer_phone = null,
      billing_address,
      shipping_address = null,
      Consignee = null,
      Consignee_Contact = null,
      gst_number = null,
      state = null,
      state_code = null,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      total_tax,
      round_off,
      grand_total,
      amount_paid = 0,
      balance_amount,
      payment_status = "UNPAID",
      notes = null,
      terms_conditions = null,
      buyers_order_no = null,
      eway_bill_no = null,
      delivery_challan_no = null,
      linked_trans_ids = null,
      customer_id: bodyCustomerId,
      cgst_rate: bodyCgstRate = 0,
      sgst_rate: bodySgstRate = 0,
      igst_rate: bodyIgstRate = 0,
      invoice_type = "tax",
      status: bodyStatus = null,
    } = body;

    const customerIdSql =
      bodyCustomerId != null && String(bodyCustomerId).trim() !== ""
        ? String(bodyCustomerId).trim()
        : null;

    const linkedTransIdsJson =
      linked_trans_ids && linked_trans_ids.length > 0
        ? JSON.stringify(linked_trans_ids)
        : null;

    const pool = await getDbConnection();
    conn = await pool.getConnection();

    // Fetch employee name from quotation if quotation_id is provided
    let employeeName = payload?.username || null;
    console.log("Initial employeeName from session:", employeeName);
    console.log("quotation_id:", quotation_id);
    if (quotation_id) {
      try {
        // First try to find by quote_number
        let [quoteResult] = await conn.execute(
          "SELECT emp_name FROM quotations_records WHERE quote_number = ?",
          [quotation_id]
        );
        console.log("Quotation query result (by quote_number):", quoteResult);

        // If not found by quote_number, try by primary key S.No.
        if (quoteResult.length === 0) {
          [quoteResult] = await conn.execute(
            "SELECT emp_name FROM quotations_records WHERE `S.No.` = ?",
            [quotation_id]
          );
          console.log("Quotation query result (by S.No.):", quoteResult);
        }

        if (quoteResult.length > 0 && quoteResult[0].emp_name) {
          employeeName = quoteResult[0].emp_name;
          console.log("Employee name from quotation (emp_name):", employeeName);
        } else {
          console.log("Quotation found but no emp_name, using session username:", employeeName);
        }
      } catch (err) {
        console.error("Failed to fetch employee name from quotation:", err);
        // Fall back to session username
      }
    } else {
      console.log("No quotation_id provided, using session username:", employeeName);
    }

    await conn.beginTransaction();

    // Generate invoice number from DB sequence (no hardcoded segment)
    const now = new Date();
    // Indian FY: Apr–Mar → e.g. DYN/2026-27/001 (not calendar month like 2026-04)
    const getDefaultPrefix = (date) => {
      const month = date.getMonth() + 1; // 1–12
      const year = date.getFullYear();
      const startYear = month >= 4 ? year : year - 1;
      const endYear2Digits = String((startYear + 1) % 100).padStart(2, "0");
      return `DYN/${startYear}-${endYear2Digits}/`;
    };

    // For performa invoices, use DYN/PI- prefix
    const getPerformaPrefix = () => {
      return `DYN/PI-`;
    };

    const serverInvoiceDate = invoice_date || now.toISOString().split("T")[0];
    const serverOrderDate =
      order_date != null && String(order_date).trim() !== ""
        ? String(order_date).slice(0, 10)
        : null;
    const dateForPrefix = invoice_date
      ? new Date(`${String(invoice_date).slice(0, 10)}T12:00:00`)
      : now;
    
    // Choose prefix based on invoice type
    const invoicePrefix = invoice_type === "performa" ? getPerformaPrefix() : getDefaultPrefix(dateForPrefix);

    let attempt = 0;
    let finalInvoiceNumber = "";
    let invoiceId = null;

    while (attempt < 5) {
      const [existing] = await conn.execute(
        `SELECT invoice_number FROM invoices 
         WHERE invoice_number LIKE ? 
         ORDER BY invoice_number DESC 
         LIMIT 1`,
        [`${invoicePrefix}%`],
      );

      let increment = 1;
      if (existing.length > 0) {
        const lastInvoice = existing[0].invoice_number || "";
        const lastIncrement = parseInt(
          lastInvoice.replace(invoicePrefix, ""),
          10,
        );
        if (!Number.isNaN(lastIncrement)) increment = lastIncrement + 1;
      }

      // Format the number with padding (3 digits for tax invoices, 3 digits for performa)
      const paddingLength = 3;
      finalInvoiceNumber = `${invoicePrefix}${increment.toString().padStart(paddingLength, "0")}`;

      try {
        // Insert the invoice header
        // Ensure linked_trans_ids column exists
        try {
          await conn.execute("SELECT linked_trans_ids FROM invoices LIMIT 1");
        } catch (_) {
          try {
            await conn.execute(
              "ALTER TABLE invoices ADD COLUMN linked_trans_ids TEXT NULL"
            );
          } catch (__) {}
        }
        try {
          await conn.execute("SELECT customer_id FROM invoices LIMIT 1");
        } catch (_) {
          try {
            await conn.execute(
              "ALTER TABLE invoices ADD COLUMN customer_id VARCHAR(64) NULL",
            );
          } catch (__) {}
        }

        // Ensure cgst_rate, sgst_rate, igst_rate columns exist
        try {
          await conn.execute("SELECT cgst_rate FROM invoices LIMIT 1");
        } catch (_) {
          try {
            await conn.execute("ALTER TABLE invoices ADD COLUMN cgst_rate DECIMAL(5,2) NULL DEFAULT 0");
            await conn.execute("ALTER TABLE invoices ADD COLUMN sgst_rate DECIMAL(5,2) NULL DEFAULT 0");
            await conn.execute("ALTER TABLE invoices ADD COLUMN igst_rate DECIMAL(5,2) NULL DEFAULT 0");
          } catch (__) {}
        }

        // Check if employee_name column exists
        let employeeNameColumnExists = false;
        try {
          await conn.execute("SELECT employee_name FROM invoices LIMIT 1");
          employeeNameColumnExists = true;
          console.log("employee_name column exists in invoices table (POST)");
        } catch (_) {
          try {
            await conn.execute("ALTER TABLE invoices ADD COLUMN employee_name VARCHAR(255) NULL DEFAULT NULL AFTER gst_number");
            employeeNameColumnExists = true;
            console.log("Added employee_name column to invoices table (POST)");
          } catch (__) {
            console.error("Failed to add employee_name column to invoices table (POST)");
          }
        }

        // Ensure status column exists
        let statusColumnExists = false;
        try {
          await conn.execute("SELECT status FROM invoices LIMIT 1");
          statusColumnExists = true;
        } catch (_) {
          try {
            await conn.execute("ALTER TABLE invoices ADD COLUMN status ENUM('PAID', 'PARTIAL PAID', 'CANCELLED') NULL DEFAULT NULL");
            statusColumnExists = true;
          } catch (__) {}
        }

        // Conditionally build INSERT statement based on whether employee_name column exists
        let insertQuery, insertValues;
        if (employeeNameColumnExists && statusColumnExists) {
          insertQuery = `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, employee_name, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, cgst_rate, sgst_rate, igst_rate, type, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          insertValues = [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            shipping_address,
            Consignee,
            Consignee_Contact,
            gst_number,
            employeeName,
            state,
            state_code,
            subtotal,
            cgst,
            sgst,
            igst,
            total_tax,
            round_off || 0,
            grand_total,
            amount_paid,
            balance_amount,
            payment_status,
            notes,
            terms_conditions,
            buyers_order_no,
            eway_bill_no,
            delivery_challan_no,
            customerIdSql,
            linkedTransIdsJson,
            bodyCgstRate,
            bodySgstRate,
            bodyIgstRate,
            invoice_type,
            bodyStatus,
          ];
        } else if (employeeNameColumnExists) {
          insertQuery = `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, employee_name, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, cgst_rate, sgst_rate, igst_rate, type, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          insertValues = [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            shipping_address,
            Consignee,
            Consignee_Contact,
            gst_number,
            employeeName,
            state,
            state_code,
            subtotal,
            cgst,
            sgst,
            igst,
            total_tax,
            round_off || 0,
            grand_total,
            amount_paid,
            balance_amount,
            payment_status,
            notes,
            terms_conditions,
            buyers_order_no,
            eway_bill_no,
            delivery_challan_no,
            customerIdSql,
            linkedTransIdsJson,
            bodyCgstRate,
            bodySgstRate,
            bodyIgstRate,
            invoice_type,
          ];
        } else {
          insertQuery = `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, cgst_rate, sgst_rate, igst_rate, type, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          insertValues = [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            shipping_address,
            Consignee,
            Consignee_Contact,
            gst_number,
            state,
            state_code,
            subtotal,
            cgst,
            sgst,
            igst,
            total_tax,
            round_off || 0,
            grand_total,
            amount_paid,
            balance_amount,
            payment_status,
            notes,
            terms_conditions,
            buyers_order_no,
            eway_bill_no,
            delivery_challan_no,
            customerIdSql,
            linkedTransIdsJson,
            bodyCgstRate,
            bodySgstRate,
            bodyIgstRate,
            invoice_type,
          ];
        }

        const [result] = await conn.execute(insertQuery, insertValues);

        console.log("Inserted invoice with employee_name:", { invoice_number: finalInvoiceNumber, employee_name: employeeName, insertId: result.insertId });

        invoiceId = result.insertId;
        // Success, break retry loop
        break;
      } catch (err) {
        // If unique constraint exists and we hit duplicate, retry with next seq
        if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (!finalInvoiceNumber || !invoiceId) {
      throw new Error("Failed to generate unique invoice number");
    }

    // Insert invoice_items for each item
    for (let item of items) {
      const item_name = item.item_name || null;
      const item_code = item.item_code || null;
      const description = item.description || null;
      const hsn_code = item.hsn_code || null;
      const quantity = item.quantity || 0;
      const rate = item.rate || 0;
      const discount_percent = item.discount_percent || 0;
      const discount_amount = item.discount_amount || 0;
      const taxable_value = item.taxable_value || 0;
      const cgst_percent = item.cgst_percent || 0;
      const sgst_percent = item.sgst_percent || 0;
      const igst_percent = item.igst_percent || 0;
      const cgst_amount = item.cgst_amount || 0;
      const sgst_amount = item.sgst_amount || 0;
      const igst_amount = item.igst_amount || 0;
      const total_amount = item.total_amount || 0;

      await conn.execute(
        `INSERT INTO invoice_items 
         (invoice_id, item_code, product_number, item_name, description, hsn_code, quantity, rate, discount_percent, 
          discount_amount, taxable_value, cgst_percent, sgst_percent, igst_percent, 
          cgst_amount, sgst_amount, igst_amount, total_amount, image_url, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          invoiceId,
          item_code,
          item.product_number || null,
          item_name,
          description,
          hsn_code,
          quantity,
          rate,
          discount_percent,
          discount_amount,
          taxable_value,
          cgst_percent,
          sgst_percent,
          igst_percent,
          cgst_amount,
          sgst_amount,
          igst_amount,
          total_amount,
          item.imageUrl || item.image_url || null,
        ],
      );
    }

    await conn.commit();
    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      invoiceId: invoiceId,
    });
  } catch (e) {
    console.error("Invoice submission error:", e);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  } finally {
    try {
      conn?.release?.();
    } catch {}
  }
}
