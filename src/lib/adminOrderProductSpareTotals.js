function normalizeApprovalStatus(status) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (!s || s === "null" || s === "undefined") return "pending";
  return s;
}

function isOrderExcludedFromStatCards(order) {
  if (normalizeApprovalStatus(order.approval_status) === "rejected") return true;
  if (order.is_cancelled) return true;
  return false;
}

function normalizeModelCode(code) {
  return String(code || "").trim().toUpperCase();
}

function parseOrderLineItems(order) {
  if (Array.isArray(order?.line_items)) return order.line_items;
  return [];
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

/**
 * Sum product vs spare line amounts for admin order list cards.
 */
export function computeAdminOrderProductSpareTotals(
  orders,
  catalogByCode,
  spareCatalogByCode,
  {
    approvalStatusFilter = "",
    itemLineTypeFilter = "",
    approvedOnly = true,
  } = {},
) {
  const list = Array.isArray(orders) ? orders : [];
  const isRejectedOnlyView =
    approvalStatusFilter.toString().trim().toLowerCase() === "rejected";
  const requireApproved = approvedOnly && !isRejectedOnlyView;

  const acc = {
    products: { taxable: 0, total: 0 },
    spares: { taxable: 0, total: 0 },
  };

  for (const order of list) {
    if (requireApproved && normalizeApprovalStatus(order.approval_status) !== "approved") {
      continue;
    }
    if (!isRejectedOnlyView && isOrderExcludedFromStatCards(order)) continue;

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

    const items = parseOrderLineItems(order);
    if (!items.length) continue;

    for (const item of items) {
      const type = resolveLineItemCatalogType(item, catalogByCode, spareCatalogByCode);
      const bucket = type === "spare" ? acc.spares : acc.products;
      bucket.taxable += lineItemTaxableAmount(item);
      bucket.total += lineItemTotalAmount(item);
    }
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