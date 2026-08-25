/**
 * Shared helpers for BOM APIs — handles MySQL JSON column return types
 * and product_code whitespace differences between environments.
 */

export function parseItemsJson(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const str = typeof raw.toString === "function" ? raw.toString() : "";
    if (str && str !== "[object Object]") {
      try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeProductCode(productCode) {
  return String(productCode || "").trim();
}

/**
 * Load a BOM row by product code. Tries active BOM first, then any latest BOM.
 */
export async function loadBomForProduct(db, productCode) {
  const code = normalizeProductCode(productCode);
  if (!code) return null;

  let [[bomRow]] = await db.query(
    `SELECT id, id AS bom_id, product_code, items_json, created_by, modified_by, status
       FROM bom
      WHERE TRIM(product_code) = ? AND status = 'active'
      LIMIT 1`,
    [code]
  );

  if (!bomRow) {
    [[bomRow]] = await db.query(
      `SELECT id, id AS bom_id, product_code, items_json, created_by, modified_by, status
         FROM bom
        WHERE TRIM(product_code) = ?
        ORDER BY updated_at DESC
        LIMIT 1`,
      [code]
    );
  }

  return bomRow || null;
}
