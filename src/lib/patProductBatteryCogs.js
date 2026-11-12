import { ensureProductAccessoriesColumns } from "@/lib/ensureProductAccessoriesColumns";
import {
  batteryAddedAmount,
  isBatteryAccessory,
} from "@/lib/itemWiseSalesBatteryBuyPrice";

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function queryIn(conn, sqlPrefix, values, sqlSuffix = "") {
  if (!values.length) return [];
  const rows = [];
  for (const part of chunk(values, 400)) {
    const placeholders = part.map(() => "?").join(", ");
    const [found] = await conn.query(
      `${sqlPrefix} (${placeholders}) ${sqlSuffix}`,
      part,
    );
    rows.push(...found);
  }
  return rows;
}

/**
 * Battery buy unit add-on per machine (product accessories package_status = added).
 * Same rules as item-wise sales report.
 */
export async function buildPatBatteryCogsContext(conn, soldRows = []) {
  const empty = {
    productByCode: new Map(),
    productByName: new Map(),
    batteriesByProduct: new Map(),
    priceBySpareKey: new Map(),
  };

  const codes = [
    ...new Set(
      (soldRows || [])
        .map((r) => String(r.item_code_display || "").trim())
        .filter(Boolean),
    ),
  ];
  const names = [
    ...new Set(
      (soldRows || [])
        .map((r) =>
          String(r.item_display_name || r.item_name_display || "").trim(),
        )
        .filter(Boolean),
    ),
  ];

  if (!codes.length && !names.length) return empty;

  try {
    await ensureProductAccessoriesColumns(conn);

    const products = [
      ...(await queryIn(
        conn,
        "SELECT item_code, item_name FROM products_list WHERE item_code IN",
        codes,
      )),
      ...(await queryIn(
        conn,
        "SELECT item_code, item_name FROM products_list WHERE item_name IN",
        names,
      )),
      ...(await queryIn(
        conn,
        "SELECT item_code, item_name FROM products_list WHERE CAST(product_number AS CHAR) IN",
        codes,
      )),
    ];

    const productByCode = new Map();
    const productByName = new Map();
    for (const product of products) {
      const code = String(product.item_code || "").trim();
      const name = String(product.item_name || "").trim().toLowerCase();
      if (code) productByCode.set(code.toLowerCase(), code);
      if (code) productByCode.set(code, code);
      if (code && name) productByName.set(name, code);
    }

    const productCodes = [...new Set([...productByCode.values()])];
    if (!productCodes.length) {
      return { ...empty, productByCode, productByName };
    }

    const accessories = await queryIn(
      conn,
      `SELECT pa.product_code, pa.spare_id, pa.accessory_name, pa.is_mandatory, pa.qty, pa.package_status,
              sl.item_name AS spare_name, sl.spare_number
       FROM product_accessories pa
       LEFT JOIN spare_list sl ON sl.id = pa.spare_id
       WHERE pa.package_status = 'added'
         AND pa.product_code IN`,
      productCodes,
    );
    const batteries = accessories.filter(isBatteryAccessory);

    const batteriesByProduct = new Map();
    for (const battery of batteries) {
      const code = String(battery.product_code || "").trim();
      if (!batteriesByProduct.has(code)) batteriesByProduct.set(code, []);
      batteriesByProduct.get(code).push(battery);
    }

    if (!batteries.length) {
      return { productByCode, productByName, batteriesByProduct, priceBySpareKey: new Map() };
    }

    const spareIds = [
      ...new Set(batteries.map((row) => row.spare_id).filter((id) => id != null)),
    ];
    const spareNames = [
      ...new Set(
        batteries
          .map((row) => String(row.spare_name || row.accessory_name || "").trim())
          .filter(Boolean),
      ),
    ];

    const priceBySpareKey = new Map();
    const priceRows = [
      ...(await queryIn(
        conn,
        `SELECT id, spare_id, spare_name,
                COALESCE(NULLIF(price_per_unit, 0), NULLIF(amount_per_unit, 0), 0) AS unit_price
         FROM spare_stock_request
         WHERE spare_id IN`,
        spareIds,
        "ORDER BY id DESC",
      )),
      ...(await queryIn(
        conn,
        `SELECT id, spare_id, spare_name,
                COALESCE(NULLIF(price_per_unit, 0), NULLIF(amount_per_unit, 0), 0) AS unit_price
         FROM spare_stock_request
         WHERE spare_name IN`,
        spareNames,
        "ORDER BY id DESC",
      )),
    ].sort((a, b) => Number(b.id) - Number(a.id));

    for (const priceRow of priceRows) {
      const idKey =
        priceRow.spare_id != null ? `id:${String(priceRow.spare_id).trim()}` : "";
      const nameKey = String(priceRow.spare_name || "").trim().toLowerCase();
      const amount = Number(priceRow.unit_price) || 0;
      if (idKey && !priceBySpareKey.has(idKey)) priceBySpareKey.set(idKey, amount);
      if (nameKey && !priceBySpareKey.has(`name:${nameKey}`)) {
        priceBySpareKey.set(`name:${nameKey}`, amount);
      }
    }

  if (spareIds.length) {
      const masters = await queryIn(
        conn,
        `SELECT id, purchase_price FROM spare_list WHERE id IN`,
        spareIds,
      );
      for (const m of masters) {
        const idKey = `id:${String(m.id).trim()}`;
        const price = Number(m.purchase_price) || 0;
        if (price > 0 && !(priceBySpareKey.get(idKey) > 0)) {
          priceBySpareKey.set(idKey, price);
        }
      }
    }

    return { productByCode, productByName, batteriesByProduct, priceBySpareKey };
  } catch (e) {
    console.error("buildPatBatteryCogsContext:", e);
    return empty;
  }
}

export function resolvePatProductCodeForBattery(itemCodeDisplay, itemDisplayName, ctx) {
  const code = String(itemCodeDisplay || "").trim();
  const name = String(itemDisplayName || "").trim().toLowerCase();
  if (!code && !name) return null;
  return (
    ctx.productByCode.get(code) ||
    ctx.productByCode.get(code.toLowerCase()) ||
    ctx.productByName.get(name) ||
    ctx.productByName.get(code.toLowerCase()) ||
    null
  );
}

export function patBatteryUnitAddOn(itemCodeDisplay, itemDisplayName, ctx) {
  const productCode = resolvePatProductCodeForBattery(
    itemCodeDisplay,
    itemDisplayName,
    ctx,
  );
  if (!productCode) return 0;
  const accessories = ctx.batteriesByProduct.get(productCode) || [];
  return batteryAddedAmount(accessories, ctx.priceBySpareKey);
}
