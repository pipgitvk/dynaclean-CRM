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
  const needle = "TRIM(?)";
  return `${utf8Trim(columnExpr)} LIKE CONCAT('%', ${needle}, '%')`;
}
