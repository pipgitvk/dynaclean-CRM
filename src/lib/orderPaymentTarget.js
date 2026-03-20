/**
 * Prospects Status: order payment vs commitment_date.
 * Prefer explicit prospects.order_id → neworder; else match client orders by total amount, then latest.
 */

/** Normalize SQL DATE / ISO / string to YYYY-MM-DD (UTC calendar for Date objects). */
export function commitmentValueToYmd(value) {
  if (value == null || value === "") return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parsePaymentDateSegments(paymentDateRaw) {
  const s = (paymentDateRaw || "").toString().trim();
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Latest YYYY-MM-DD among payment_date CSV segments (full payment = last installment). */
export function latestPaymentYmdFromCsv(paymentDateRaw) {
  let best = null;
  for (const segment of parsePaymentDateSegments(paymentDateRaw)) {
    const d = new Date(segment);
    if (Number.isNaN(d.getTime())) continue;
    const ymd = commitmentValueToYmd(d);
    if (!ymd) continue;
    if (best == null || ymd > best) best = ymd;
  }
  return best;
}

const BADGES = {
  achieved: {
    label: "achieved",
    cls: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  },
  pending: {
    label: "pending",
    cls: "bg-amber-50 text-amber-900 border border-amber-200",
  },
  notAchieved: {
    label: "not-achieved",
    cls: "bg-rose-50 text-rose-900 border border-rose-200",
  },
};

/**
 * @param {{ payment_status: string | null, payment_date: string | null }} ctx
 * @param {string | null} commitmentYmd — YYYY-MM-DD or null
 */
export function getProspectStatusFromOrderAndCommitment(ctx, commitmentYmd) {
  const statusCompact = (ctx?.payment_status || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (statusCompact !== "paid") {
    return BADGES.pending;
  }

  if (!commitmentYmd) {
    return BADGES.achieved;
  }

  const payYmd = latestPaymentYmdFromCsv(ctx?.payment_date);
  if (!payYmd) {
    return BADGES.achieved;
  }

  if (payYmd <= commitmentYmd) {
    return BADGES.achieved;
  }
  return BADGES.notAchieved;
}

function normalizePaymentCtx(r) {
  if (!r) return null;
  return {
    payment_status:
      r.payment_status == null || r.payment_status === ""
        ? null
        : String(r.payment_status),
    payment_date:
      r.payment_date == null || r.payment_date === ""
        ? null
        : String(r.payment_date),
  };
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string[]} orderIds
 */
export async function getOrderPaymentContextMapByOrderIds(conn, orderIds) {
  const ids = [
    ...new Set(
      (orderIds || []).map((x) => String(x ?? "").trim()).filter(Boolean),
    ),
  ];
  if (!ids.length) return {};

  const ph = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT order_id, payment_status, payment_date
     FROM neworder
     WHERE order_id IN (${ph})`,
    ids,
  );

  /** @type {Record<string, { payment_status: string | null, payment_date: string | null }>} */
  const out = {};
  for (const r of rows || []) {
    const oid = String(r.order_id ?? "").trim();
    if (!oid) continue;
    out[oid] = normalizePaymentCtx(r);
  }
  return out;
}

/**
 * All orders per customer, newest first (for amount-matched fallback when order_id is null).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string[]} customerIds
 */
export async function getOrdersPaymentRowsByCustomerId(conn, customerIds) {
  const ids = [
    ...new Set(
      (customerIds || [])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return {};

  const ph = ids.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT qr.customer_id AS customer_id,
            no.payment_status AS payment_status,
            no.payment_date AS payment_date,
            no.totalamt AS totalamt,
            no.created_at AS created_at
     FROM neworder no
     INNER JOIN quotations_records qr ON no.quote_number = qr.quote_number
     WHERE qr.customer_id IN (${ph})
     ORDER BY no.created_at DESC`,
    ids,
  );

  /** @type {Record<string, Array<{ payment_status: unknown, payment_date: unknown, totalamt: unknown }>>} */
  const out = {};
  for (const r of rows || []) {
    const cid = String(r.customer_id ?? "").trim();
    if (!cid) continue;
    if (!out[cid]) out[cid] = [];
    out[cid].push(r);
  }
  return out;
}

const AMT_TOL = 0.02;

/**
 * Prefer latest order whose totalamt matches prospect amount; else latest order for that client.
 */
export function pickPaymentContextFromCustomerOrders(orderRows, prospectAmount) {
  if (!orderRows?.length) return null;
  const target = Number(prospectAmount);
  if (Number.isFinite(target)) {
    for (const r of orderRows) {
      const ta = Number(r.totalamt);
      if (Number.isFinite(ta) && Math.abs(ta - target) < AMT_TOL) {
        return normalizePaymentCtx(r);
      }
    }
  }
  return normalizePaymentCtx(orderRows[0]);
}

function prospectRowAmount(row) {
  const n = Number(row?.amount);
  return Number.isFinite(n) ? n : NaN;
}

function prospectQuotePairKey(customerId, quoteNumber) {
  const cid = String(customerId ?? "").trim();
  const qn = String(quoteNumber ?? "").trim();
  if (!cid || !qn) return null;
  return `${cid}|${qn}`;
}

/**
 * Payment context for orders created from specific quotations (neworder.quote_number ↔ quotations_records).
 * One entry per (customer_id, quote_number); prefers latest order by created_at when duplicates exist.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {Array<{ customer_id: string, quote_number: string }>} pairs
 * @returns {Promise<Record<string, { payment_status: string | null, payment_date: string | null }>>}
 */
export async function getOrderPaymentContextMapByQuotePairs(conn, pairs) {
  const seen = new Set();
  const uniquePairs = [];
  for (const p of pairs || []) {
    const cid = String(p.customer_id ?? "").trim();
    const qn = String(p.quote_number ?? "").trim();
    if (!cid || !qn) continue;
    const k = `${cid}|${qn}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniquePairs.push({ customer_id: cid, quote_number: qn });
  }
  if (!uniquePairs.length) return {};

  const quoteNums = [...new Set(uniquePairs.map((p) => p.quote_number))];
  const ph = quoteNums.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT no.payment_status, no.payment_date,
            TRIM(qr.customer_id) AS qr_customer_id,
            TRIM(qr.quote_number) AS qr_quote_number,
            no.created_at
     FROM neworder no
     INNER JOIN quotations_records qr
       ON TRIM(no.quote_number) = TRIM(qr.quote_number)
          OR UPPER(TRIM(no.quote_number)) = UPPER(TRIM(qr.quote_number))
     WHERE TRIM(no.quote_number) IN (${ph})
     ORDER BY no.created_at DESC`,
    quoteNums,
  );

  /** @type {Record<string, ReturnType<typeof normalizePaymentCtx>>} */
  const out = {};
  for (const r of rows || []) {
    const cid = String(r.qr_customer_id ?? "").trim();
    const qn = String(r.qr_quote_number ?? "").trim();
    const key = prospectQuotePairKey(cid, qn);
    if (!key || out[key]) continue;
    const ctxVal = normalizePaymentCtx(r);
    out[key] = ctxVal;
    const keyUpper = prospectQuotePairKey(cid, qn.toUpperCase());
    if (keyUpper && keyUpper !== key && !out[keyUpper]) {
      out[keyUpper] = ctxVal;
    }
  }
  return out;
}

/**
 * Writes computed payment-target label to prospects.status (achieved | pending | not-achieved | open).
 * Skips UPDATE when value unchanged to limit writes.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {object[]} enrichedRows — rows with id and status
 */
export async function persistProspectPaymentStatusesToDb(conn, enrichedRows) {
  for (const row of enrichedRows || []) {
    const id = row.id;
    if (id == null) continue;
    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum < 1) continue;
    const status = String(row.status ?? "open").trim() || "open";
    await conn.execute(
      `UPDATE prospects SET status = ? WHERE id = ? AND (status IS NULL OR status <> ?)`,
      [status, idNum, status],
    );
  }
}

/**
 * Attaches order_payment_target to each prospect row (does not remove other fields).
 * Persists status to prospects.status after compute.
 * Resolution order: explicit order_id → order from same quotation (quote_number) → amount / latest order for customer.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {object[]} rows — raw DB or mapped rows with customer_id, optional order_id, quote_number, amount, commitment_date
 */
export async function enrichProspectRowsWithPaymentStatus(conn, rows) {
  const list = rows || [];
  const orderIds = [
    ...new Set(
      list
        .map((r) => String(r.order_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const orderMap = await getOrderPaymentContextMapByOrderIds(conn, orderIds);

  const quotePairs = list
    .filter((r) => !String(r.order_id ?? "").trim())
    .map((r) => ({
      customer_id: String(r.customer_id ?? "").trim(),
      quote_number: String(r.quote_number ?? "").trim(),
    }))
    .filter((p) => p.customer_id && p.quote_number);

  const quoteOrderMap = await getOrderPaymentContextMapByQuotePairs(
    conn,
    quotePairs,
  );

  const fallbackCustomerIds = [
    ...new Set(
      list
        .filter((r) => !String(r.order_id ?? "").trim())
        .map((r) => String(r.customer_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  const byCustomer = await getOrdersPaymentRowsByCustomerId(
    conn,
    fallbackCustomerIds,
  );

  const enriched = list.map((row) => {
    const commitmentYmd = commitmentValueToYmd(row.commitment_date);
    const oid = String(row.order_id ?? "").trim();
    let ctx = null;
    if (oid) {
      ctx = orderMap[oid] ?? null;
    } else {
      const cid = String(row.customer_id ?? "").trim();
      const qn = String(row.quote_number ?? "").trim();
      let qKey = prospectQuotePairKey(cid, qn);
      if (qKey) {
        ctx = quoteOrderMap[qKey] ?? null;
        if (!ctx) {
          qKey = prospectQuotePairKey(cid, qn.toUpperCase());
          if (qKey) ctx = quoteOrderMap[qKey] ?? null;
        }
      }
      if (!ctx) {
        ctx = pickPaymentContextFromCustomerOrders(
          byCustomer[cid],
          prospectRowAmount(row),
        );
      }
    }
    const order_payment_target = ctx
      ? getProspectStatusFromOrderAndCommitment(ctx, commitmentYmd)
      : null;
    const status = order_payment_target?.label ?? "open";
    return { ...row, order_payment_target, status };
  });

  await persistProspectPaymentStatusesToDb(conn, enriched);
  return enriched;
}
