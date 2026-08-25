/**
 * Server-side filters aligned with TLCustomersTable client rules.
 */

/** Next.js searchParams values may be string | string[] | undefined. */
export function normalizeSearchParam(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value[0] ?? undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Mirrors allowCustomerByStatus() when status dropdown is "All Statuses". */
export function shouldHideDeniedInvalidLeads({
  showTLOnly,
  isSuperAdmin,
  statusFilter,
}) {
  if (statusFilter) return false;
  if (!showTLOnly && isSuperAdmin) return false;
  return true;
}

export function appendStatusVisibilityFilter(
  query,
  { showTLOnly, isSuperAdmin, statusFilter },
) {
  if (
    !shouldHideDeniedInvalidLeads({ showTLOnly, isSuperAdmin, statusFilter })
  ) {
    return query;
  }
  return `${query} AND c.status NOT IN ('Denied', 'Invalid')`;
}

/**
 * Exact multi-tag match (", " delimited) — same logic as getTagCounts().
 * @param {string} sqlMultiTagExpr e.g. "tlf.multi_tag" or "cf.multi_tag"
 */
export function appendExactMultiTagFilter(
  query,
  params,
  tag,
  sqlMultiTagExpr,
) {
  const normalizedTag = normalizeSearchParam(tag);
  if (!normalizedTag) return query;
  if (normalizedTag === "N/A" || normalizedTag === "Clear") {
    return `${query} AND (${sqlMultiTagExpr} IS NULL OR ${sqlMultiTagExpr} = '')`;
  }
  params.push(normalizedTag, normalizedTag);
  return `${query} AND (CONCAT(', ', ${sqlMultiTagExpr}, ', ') LIKE CONCAT('%, ', ?, ', %') OR ${sqlMultiTagExpr} = ?)`;
}
