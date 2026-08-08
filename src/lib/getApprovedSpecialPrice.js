/**
 * Resolve product id + item_code from products_list (case-insensitive).
 */
export async function resolveProductByCode(conn, productCodeInput) {
  const code = String(productCodeInput ?? "").trim();
  if (!code) return null;

  const codeLower = code.toLowerCase();

  const [rows] = await conn.execute(
    `SELECT id, item_code
     FROM products_list
     WHERE LOWER(TRIM(item_code)) = ?
        OR CAST(product_number AS CHAR) = ?
     LIMIT 1`,
    [codeLower, code]
  );

  if (!rows?.length) return null;

  return {
    productId: rows[0].id,
    itemCode: rows[0].item_code || code,
  };
}

/**
 * Dynamic approved price from special_price.special_price column.
 * Never throws.
 */
export async function getApprovedSpecialPrice(conn, customerId, productId, productCodeInput) {
  try {
    const customerIdNum = Number(String(customerId ?? "").trim());
    if (!Number.isFinite(customerIdNum) || customerIdNum <= 0) {
      return null;
    }

    let pid =
      productId != null && productId !== "" && Number.isFinite(Number(productId))
        ? Number(productId)
        : null;

    let code = String(productCodeInput ?? "").trim();

    if (!code && pid == null) {
      return null;
    }

    if (pid == null && code) {
      const product = await resolveProductByCode(conn, code);
      if (product) {
        pid = product.productId;
        code = product.itemCode;
      }
    }

    const codes = [...new Set([code, productCodeInput].filter(Boolean))].map((c) =>
      String(c).trim().toLowerCase()
    );

    if (pid == null && codes.length === 0) {
      return null;
    }

    const codePlaceholders = codes.map(() => "?").join(", ");
    const params = [customerIdNum];

    let matchSql = "";
    if (pid != null) {
      matchSql += "(product_id = ?)";
      params.push(pid);
    }
    if (codes.length > 0) {
      if (matchSql) matchSql += " OR ";
      matchSql += `LOWER(TRIM(COALESCE(product_code, ''))) IN (${codePlaceholders})`;
      params.push(...codes);
    }

    const [rows] = await conn.execute(
      `SELECT special_price
       FROM special_price
       WHERE customer_id = ?
         AND LOWER(TRIM(status)) = 'approved'
         AND (${matchSql})
       ORDER BY id DESC
       LIMIT 1`,
      params
    );

    if (!rows?.length) return null;

    const price = Number(rows[0].special_price);
    return Number.isFinite(price) ? price : null;
  } catch (err) {
    console.error("[getApprovedSpecialPrice] query failed:", err);
    return null;
  }
}
