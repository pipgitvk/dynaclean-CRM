/**
 * Resolve product from products_list (case-insensitive item_code).
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
    itemType: "product",
    itemId: rows[0].id,
    itemCode: rows[0].item_code || code,
  };
}

/**
 * Resolve spare from spare_list by spare_number or item name/code string.
 */
export async function resolveSpareByCode(conn, codeInput) {
  const code = String(codeInput ?? "").trim();
  if (!code) return null;

  const codeLower = code.toLowerCase();

  const [rows] = await conn.execute(
    `SELECT id, spare_number, item_name
     FROM spare_list
     WHERE CAST(spare_number AS CHAR) = ?
        OR LOWER(TRIM(COALESCE(item_name, ''))) = ?
        OR LOWER(TRIM(CAST(spare_number AS CHAR))) = ?
     LIMIT 1`,
    [code, codeLower, codeLower]
  );

  if (!rows?.length) return null;

  return {
    itemType: "spare",
    itemId: rows[0].id,
    itemCode: String(rows[0].spare_number ?? code),
    itemName: rows[0].item_name || "",
  };
}

/**
 * Resolve quotation line item — product first, then spare.
 */
export async function resolveQuotationItemByCode(conn, codeInput) {
  const product = await resolveProductByCode(conn, codeInput);
  if (product) return product;
  return resolveSpareByCode(conn, codeInput);
}

async function runSpecialPriceQuery(conn, customerIdNum, matchSql, params, extraFilter = "") {
  const [rows] = await conn.execute(
    `SELECT special_price
     FROM special_price
     WHERE customer_id = ?
       AND LOWER(TRIM(status)) = 'approved'
       AND (${matchSql})
       ${extraFilter}
     ORDER BY id DESC
     LIMIT 1`,
    [customerIdNum, ...params]
  );

  if (!rows?.length) return null;

  const price = Number(rows[0].special_price);
  return Number.isFinite(price) ? price : null;
}

/**
 * Dynamic approved price from special_price.special_price column.
 * Works for both products and spares. Never throws.
 */
export async function getApprovedSpecialPrice(
  conn,
  customerId,
  itemId,
  itemCodeInput,
  itemType = null
) {
  try {
    const customerIdNum = Number(String(customerId ?? "").trim());
    if (!Number.isFinite(customerIdNum) || customerIdNum <= 0) {
      return null;
    }

    let resolvedType = itemType;
    let id =
      itemId != null && itemId !== "" && Number.isFinite(Number(itemId))
        ? Number(itemId)
        : null;
    let code = String(itemCodeInput ?? "").trim();

    if ((id == null || !resolvedType) && code) {
      const item = await resolveQuotationItemByCode(conn, code);
      if (item) {
        id = item.itemId;
        code = item.itemCode;
        resolvedType = item.itemType;
      }
    }

    const codes = [...new Set([code, itemCodeInput].filter(Boolean))].map((c) =>
      String(c).trim().toLowerCase()
    );

    if (id == null && codes.length === 0) {
      return null;
    }

    const matchParts = [];
    const matchParams = [];

    if (id != null) {
      matchParts.push("product_id = ?");
      matchParams.push(id);
    }
    if (codes.length > 0) {
      const placeholders = codes.map(() => "?").join(", ");
      matchParts.push(
        `LOWER(TRIM(COALESCE(product_code, ''))) IN (${placeholders})`
      );
      matchParams.push(...codes);
    }

    const matchSql = matchParts.join(" OR ");

    if (resolvedType === "spare") {
      try {
        const price = await runSpecialPriceQuery(
          conn,
          customerIdNum,
          matchSql,
          matchParams,
          "AND item_type = 'spare'"
        );
        if (price != null) return price;
      } catch (err) {
        if (!String(err?.message || "").includes("item_type")) {
          console.error("[getApprovedSpecialPrice] spare query failed:", err);
        }
      }
    }

    if (resolvedType === "product") {
      try {
        const price = await runSpecialPriceQuery(
          conn,
          customerIdNum,
          matchSql,
          matchParams,
          "AND (item_type = 'product' OR item_type IS NULL)"
        );
        if (price != null) return price;
      } catch (err) {
        if (!String(err?.message || "").includes("item_type")) {
          console.error("[getApprovedSpecialPrice] product query failed:", err);
        }
      }
    }

    return await runSpecialPriceQuery(conn, customerIdNum, matchSql, matchParams);
  } catch (err) {
    console.error("[getApprovedSpecialPrice] query failed:", err);
    return null;
  }
}

/**
 * Original list price + gst for product or spare.
 */
export async function getQuotationItemBasePricing(conn, item) {
  if (!item) return { originalPrice: null, gstRate: null };

  if (item.itemType === "spare" && item.itemId) {
    const [rows] = await conn.execute(
      `SELECT COALESCE(sale_price, price) AS sale_price, tax
       FROM spare_list WHERE id = ? LIMIT 1`,
      [item.itemId]
    );
    if (!rows[0]) return { originalPrice: null, gstRate: null };
    return {
      originalPrice:
        rows[0].sale_price != null ? Number(rows[0].sale_price) : null,
      gstRate: rows[0].tax ?? null,
    };
  }

  if (item.itemId) {
    const [rows] = await conn.execute(
      `SELECT price_per_unit, gst_rate FROM products_list WHERE id = ? LIMIT 1`,
      [item.itemId]
    );
    if (!rows[0]) return { originalPrice: null, gstRate: null };
    return {
      originalPrice:
        rows[0].price_per_unit != null ? Number(rows[0].price_per_unit) : null,
      gstRate: rows[0].gst_rate ?? null,
    };
  }

  return { originalPrice: null, gstRate: null };
}
