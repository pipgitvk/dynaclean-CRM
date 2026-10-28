let purchasePriceColumnEnsured = false;

/** Adds products_list.purchase_price once per process (PAT / product-stock). */
export async function ensureProductListPurchasePriceColumn(conn) {
  if (purchasePriceColumnEnsured) return;
  try {
    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN purchase_price DECIMAL(12,2) NULL DEFAULT NULL`,
    );
  } catch (e) {
    const msg = String(e?.message || "");
    if (!msg.includes("Duplicate column")) throw e;
  }
  purchasePriceColumnEnsured = true;
}
