import { resolveAccessorySpareId } from "./resolveAccessorySpareId";

/**
 * Deduct spare stock for checked product accessories (package_status = available).
 * Quantity comes from product_accessories.qty.
 */
export async function deductCheckedAccessoryStock(conn, options) {
  const {
    accessoriesChecklistJson,
    productCode,
    godown,
    quoteNumber,
    orderNumber,
    username,
    dispatchRowId,
    companyName = null,
    companyAddress = null,
    partial = false,
  } = options;

  if (!accessoriesChecklistJson || !godown || !productCode) {
    return { deducted: [] };
  }

  let checkedItems;
  try {
    checkedItems = JSON.parse(accessoriesChecklistJson);
  } catch {
    return { deducted: [] };
  }

  if (!Array.isArray(checkedItems) || checkedItems.length === 0) {
    return { deducted: [] };
  }

  const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";
  const locationColumnLower = godown === "Delhi - Mundka" ? "delhi" : "south";
  const deducted = [];

  for (const item of checkedItems) {
    const accessoryId = item.id;
    if (!accessoryId) continue;

    const [paRows] = await conn.execute(
      `SELECT id, spare_id, accessory_name, product_code, qty, package_status
       FROM product_accessories WHERE id = ? LIMIT 1`,
      [accessoryId],
    );
    if (!paRows.length) continue;

    const pa = paRows[0];
    if (pa.package_status === "added") continue;

    const deductQty = Number(pa.qty) || 1;
    const spareId = await resolveAccessorySpareId(conn, {
      ...pa,
      product_code: pa.product_code || productCode,
    });

    if (!spareId) {
      console.warn(
        `Skipping accessory "${pa.accessory_name}" (id=${accessoryId}) — spare not linked`,
      );
      continue;
    }

    const [summary] = await conn.execute(
      `SELECT total_quantity, ${locationColumn} FROM stock_summary WHERE spare_id = ?`,
      [spareId],
    );

    const totalDB = summary.length > 0 ? Number(summary[0].total_quantity ?? 0) : 0;
    const locationDB =
      summary.length > 0 ? Number(summary[0][locationColumn] ?? 0) : 0;

    if (locationDB < deductQty) {
      const msg = `Insufficient stock for accessory "${pa.accessory_name}" in ${godown}. Available: ${locationDB}, Required: ${deductQty}`;
      if (partial) {
        console.warn(`Skipping accessory deduction: ${msg}`);
        continue;
      }
      throw new Error(msg);
    }

    const newLocationStock = locationDB - deductQty;
    const totalD = Math.max(totalDB - deductQty, 0);
    const delhiD =
      locationColumnLower === "delhi" ? newLocationStock : locationDB;
    const southD =
      locationColumnLower === "south" ? newLocationStock : locationDB;

    await conn.execute(
      `INSERT INTO stock_list
        (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, added_by, godown, total, delhi, south)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        spareId,
        deductQty,
        null,
        null,
        `Dispatch accessory: ${pa.accessory_name} (dispatch row #${dispatchRowId})`,
        "Dispatch",
        "OUT",
        companyName,
        companyAddress,
        quoteNumber,
        orderNumber,
        username,
        godown,
        totalD,
        delhiD,
        southD,
      ],
    );

    const newTotal = Math.max(totalDB - deductQty, 0);
    const newLocationValue = Math.max(locationDB - deductQty, 0);

    await conn.execute(
      `UPDATE stock_summary
       SET last_updated_quantity = ?, total_quantity = ?, last_status = ?, updated_at = NOW(), ${locationColumn} = ?
       WHERE spare_id = ?`,
      [deductQty, newTotal, "OUT", newLocationValue, spareId],
    );

    deducted.push({
      accessory_id: accessoryId,
      accessory_name: pa.accessory_name,
      spare_id: spareId,
      qty: deductQty,
    });
  }

  return { deducted };
}

/**
 * Deduct accessory stock if checklist provided and not yet deducted for this dispatch row.
 */
export async function processDispatchAccessoryStockDeduction(conn, params) {
  const {
    accessoriesChecklistJson,
    productCode,
    godown,
    quoteNumber,
    orderNumber,
    username,
    dispatchRowId,
    companyName = null,
    companyAddress = null,
  } = params;

  if (!accessoriesChecklistJson || !godown || !productCode) {
    return { deducted: [], skipped: true };
  }

  const isProduct = /[a-zA-Z]/.test(productCode || "");
  if (!isProduct) {
    return { deducted: [], skipped: true };
  }

  await validateCheckedAccessoryStock(conn, {
    accessoriesChecklistJson,
    productCode,
    godown,
  });

  const result = await deductCheckedAccessoryStock(conn, {
    accessoriesChecklistJson,
    productCode,
    godown,
    quoteNumber,
    orderNumber,
    username,
    dispatchRowId,
    companyName,
    companyAddress,
  });

  return result;
}

/**
 * Validate checked accessories have enough stock before dispatch save.
 */
export async function validateCheckedAccessoryStock(conn, options) {
  const { accessoriesChecklistJson, productCode, godown } = options;
  if (!accessoriesChecklistJson || !godown) return;

  let checkedItems;
  try {
    checkedItems = JSON.parse(accessoriesChecklistJson);
  } catch {
    return;
  }
  if (!Array.isArray(checkedItems) || checkedItems.length === 0) return;

  const locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

  for (const item of checkedItems) {
    if (!item.id) continue;

    const [paRows] = await conn.execute(
      `SELECT id, spare_id, accessory_name, product_code, qty, package_status
       FROM product_accessories WHERE id = ? LIMIT 1`,
      [item.id],
    );
    if (!paRows.length) continue;

    const pa = paRows[0];
    if (pa.package_status === "added") continue;

    const deductQty = Number(pa.qty) || 1;
    const spareId = await resolveAccessorySpareId(conn, {
      ...pa,
      product_code: pa.product_code || productCode,
    });

    if (!spareId) {
      console.warn(
        `Skipping accessory "${pa.accessory_name}" (id=${item.id}) — spare not linked`,
      );
      continue;
    }

    const [summary] = await conn.execute(
      `SELECT ${locationColumn} AS location_stock FROM stock_summary WHERE spare_id = ?`,
      [spareId],
    );
    const locationStock =
      summary.length > 0 ? Number(summary[0].location_stock ?? 0) : 0;

    if (locationStock < deductQty) {
      throw new Error(
        `Insufficient stock for accessory "${pa.accessory_name}" in ${godown}. Available: ${locationStock}, Required: ${deductQty}`,
      );
    }
  }
}
