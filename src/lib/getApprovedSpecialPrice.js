/**
 * Fetch approved special_price.special_price for a customer + product.
 * Never throws — returns null on any DB mismatch or missing row.
 */
export async function getApprovedSpecialPrice(conn, customerId, productId, productCodeInput) {
  try {
    const customerIdNum = Number(String(customerId ?? "").trim());
    if (!Number.isFinite(customerIdNum) || customerIdNum <= 0) {
      return null;
    }

    const codeLower = String(productCodeInput ?? "").trim().toLowerCase();
    const pid =
      productId != null && productId !== "" && Number.isFinite(Number(productId))
        ? Number(productId)
        : null;

    if (!codeLower && pid == null) {
      return null;
    }

    const [rows] = await conn.execute(
      `SELECT special_price
       FROM special_price
       WHERE customer_id = ?
         AND LOWER(TRIM(status)) = 'approved'
         AND (
           (? IS NOT NULL AND product_id = ?)
           OR (? <> '' AND LOWER(TRIM(COALESCE(product_code, ''))) = ?)
         )
       ORDER BY id DESC
       LIMIT 1`,
      [customerIdNum, pid, pid, codeLower, codeLower]
    );

    if (!rows?.length) return null;

    const price = Number(rows[0].special_price);
    return Number.isFinite(price) ? price : null;
  } catch (err) {
    console.error("[getApprovedSpecialPrice] query failed:", err);
    return null;
  }
}
