/** Sidebar list sort for products / spares inventory pages. */

export const INVENTORY_SIDEBAR_SORT_OPTIONS = [
  { value: "qty_desc", label: "Qty (High → Low)" },
  { value: "qty_asc", label: "Qty (Low → High)" },
  { value: "name", label: "Name (A–Z)" },
];

/**
 * @param {Function} [options.stockOf] — badge / available stock (default total_qty)
 */
export function sortInventorySidebarRows(rows, sortMode, options = {}) {
  const { nameKey = "item_name", stockOf } = options;
  const list = Array.isArray(rows) ? [...rows] : [];
  const nameOf = (r) => String(r?.[nameKey] ?? "").trim();
  const stockOfRow =
    stockOf ||
    ((r) => {
      const n = Number(r?.total_qty);
      return Number.isFinite(n) ? n : 0;
    });

  if (sortMode === "name") {
    return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }

  const byNumeric = (getVal, desc) =>
    list.sort((a, b) => {
      const diff = getVal(a) - getVal(b);
      if (diff !== 0) return desc ? -diff : diff;
      return nameOf(a).localeCompare(nameOf(b));
    });

  if (sortMode === "qty_desc") return byNumeric(stockOfRow, true);
  if (sortMode === "qty_asc") return byNumeric(stockOfRow, false);

  return list;
}
