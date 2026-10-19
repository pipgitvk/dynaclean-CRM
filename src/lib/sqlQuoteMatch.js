/**
 * dispatch.quote_number may be BINARY — avoid COLLATE on binary; normalize via utf8mb4 CONVERT.
 */

/** Normalize quote keys for JS Map lookups (Buffer / binary / spaces). */
export function normalizeQuoteKey(value) {
  if (value == null) return "";
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8").trim();
  }
  if (typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    return Buffer.from(value.data).toString("utf8").trim();
  }
  return String(value).trim();
}

export function sqlQuoteTrimEqColumn(columnRef) {
  return `TRIM(CONVERT(${columnRef} USING utf8mb4)) = TRIM(?)`;
}

export function sqlQuoteTrimEqColumns(leftRef, rightRef) {
  return `TRIM(CONVERT(${leftRef} USING utf8mb4)) = TRIM(CONVERT(${rightRef} USING utf8mb4))`;
}

/** `columnRef IN (?,?,…)` with placeholders only in `inClause`. */
export function sqlQuoteTrimIn(columnRef, inClause) {
  return `TRIM(CONVERT(${columnRef} USING utf8mb4)) IN (${inClause})`;
}
