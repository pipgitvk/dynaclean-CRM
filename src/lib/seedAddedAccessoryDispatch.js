import { getDbConnection } from "@/lib/db";

/**
 * Resolve product item_code from quotation to products_list item_code when possible.
 */
async function resolveProductCode(conn, itemCode) {
  const [productCheck] = await conn.execute(
    `SELECT item_code FROM products_list WHERE item_code = ? OR item_name = ? LIMIT 1`,
    [itemCode, itemCode],
  );
  return productCheck.length > 0 ? productCheck[0].item_code : itemCode;
}

/**
 * Insert dispatch rows for accessories marked as "added" (not in package).
 * One set of added accessories is created per product unit in the order.
 */
export async function seedAddedAccessoryDispatchRows(conn, quoteNumber, quotationItems) {
  for (const item of quotationItems) {
    const { item_code, quantity } = item;
    const productQty = Number(quantity) || 0;
    if (productQty <= 0 || !item_code) continue;

    const productCode = await resolveProductCode(conn, item_code);
    const isProduct = /[a-zA-Z]/.test(productCode || "");
    if (!isProduct) continue;

    const [addedAccessories] = await conn.execute(
      `SELECT pa.spare_id, pa.qty, pa.accessory_name, sl.item_name AS spare_name, sl.spare_number
       FROM product_accessories pa
       LEFT JOIN spare_list sl ON sl.id = pa.spare_id
       WHERE pa.product_code = ? AND pa.package_status = 'added' AND pa.spare_id IS NOT NULL`,
      [productCode],
    );

    if (!addedAccessories.length) continue;

    for (let unit = 0; unit < productQty; unit++) {
      for (const acc of addedAccessories) {
        const accQty = Number(acc.qty) || 1;
        const dispatchItemCode = acc.spare_number != null ? String(acc.spare_number) : String(acc.spare_id);
        const dispatchItemName = acc.spare_name || acc.accessory_name;

        for (let i = 0; i < accQty; i++) {
          await conn.execute(
            `INSERT INTO dispatch (quote_number, item_name, item_code, serial_no, remarks, photos, created_at, updated_at)
             VALUES (?, ?, ?, NULL, NULL, NULL, NOW(), NULL)`,
            [quoteNumber, dispatchItemName, dispatchItemCode],
          );
        }
      }
    }
  }
}
