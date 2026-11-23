import {
  getAdminOrderPaymentColumnAmount,
  getAdminOrderTotalAmount,
} from "@/lib/adminOrderAmounts";

function normalizeApprovalStatus(status) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "pending";
  return s;
}

function isOrderCancelled(order) {
  return Number(order?.is_cancelled) === 1;
}

function isOrderExcludedFromStatCards(order) {
  if (normalizeApprovalStatus(order.approval_status) === "rejected") return true;
  if (isOrderCancelled(order)) return true;
  return false;
}

function normalizeModelCode(code) {
  return String(code || "").trim().toUpperCase();
}

function parseOrderLineItems(order) {
  if (Array.isArray(order?.line_items)) return order.line_items;
  return [];
}

function dedupeOrderLineItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = [
      normalizeModelCode(item?.item_code),
      String(item?.item_name || "").trim(),
      Number(item?.quantity) || 0,
      lineItemTaxableAmount(item),
      lineItemTotalAmount(item),
    ].join("\u0001");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function lineItemTaxableAmount(item) {
  const n = Number(
    item?.taxable_amount ?? item?.taxable_price ?? item?.total_taxable_amt ?? 0,
  );
  return Number.isFinite(n) ? n : 0;
}

function lineItemTotalAmount(item) {
  const n = Number(item?.total_amount ?? item?.total_price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveItemType(codeKey, catalogByCode, spareCatalogByCode) {
  if (catalogByCode.has(codeKey)) return "product";
  if (spareCatalogByCode.has(codeKey)) return "spare";
  return /[a-zA-Z]/.test(codeKey) ? "product" : "spare";
}

function resolveLineItemCatalogType(item, catalogByCode, spareCatalogByCode) {
  const codeKey = normalizeModelCode(item?.item_code);
  const explicit = String(item?.item_type || "").trim().toLowerCase();
  if (explicit === "spare" || explicit === "product") return explicit;
  return resolveItemType(codeKey, catalogByCode, spareCatalogByCode);
}

export function orderMatchesItemLineTypeFilter(
  order,
  filter,
  catalogByCode,
  spareCatalogByCode,
) {
  const v = String(filter || "").trim().toLowerCase();
  if (!v) return true;

  const items = parseOrderLineItems(order);
  if (!items.length) return false;

  let hasProduct = false;
  let hasSpare = false;
  for (const item of items) {
    const type = resolveLineItemCatalogType(item, catalogByCode, spareCatalogByCode);
    if (type === "spare") hasSpare = true;
    else hasProduct = true;
  }

  if (v === "products") return hasProduct;
  if (v === "spares") return hasSpare;
  if (v === "mixed") return hasProduct && hasSpare;
  if (v === "products_only") return hasProduct && !hasSpare;
  if (v === "spares_only") return hasSpare && !hasProduct;
  return true;
}

const EMPTY_TOTALS = {
  products: { taxable: 0, total: 0 },
  spares: { taxable: 0, total: 0 },
};

function splitOrderAmountsByProductSpare(
  order,
  items,
  catalogByCode,
  spareCatalogByCode,
) {
  const orderTaxable = getAdminOrderPaymentColumnAmount(order);
  const orderTotal = getAdminOrderTotalAmount(order);

  let productTaxable = 0;
  let spareTaxable = 0;
  let productTotal = 0;
  let spareTotal = 0;

  for (const item of items) {
    const type = resolveLineItemCatalogType(item, catalogByCode, spareCatalogByCode);
    const tax = lineItemTaxableAmount(item);
    const tot = lineItemTotalAmount(item);
    if (type === "spare") {
      spareTaxable += tax;
      spareTotal += tot;
    } else {
      productTaxable += tax;
      productTotal += tot;
    }
  }

  const taxWeight = productTaxable + spareTaxable;
  const totalWeight = productTotal + spareTotal;

  const products = { taxable: 0, total: 0 };
  const spares = { taxable: 0, total: 0 };

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  if (taxWeight > 0) {
    products.taxable = round2(orderTaxable * (productTaxable / taxWeight));
    spares.taxable = round2(orderTaxable - products.taxable);
  } else if (orderTaxable > 0) {
    products.taxable = round2(orderTaxable);
  }

  if (totalWeight > 0) {
    products.total = round2(orderTotal * (productTotal / totalWeight));
    spares.total = round2(orderTotal - products.total);
  } else if (orderTotal > 0) {
    products.total = round2(orderTotal);
  }

  return { products, spares };
}

/**
 * Product vs spare split aligned to Amount Summary (order-level taxable / grand total).
 */
export function computeAdminOrderProductSpareTotals(
  orders,
  catalogByCode,
  spareCatalogByCode,
  { itemLineTypeFilter = "" } = {},
) {
  const list = Array.isArray(orders) ? orders : [];

  const acc = {
    products: { taxable: 0, total: 0 },
    spares: { taxable: 0, total: 0 },
  };

  for (const order of list) {
    if (normalizeApprovalStatus(order.approval_status) !== "approved") continue;
    if (isOrderExcludedFromStatCards(order)) continue;

    const items = dedupeOrderLineItems(parseOrderLineItems(order));

    if (
      itemLineTypeFilter &&
      !orderMatchesItemLineTypeFilter(
        order,
        itemLineTypeFilter,
        catalogByCode,
        spareCatalogByCode,
      )
    ) {
      continue;
    }

    const split = splitOrderAmountsByProductSpare(
      order,
      items,
      catalogByCode,
      spareCatalogByCode,
    );
    acc.products.taxable += split.products.taxable;
    acc.products.total += split.products.total;
    acc.spares.taxable += split.spares.taxable;
    acc.spares.total += split.spares.total;
  }

  return acc;
}

export function classifyLineItemTaxableAmount(
  item,
  catalogByCode,
  spareCatalogByCode,
) {
  const type = resolveLineItemCatalogType(item, catalogByCode, spareCatalogByCode);
  return { type, amount: lineItemTaxableAmount(item) };
}

export async function loadAdminOrderListCatalogMaps(conn) {
  const [productRows] = await conn.execute(
    `SELECT item_code FROM products_list WHERE item_code IS NOT NULL AND TRIM(item_code) <> ''`,
  );
  const [spareRows] = await conn.execute(
    `SELECT id, spare_number FROM spare_list`,
  );

  const catalogByCode = new Map();
  for (const product of productRows) {
    const key = normalizeModelCode(product.item_code);
    if (key) catalogByCode.set(key, product);
  }

  const spareCatalogByCode = new Map();
  for (const spare of spareRows) {
    const numberKey = normalizeModelCode(spare.spare_number);
    const idKey = normalizeModelCode(spare.id);
    if (numberKey) spareCatalogByCode.set(numberKey, spare);
    if (idKey) spareCatalogByCode.set(idKey, spare);
  }

  return { catalogByCode, spareCatalogByCode };
}

export { EMPTY_TOTALS as EMPTY_PRODUCT_SPARE_TOTALS };