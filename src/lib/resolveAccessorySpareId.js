function parseSpareNumberFromAccessoryName(name) {
  const match = String(name || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : null;
}

function normalizeName(name) {
  return String(name || "")
    .replace(/\([^)]*\)\s*$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function accessoryKeywords(accessoryName) {
  const stopWords = new Set([
    "with",
    "complete",
    "consumable",
    "pipe",
    "hose",
    "set",
    "pc",
    "qty",
    "the",
    "and",
  ]);
  return normalizeName(accessoryName)
    .split(" ")
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

async function resolveSpareByProductAndName(conn, productCode, accessoryName) {
  if (!productCode || !accessoryName) return null;

  const [candidates] = await conn.execute(
    `SELECT id, item_name, spare_number FROM spare_list
     WHERE LOWER(item_name) LIKE ?`,
    [`%${String(productCode).toLowerCase()}%`],
  );

  if (!candidates.length) return null;

  const keywords = accessoryKeywords(accessoryName);
  const cleanName = normalizeName(accessoryName);
  let bestId = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const spareName = candidate.item_name.toLowerCase();
    let score = 0;

    for (const word of keywords) {
      if (spareName.includes(word)) score += 1;
    }

    if (keywords[0] && spareName.trim().startsWith(keywords[0])) {
      score += 2;
    }

    if (cleanName.length >= 4 && spareName.includes(cleanName.slice(0, 12))) {
      score += 3;
    }

    const spareParts = spareName
      .replace(String(productCode).toLowerCase(), "")
      .split(/\s+/)
      .filter(Boolean);
    const irrelevant = spareParts.filter(
      (part) =>
        part.length > 2 &&
        ![...keywords].some((keyword) => part.includes(keyword) || keyword.includes(part)),
    );
    score -= irrelevant.length;

    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.id;
    }
  }

  return bestScore > 0 ? bestId : null;
}

async function resolveSpareIdFromName(conn, accessoryName, productCode = null) {
  if (productCode) {
    const byProduct = await resolveSpareByProductAndName(
      conn,
      productCode,
      accessoryName,
    );
    if (byProduct) return byProduct;
  }

  const spareNumber = parseSpareNumberFromAccessoryName(accessoryName);
  if (spareNumber) {
    const [byNumber] = await conn.execute(
      `SELECT id FROM spare_list
       WHERE CAST(spare_number AS CHAR) = ? OR CAST(id AS CHAR) = ?
       LIMIT 1`,
      [spareNumber, spareNumber],
    );
    if (byNumber.length > 0) return byNumber[0].id;
  }

  const namesToTry = [
    normalizeName(accessoryName),
    String(accessoryName || "").trim().toLowerCase(),
  ].filter(Boolean);

  for (const nameKey of [...new Set(namesToTry)]) {
    const [byName] = await conn.execute(
      `SELECT id FROM spare_list WHERE LOWER(TRIM(item_name)) = ? LIMIT 1`,
      [nameKey],
    );
    if (byName.length > 0) return byName[0].id;
  }

  const fuzzyKey = normalizeName(accessoryName);
  if (fuzzyKey.length >= 3) {
    const [fuzzy] = await conn.execute(
      `SELECT id FROM spare_list
       WHERE LOWER(TRIM(item_name)) LIKE ?
       LIMIT 2`,
      [`%${fuzzyKey}%`],
    );
    if (fuzzy.length === 1) return fuzzy[0].id;
  }

  return null;
}

/**
 * Resolve spare_list.id for a product_accessories row or accessory payload.
 */
export async function resolveAccessorySpareId(conn, accessory) {
  if (accessory?.spare_id) {
    return accessory.spare_id;
  }

  let productCode = accessory?.product_code || null;
  let accessoryName = accessory?.accessory_name || null;

  if (accessory?.id) {
    const [rows] = await conn.execute(
      `SELECT spare_id, accessory_name, product_code FROM product_accessories WHERE id = ? LIMIT 1`,
      [accessory.id],
    );
    if (rows.length > 0) {
      if (rows[0].spare_id) return rows[0].spare_id;
      productCode = productCode || rows[0].product_code;
      accessoryName = accessoryName || rows[0].accessory_name;
    }
  }

  return resolveSpareIdFromName(conn, accessoryName, productCode);
}

export async function resolveProductCodes(conn, productCode) {
  const codes = new Set();
  if (productCode) codes.add(productCode);

  const [productCheck] = await conn.execute(
    `SELECT item_code, item_name FROM products_list
     WHERE item_code = ? OR item_name = ?`,
    [productCode, productCode],
  );

  for (const row of productCheck) {
    if (row.item_code) codes.add(row.item_code);
    if (row.item_name) codes.add(row.item_name);
  }

  return [...codes];
}

export async function getAccessoryStockMap(conn, accessories, godown) {
  const locationColumn =
    !godown || godown === "Delhi - Mundka" ? "Delhi" : "South";
  const stockMap = {};

  for (const accessory of accessories) {
    const accessoryId = accessory.id;
    if (!accessoryId) continue;

    const spareId = await resolveAccessorySpareId(conn, accessory);

    if (!spareId) {
      stockMap[accessoryId] = {
        stock_count: null,
        min_qty: null,
        matched: false,
      };
      continue;
    }

    const [summary] = await conn.execute(
      `SELECT
        T1.Delhi,
        T1.South,
        T1.total_quantity,
        T2.min_qty,
        T2.item_name,
        T2.spare_number
      FROM stock_summary AS T1
      LEFT JOIN spare_list AS T2 ON T1.spare_id = T2.id
      WHERE T1.spare_id = ?`,
      [spareId],
    );

    if (summary.length > 0) {
      const row = summary[0];
      const delhi = Number(row.Delhi ?? 0);
      const south = Number(row.South ?? 0);
      const stockCount = godown
        ? Number(row[locationColumn] ?? 0)
        : Number(row.total_quantity ?? delhi + south);

      stockMap[accessoryId] = {
        stock_count: stockCount,
        delhi,
        south,
        min_qty: row.min_qty,
        item_name: row.item_name,
        spare_number: row.spare_number,
        spare_id: spareId,
        matched: true,
      };
    } else {
      stockMap[accessoryId] = {
        stock_count: 0,
        spare_id: spareId,
        min_qty: null,
        matched: true,
      };
    }
  }

  return stockMap;
}
