import { getSessionPayload } from "@/lib/auth";

/** Who is saving the return row (login username → rep_list.username). */
export async function getReturnProductActorUsername() {
  const payload = await getSessionPayload();
  const username = payload?.username;
  if (username == null) return null;
  const trimmed = String(username).trim();
  return trimmed || null;
}

export async function ensureReturnProductOrderColumns(conn) {
  const alters = [
    "ALTER TABLE return_products ADD COLUMN IF NOT EXISTS order_id VARCHAR(100) NULL",
    "ALTER TABLE return_products ADD COLUMN IF NOT EXISTS order_created_by VARCHAR(100) NULL",
  ];
  for (const sql of alters) {
    await conn.query(sql).catch(() => {});
  }
}

/** Resolve sales order + processor from order id / quote / invoice. */
export async function resolveOrderMetaForReturn(
  conn,
  { order_id, quotation_no, invoice_no },
) {
  const oid = String(order_id ?? "").trim();
  if (oid) {
    const [rows] = await conn.query(
      "SELECT order_id, created_by FROM neworder WHERE order_id = ? LIMIT 1",
      [oid],
    );
    if (rows[0]) return rows[0];
  }

  const qn = String(quotation_no ?? "").trim();
  if (qn) {
    const [rows] = await conn.query(
      `SELECT order_id, created_by FROM neworder
       WHERE TRIM(quote_number) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci LIMIT 1`,
      [qn],
    );
    if (rows[0]) return rows[0];

    const qtOrderId = parseSyntheticOrderId(qn, "QT-");
    if (qtOrderId) {
      const [byQt] = await conn.query(
        "SELECT order_id, created_by FROM neworder WHERE order_id = ? LIMIT 1",
        [qtOrderId],
      );
      if (byQt[0]) return byQt[0];
    }
  }

  const inv = String(invoice_no ?? "").trim();
  if (inv) {
    const [rows] = await conn.query(
      `SELECT order_id, created_by FROM neworder
       WHERE TRIM(invoice_number) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci LIMIT 1`,
      [inv],
    );
    if (rows[0]) return rows[0];

    const invOrderId = parseSyntheticOrderId(inv, "INV-");
    if (invOrderId) {
      const [byInv] = await conn.query(
        "SELECT order_id, created_by FROM neworder WHERE order_id = ? LIMIT 1",
        [invOrderId],
      );
      if (byInv[0]) return byInv[0];
    }
  }

  return null;
}

function parseSyntheticOrderId(value, prefix) {
  const v = String(value ?? "").trim();
  if (!v.toUpperCase().startsWith(prefix)) return null;
  const id = v.slice(prefix.length).trim();
  return id || null;
}

const RETURN_PRODUCT_ORDER_MATCH_WHERE = `
          (rp.quotation_no IS NOT NULL AND TRIM(rp.quotation_no) <> ''
            AND TRIM(no.quote_number) COLLATE utf8mb4_unicode_ci = TRIM(rp.quotation_no) COLLATE utf8mb4_unicode_ci)
          OR (rp.invoice_no IS NOT NULL AND TRIM(rp.invoice_no) <> ''
            AND TRIM(no.invoice_number) COLLATE utf8mb4_unicode_ci = TRIM(rp.invoice_no) COLLATE utf8mb4_unicode_ci)
          OR (UPPER(LEFT(TRIM(rp.quotation_no), 3)) = 'QT-'
            AND TRIM(no.order_id) COLLATE utf8mb4_unicode_ci = TRIM(SUBSTRING(TRIM(rp.quotation_no), 4)) COLLATE utf8mb4_unicode_ci)
          OR (UPPER(LEFT(TRIM(rp.invoice_no), 4)) = 'INV-'
            AND TRIM(no.order_id) COLLATE utf8mb4_unicode_ci = TRIM(SUBSTRING(TRIM(rp.invoice_no), 5)) COLLATE utf8mb4_unicode_ci)`;

const RETURN_PRODUCT_ORDER_MATCH_ORDER_BY = `
        ORDER BY CASE
          WHEN TRIM(no.quote_number) COLLATE utf8mb4_unicode_ci = TRIM(rp.quotation_no) COLLATE utf8mb4_unicode_ci
          THEN 0 ELSE 1
        END
        LIMIT 1`;

export const RETURN_PRODUCT_ORDER_ID_SQL = `COALESCE(rp.order_id, (SELECT no.order_id FROM neworder no
        WHERE (${RETURN_PRODUCT_ORDER_MATCH_WHERE})
        ${RETURN_PRODUCT_ORDER_MATCH_ORDER_BY})) AS order_id`;

export const RETURN_PRODUCT_ORDER_CREATED_BY_LABEL_SQL = `COALESCE(
        NULLIF(TRIM(ep_oc.full_name), ''),
        rp.order_created_by,
        (SELECT COALESCE(NULLIF(TRIM(ep_o.full_name), ''), no.created_by)
         FROM neworder no
         LEFT JOIN employee_profiles ep_o
           ON LOWER(TRIM(ep_o.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(no.created_by)) COLLATE utf8mb4_unicode_ci
         WHERE (${RETURN_PRODUCT_ORDER_MATCH_WHERE})
         ${RETURN_PRODUCT_ORDER_MATCH_ORDER_BY})
      ) AS created_by_username`;

export const RETURN_PRODUCTS_UPDATED_BY_JOIN = `
      LEFT JOIN rep_list eu ON TRIM(CAST(rp.updated_by AS CHAR)) COLLATE utf8mb4_unicode_ci = TRIM(eu.username) COLLATE utf8mb4_unicode_ci
      LEFT JOIN employee_profiles ep_u ON LOWER(TRIM(ep_u.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(rp.updated_by)) COLLATE utf8mb4_unicode_ci`;

export const RETURN_PRODUCTS_UPDATED_BY_LABEL_SQL =
  "COALESCE(NULLIF(TRIM(ep_u.full_name), ''), eu.username, rp.updated_by) AS updated_by_username";

export const RETURN_PRODUCT_ORDER_CREATED_BY_PROFILE_JOIN = `
      LEFT JOIN employee_profiles ep_oc ON LOWER(TRIM(ep_oc.username)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(rp.order_created_by)) COLLATE utf8mb4_unicode_ci`;

export async function resolveEmployeeDisplayName(conn, username) {
  const u = String(username ?? "").trim();
  if (!u) return null;
  const [rows] = await conn.query(
    `SELECT COALESCE(NULLIF(TRIM(full_name), ''), ?) AS label
     FROM employee_profiles
     WHERE LOWER(TRIM(username)) COLLATE utf8mb4_unicode_ci = LOWER(?) COLLATE utf8mb4_unicode_ci
     LIMIT 1`,
    [u, u],
  );
  return rows[0]?.label || u;
}

/** Fill missing order_id / order_created_by / display name; backfill DB when possible. */
export async function enrichReturnProductRow(conn, row) {
  let orderId = row.order_id ? String(row.order_id).trim() : null;
  let orderCreatedBy = row.order_created_by
    ? String(row.order_created_by).trim()
    : null;
  let createdByUsername = row.created_by_username
    ? String(row.created_by_username).trim()
    : null;

  const meta = await resolveOrderMetaForReturn(conn, {
    order_id: orderId,
    quotation_no: row.quotation_no,
    invoice_no: row.invoice_no,
  });

  if (meta?.order_id) orderId = orderId || String(meta.order_id).trim();
  if (meta?.created_by) {
    orderCreatedBy = orderCreatedBy || String(meta.created_by).trim();
  }

  if (orderCreatedBy) {
    createdByUsername = await resolveEmployeeDisplayName(conn, orderCreatedBy);
  } else if (meta?.created_by) {
    createdByUsername = await resolveEmployeeDisplayName(conn, meta.created_by);
  }

  if (
    row.id &&
    meta &&
    ((!row.order_id && orderId) || (!row.order_created_by && orderCreatedBy))
  ) {
    await conn
      .query(
        `UPDATE return_products
         SET order_id = COALESCE(order_id, ?),
             order_created_by = COALESCE(order_created_by, ?)
         WHERE id = ?`,
        [orderId, orderCreatedBy, row.id],
      )
      .catch(() => {});
  }

  return {
    ...row,
    order_id: orderId,
    order_created_by: orderCreatedBy,
    created_by_username: createdByUsername || null,
  };
}

export async function enrichReturnProductsList(conn, rows) {
  const out = [];
  for (const row of rows) {
    out.push(await enrichReturnProductRow(conn, { ...row }));
  }
  return out;
}
