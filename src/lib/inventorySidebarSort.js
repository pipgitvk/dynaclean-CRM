/** Sidebar list sort for products / spares inventory pages. */

export const INVENTORY_SIDEBAR_SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "min_qty_asc", label: "Min Qty (Low → High)" },
  { value: "min_qty_desc", label: "Min Qty (High → Low)" },
];

export function sortInventorySidebarRows(rows, sortMode, { nameKey = "item_name" } = {}) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const nameOf = (r) => String(r?.[nameKey] ?? "").trim();

  if (sortMode === "name") {
    return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }

  const minOf = (r) => {
    const n = Number(r?.min_qty);
    return Number.isFinite(n) ? n : 0;
  };

  return list.sort((a, b) => {
    const diff = minOf(a) - minOf(b);
    if (diff !== 0) {
      return sortMode === "min_qty_desc" ? -diff : diff;
    }
    return nameOf(a).localeCompare(nameOf(b));
  });
}
