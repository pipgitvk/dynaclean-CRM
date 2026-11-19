import {
  sqlTrimUtf8EqColumns,
  sqlUtf8HasText,
} from "@/lib/sqlUtf8Compare";

export const WP_LIST_COLUMNS = `
       wp.id,
       wp.serial_number,
       wp.customer_name,
       wp.model,
       wp.product_name,
       wp.contact,
       wp.email,
       wp.contact_person,
       wp.customer_address,
       wp.state,
       wp.site_person,x 
       wp.site_contact,
       wp.site_email,
       wp.invoice_number,
       wp.invoice_date,
       wp.invoice_file,
       wp.installation_date,
       wp.warranty_period,
       wp.installed_address,
       wp.created_by AS registered_by,
       wp.created_at AS registered_at`;

export const WP_WARRANTY_END_SQL = `DATE_ADD(DATE(wp.installation_date), INTERVAL CAST(wp.warranty_period AS UNSIGNED) MONTH) AS warranty_end_date`;

const INSTALLATION_SR_ASSIGNED_OK = `UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')`;

function inClausePlaceholders(n) {
  return Array(n).fill("?").join(", ");
}

function normKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Fast page fetch — base columns only; call enrichTotalRegisteredRows after. */
export async function fetchTotalRegisteredBasePage(conn, where, baseParams, limit, skip) {
  const [rows] = await conn.execute(
    `SELECT
      ${WP_LIST_COLUMNS},
      ${WP_WARRANTY_END_SQL}
    FROM warranty_products wp
    INNER JOIN (
      SELECT wp.id
      FROM warranty_products wp
      ${where}
      ORDER BY wp.id DESC
      LIMIT ? OFFSET ?
    ) sel ON sel.id = wp.id
    ORDER BY wp.id DESC`,
    [...baseParams, limit, skip],
  );
  return rows;
}

export async function fetchSimpleWarrantyProductPage(conn, where, baseParams, limit, skip) {
  const [rows] = await conn.execute(
    `SELECT
      ${WP_LIST_COLUMNS},
      ${WP_WARRANTY_END_SQL}
    FROM warranty_products wp
    ${where}
    ORDER BY wp.id DESC
    LIMIT ? OFFSET ?`,
    [...baseParams, limit, skip],
  );
  return rows;
}

/**
 * Enrich only the current page (~10 rows) using IN (...) on serial/invoice.
 * Avoid TRIM(CONVERT) joins across full customers/dispatch/service_records —
 * those blocked the pool (connectionLimit=5) and slowed every page.
 */
export async function enrichTotalRegisteredRows(conn, rows) {
  if (!rows?.length) return rows;

  for (const row of rows) {
    if (row.customer_id === undefined) row.customer_id = null;
    if (row.order_sales_person === undefined) {
      row.order_sales_person = row.registered_by ?? null;
    }
    if (row.service_engineer === undefined) row.service_engineer = null;
    if (row.third_party_engineer === undefined) row.third_party_engineer = null;
  }

  try {
    await enrichTotalRegisteredRowsInner(conn, rows);
  } catch (err) {
    console.warn("[sbi enrich] skipped:", err?.message || err);
  }
  return rows;
}

async function enrichTotalRegisteredRowsInner(conn, rows) {
  const serials = [
    ...new Set(rows.map((r) => String(r.serial_number ?? "").trim()).filter(Boolean)),
  ];
  const invoices = [
    ...new Set(rows.map((r) => String(r.invoice_number ?? "").trim()).filter(Boolean)),
  ];
  const phones = [
    ...new Set(rows.map((r) => String(r.contact ?? "").trim()).filter(Boolean)),
  ];
  const emails = [
    ...new Set(
      rows
        .map((r) => String(r.email ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const rowsBySerial = new Map();
  for (const row of rows) {
    const key = normKey(row.serial_number);
    if (!key) continue;
    if (!rowsBySerial.has(key)) rowsBySerial.set(key, []);
    rowsBySerial.get(key).push(row);
  }

  // Sequential on purpose: keep pool usage to 1 connection for this request.
  if (serials.length) {
    await enrichEngineersBySerial(conn, serials, rowsBySerial);
    await enrichSalesByDispatchSerial(conn, serials, rowsBySerial);
  }
  if (invoices.length) {
    await enrichSalesByInvoice(conn, invoices, rows);
  }
  if (phones.length || emails.length) {
    await enrichCustomerIds(conn, phones, emails, rows);
  }

  return rows;
}

function engineerRank(status) {
  const s = String(status || "")
    .trim()
    .toUpperCase();
  return s === "COMPLETED" || s === "WORKED" ? 0 : 1;
}

async function enrichEngineersBySerial(conn, serials, rowsBySerial) {
  const [srRows] = await conn.execute(
    `SELECT
       sr.serial_number,
       sr.assigned_to,
       sr.assigned_to_type,
       sr.status,
       sr.service_id
     FROM service_records sr
     WHERE sr.serial_number IN (${inClausePlaceholders(serials.length)})
       AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
       AND ${INSTALLATION_SR_ASSIGNED_OK}`,
    serials,
  );

  const best = new Map();
  for (const r of srRows) {
    const key = normKey(r.serial_number);
    if (!key) continue;
    const kind =
      String(r.assigned_to_type || "")
        .trim()
        .toLowerCase() === "third_party"
        ? "third_party"
        : "internal";
    const cur = best.get(key) || {};
    const prev = cur[kind];
    const cand = {
      assigned_to: r.assigned_to,
      rank: engineerRank(r.status),
      service_id: Number(r.service_id) || 0,
    };
    if (
      !prev ||
      cand.rank < prev.rank ||
      (cand.rank === prev.rank && cand.service_id > prev.service_id)
    ) {
      cur[kind] = cand;
      best.set(key, cur);
    }
  }

  for (const [key, kinds] of best) {
    const targets = rowsBySerial.get(key);
    if (!targets) continue;
    for (const row of targets) {
      if (kinds.internal) row.service_engineer = kinds.internal.assigned_to;
      if (kinds.third_party) row.third_party_engineer = kinds.third_party.assigned_to;
    }
  }
}

async function enrichSalesByDispatchSerial(conn, serials, rowsBySerial) {
  const [salesRows] = await conn.execute(
    `SELECT d.serial_no AS serial_number, no.created_by, no.id AS order_id
     FROM dispatch d
     INNER JOIN neworder no ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
     WHERE d.serial_no IN (${inClausePlaceholders(serials.length)})
       AND ${sqlUtf8HasText("no.created_by")}
     ORDER BY no.id DESC`,
    serials,
  );

  const seen = new Set();
  for (const r of salesRows) {
    const key = normKey(r.serial_number);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const targets = rowsBySerial.get(key);
    if (!targets) continue;
    const name = String(r.created_by || "").trim();
    if (!name) continue;
    for (const row of targets) {
      row.order_sales_person = name;
    }
  }
}

async function enrichSalesByInvoice(conn, invoices, rows) {
  const [salesRows] = await conn.execute(
    `SELECT no.invoice_number, no.created_by, no.id AS order_id
     FROM neworder no
     WHERE no.invoice_number IN (${inClausePlaceholders(invoices.length)})
       AND ${sqlUtf8HasText("no.created_by")}
     ORDER BY no.id DESC`,
    invoices,
  );

  const byInvoice = new Map();
  for (const r of salesRows) {
    const key = normKey(r.invoice_number);
    if (!key || byInvoice.has(key)) continue;
    byInvoice.set(key, String(r.created_by || "").trim());
  }

  for (const row of rows) {
    if (String(row.order_sales_person || "").trim()) continue;
    const name = byInvoice.get(normKey(row.invoice_number));
    if (name) row.order_sales_person = name;
  }
}

async function enrichCustomerIds(conn, phones, emails, rows) {
  const clauses = [];
  const params = [];
  if (phones.length) {
    clauses.push(`c.phone IN (${inClausePlaceholders(phones.length)})`);
    params.push(...phones);
  }
  if (emails.length) {
    clauses.push(`LOWER(TRIM(c.email)) IN (${inClausePlaceholders(emails.length)})`);
    params.push(...emails);
  }
  if (!clauses.length) return;

  const [customers] = await conn.execute(
    `SELECT c.customer_id, c.phone, c.email
     FROM customers c
     WHERE ${clauses.join(" OR ")}
     LIMIT 500`,
    params,
  );

  const byPhone = new Map();
  const byEmail = new Map();
  for (const c of customers) {
    const phone = normKey(c.phone);
    const email = normKey(c.email);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, c.customer_id);
    if (email && !byEmail.has(email)) byEmail.set(email, c.customer_id);
  }

  for (const row of rows) {
    row.customer_id =
      byPhone.get(normKey(row.contact)) ?? byEmail.get(normKey(row.email)) ?? null;
  }
}
