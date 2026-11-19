/**
 * Compare on columns that may be utf8mb3, utf8mb4, BINARY, or mixed collations.
 * Normalize with TRIM + CONVERT to utf8mb4 — do not append utf8mb4_unicode_ci on
 * the expression (production MySQL rejects that on utf8mb3-derived values).
 */
export const UTF8_COLLATE = "utf8mb4_unicode_ci";

/** SQL expression: normalize a column/value for safe string compare */
export function sqlUtf8TrimExpr(expr) {
  return `TRIM(CONVERT(${expr} USING utf8mb4))`;
}

function utf8Trim(expr) {
  return sqlUtf8TrimExpr(expr);
}

/** SQL: trimmed column equals trimmed bound parameter */
export function sqlTrimUtf8Eq(columnExpr, param = "?") {
  return `${utf8Trim(columnExpr)} = TRIM(${param})`;
}

/** SQL: two trimmed columns (utf8mb3 / utf8mb4 / mixed collation safe) */
export function sqlTrimUtf8EqColumns(leftExpr, rightExpr) {
  return `${utf8Trim(leftExpr)} = ${utf8Trim(rightExpr)}`;
}

/** SQL: column contains bound parameter (LIKE %?%) */
export function sqlLikeUtf8Contains(columnExpr) {
  // CONVERT(...) uses server default (e.g. uca1400); bound params may be utf8mb4_bin — align both sides.
  const haystack = `${utf8Trim(columnExpr)} COLLATE ${UTF8_COLLATE}`;
  const needle = `TRIM(CONVERT(? USING utf8mb4)) COLLATE ${UTF8_COLLATE}`;
  return `${haystack} LIKE CONCAT('%', ${needle}, '%')`;
}

/** TRIM + utf8mb4 for a nested SQL expression (subquery / COALESCE). */
export function sqlUtf8TrimComplexExpr(exprSql) {
  return `TRIM(CONVERT((${exprSql}) USING utf8mb4))`;
}

/** Non-empty text check without comparing to '' (avoids collation mix on CONVERT). */
export function sqlUtf8HasText(columnExpr) {
  return `CHAR_LENGTH(${utf8Trim(columnExpr)}) > 0`;
}

export function sqlUtf8ComplexHasText(exprSql) {
  return `CHAR_LENGTH(${sqlUtf8TrimComplexExpr(exprSql)}) > 0`;
}

/** LIKE %?% on a nested SQL expression. */
export function sqlLikeUtf8ContainsExpr(exprSql) {
  const haystack = `${sqlUtf8TrimComplexExpr(exprSql)} COLLATE ${UTF8_COLLATE}`;
  const needle = `TRIM(CONVERT(? USING utf8mb4)) COLLATE ${UTF8_COLLATE}`;
  return `${haystack} LIKE CONCAT('%', ${needle}, '%')`;
}
