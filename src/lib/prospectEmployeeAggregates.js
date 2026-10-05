/** Tokens inside parentheses (e.g. DV-30); skip (Qty n). */
export function parseModelCodes(modelText) {
  if (modelText == null || String(modelText).trim() === "") {
    return { codes: [], fallback: null };
  }
  const s = String(modelText);
  const re = /\(([^)]+)\)/g;
  const seen = new Set();
  const codes = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const inner = m[1].trim();
    if (!inner) continue;
    if (/^Qty\s*\d+$/i.test(inner)) continue;
    const key = inner.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(inner);
  }
  if (codes.length > 0) return { codes, fallback: null };
  const fb = s.replace(/\s+/g, " ").trim();
  return { codes: [], fallback: fb || null };
}

export function formatProspectModelWithQty(row) {
  const { codes, fallback } = parseModelCodes(row?.model);
  const label =
    codes.length > 0 ? codes.join("/") : fallback != null ? fallback : "—";
  const q = Number(row?.qty);
  const qtyPart = Number.isFinite(q) ? q : 0;
  return `${label} (${qtyPart})`;
}

/**
 * @param {Array<{ created_by?: string|null, customer_id?: string|null, qty?: number|null, amount?: string|number|null, model?: string|null }>} rows
 * @returns {Array<{ name: string, count: number, totalQty: number, totalAmount: number, modelsText: string, customerIds: string[], rows: typeof rows }>}
 */
export function aggregateProspectsByEmployee(rows) {
  /** @type {Map<string, { name: string, count: number, totalQty: number, totalAmount: number, modelParts: string[], customerIds: Set<string>, rows: typeof rows }>} */
  const map = new Map();
  for (const row of rows || []) {
    const name = String(row?.created_by ?? "").trim();
    if (!name) continue;
    let bucket = map.get(name);
    if (!bucket) {
      bucket = {
        name,
        count: 0,
        totalQty: 0,
        totalAmount: 0,
        modelParts: [],
        customerIds: new Set(),
        rows: [],
      };
      map.set(name, bucket);
    }
    bucket.count += 1;
    const q = Number(row?.qty);
    if (Number.isFinite(q)) bucket.totalQty += q;
    const amt = Number(row?.amount);
    if (Number.isFinite(amt)) bucket.totalAmount += amt;
    bucket.modelParts.push(formatProspectModelWithQty(row));
    const cid = String(row?.customer_id ?? "").trim();
    if (cid) bucket.customerIds.add(cid);
    bucket.rows.push(row);
  }
  return [...map.values()]
    .map((b) => ({
      name: b.name,
      count: b.count,
      totalQty: b.totalQty,
      totalAmount: b.totalAmount,
      modelsText: b.modelParts.join(", "),
      customerIds: [...b.customerIds],
      rows: b.rows,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
