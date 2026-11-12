import { ensureProductAccessoriesColumns } from "@/lib/ensureProductAccessoriesColumns";
import {
  isBatteryAccessory,
  rowMatchesBatterySpare,
  spareKey,
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

function zeroPatModalPrices(item) {
  return {
    ...item,
    price_per_unit: 0,
    taxable_price: 0,
    total_price: 0,
    total_taxable_amt: 0,
    pat_battery_included: true,
  };
}

async function resolveProductCodesOnQuote(conn, items) {
  const codes = [
    ...new Set(
      (items || [])
        .map((i) => String(i.item_code || "").trim())
        .filter(Boolean),
    ),
  ];
  const names = [
    ...new Set(
      (items || [])
        .map((i) => String(i.item_name || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!codes.length && !names.length) return [];

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

  return [...new Set(products.map((p) => String(p.item_code || "").trim()).filter(Boolean))];
}

function isBundledBatteryAccessory(accessory) {
  if (!isBatteryAccessory(accessory)) return false;
  const status = String(accessory?.package_status || "available").trim().toLowerCase();
  return status !== "added";
}

/**
 * PAT Revenue from Sales order modal: batteries included in the machine package
 * (package_status available, not added as extra) show ₹0.
 */
export async function applyPatRevenueSalesBatteryDisplay(conn, items, patSection) {
  const section = String(patSection ?? "").trim();
  if (section !== "revenue_sales") return items;
  if (!Array.isArray(items) || items.length === 0) return items;

  try {
    await ensureProductAccessoriesColumns(conn);
    const productCodes = await resolveProductCodesOnQuote(conn, items);
    if (!productCodes.length) return items;

    const accessories = await queryIn(
      conn,
      `SELECT pa.product_code, pa.spare_id, pa.accessory_name, pa.qty, pa.package_status,
              sl.item_name AS spare_name, sl.spare_number
       FROM product_accessories pa
       LEFT JOIN spare_list sl ON sl.id = pa.spare_id
       WHERE pa.product_code IN`,
      productCodes,
    );

    const bundledBatteries = accessories.filter(isBundledBatteryAccessory);
    if (!bundledBatteries.length) return items;

    const coveredSpareKeys = new Set();
    const out = items.map((item) => {
      const row = {
        item_code: item.item_code,
        item_name: item.item_name,
      };
      const matchesBundled = bundledBatteries.some((acc) =>
        rowMatchesBatterySpare(row, acc),
      );
      if (matchesBundled) {
        for (const acc of bundledBatteries) {
          if (rowMatchesBatterySpare(row, acc)) {
            const key = spareKey(acc);
            if (key) coveredSpareKeys.add(key);
          }
        }
        return zeroPatModalPrices(item);
      }
      return item;
    });

    let syntheticId = -1;
    for (const acc of bundledBatteries) {
      const key = spareKey(acc);
      if (!key || coveredSpareKeys.has(key)) continue;
      coveredSpareKeys.add(key);

      const name =
        String(acc.spare_name || acc.accessory_name || "Battery").trim() ||
        "Battery";
      const code =
        String(acc.spare_number || acc.spare_id || "").trim() || name;
      const qty = Number(acc.qty) > 0 ? Number(acc.qty) : 1;

      out.push({
        id: syntheticId--,
        item_name: name,
        item_code: code,
        quantity: qty,
        unit: "Nos",
        price_per_unit: 0,
        taxable_price: 0,
        total_price: 0,
        total_taxable_amt: 0,
        pat_battery_included: true,
      });
    }

    return out;
  } catch (e) {
    console.error("applyPatRevenueSalesBatteryDisplay:", e);
    return items;
  }
}
