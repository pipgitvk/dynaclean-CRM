/**
 * Fetch approved special_price.special_price for a customer + product.
 * Works on production schema (no item_type column) and migrated schema (with item_type).
 */
export async function getApprovedSpecialPrice(conn, customerId, productId, productCodeInput) {
  const customerIdNum = Number(String(customerId ?? "").trim());
  if (!Number.isFinite(customerIdNum) || customerIdNum <= 0) {
    return null;
  }

  const codeLower = String(productCodeInput ?? "").trim().toLowerCase();
  if (!codeLower && (productId == null || productId === "")) {
    return null;
  }

  const baseWhere = `
    WHERE customer_id = ?
      AND LOWER(TRIM(status)) = 'approved'
      AND (
        (? IS NOT NULL AND product_id = ?)
        OR (? <> '' AND LOWER(TRIM(COALESCE(product_code, ''))) = ?)
      )`;

  const params = [
    customerIdNum,
    productId ?? null,
    productId ?? null,
    codeLower,
    codeLower,
  ];

  const runQuery = async (extraFilter = "") => {
    const [rows] = await conn.execute(
      `SELECT special_price FROM special_price ${baseWhere} ${extraFilter} ORDER BY approved_date DESC, id DESC LIMIT 1`,
      params
    );
    return rows[0] ?? null;
  };

  try {
    const row = await runQuery(
      "AND (item_type = 'product' OR item_type IS NULL OR item_type = '')"
    );
    if (row) {
      const price = Number(row.special_price);
      return Number.isFinite(price) ? price : null;
    }
  } catch (err) {
    const msg = String(err?.message || "");
    if (!msg.includes("item_type")) {
      throw err;
    }
  }

  const row = await runQuery("");
  if (!row) return null;

  const price = Number(row.special_price);
  return Number.isFinite(price) ? price : null;
}
