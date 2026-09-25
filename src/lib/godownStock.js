export function isDelhiGodown(godown) {
  return String(godown || "").trim() === "Delhi - Mundka";
}

export function getGodownLocationColumn(godown) {
  return isDelhiGodown(godown) ? "Delhi" : "South";
}

export function getGodownLocationColumnLower(godown) {
  return isDelhiGodown(godown) ? "delhi" : "south";
}

/** Read Delhi/South (or any column) regardless of MySQL driver casing. */
export function pickRowColumn(row, column) {
  if (!row || column == null) return 0;
  const target = String(column).toLowerCase();
  const key = Object.keys(row).find((k) => k.toLowerCase() === target);
  return Number(key ? row[key] : 0) || 0;
}
