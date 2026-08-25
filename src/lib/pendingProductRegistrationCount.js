/**
 * Item is a product (exists in products_list).
 */
export const IS_PRODUCT_DISPATCH_ITEM_SQL = (dispatchAlias = "d") => `
  EXISTS (
    SELECT 1 FROM products_list pl
    WHERE pl.item_code = ${dispatchAlias}.item_code
  )
`;

/**
 * SQL fragment: order has at least one unregistered product serial.
 */
export const UNREGISTERED_PRODUCT_ORDER_SQL = `
  EXISTS (
    SELECT 1
    FROM dispatch d_unreg
    WHERE d_unreg.quote_number COLLATE utf8mb4_unicode_ci = no.quote_number COLLATE utf8mb4_unicode_ci
      AND d_unreg.serial_no IS NOT NULL
      AND d_unreg.serial_no <> ''
      AND ${IS_PRODUCT_DISPATCH_ITEM_SQL("d_unreg")}
      AND NOT EXISTS (
        SELECT 1 FROM warranty_products wp
        WHERE TRIM(wp.serial_number) COLLATE utf8mb4_unicode_ci
          = TRIM(d_unreg.serial_no) COLLATE utf8mb4_unicode_ci
      )
  )
`;

/**
 * Count upcoming installation orders with at least one unregistered product.
 * Matches /api/installation/upcoming?registration=unregistered&type=products total.
 */
export async function getPendingProductRegistrationCount(connection) {
  const [rows] = await connection.execute(
    `
    SELECT COUNT(DISTINCT no.id) AS count
    FROM neworder no
    WHERE no.installation_status = 0
      AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
      AND (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
      AND no.delivery_date IS NOT NULL
      AND no.dispatch_status = 1
      AND ${UNREGISTERED_PRODUCT_ORDER_SQL}
    `
  );

  return Number(rows[0]?.count ?? 0);
}
