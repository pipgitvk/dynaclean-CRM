/**
 * Server-side filters aligned with TLCustomersTable client rules.
 */

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
  if (!tag) return query;
  if (tag === "N/A" || tag === "Clear") {
    return `${query} AND (${sqlMultiTagExpr} IS NULL OR ${sqlMultiTagExpr} = '')`;
  }
  params.push(tag, tag);
  return `${query} AND (CONCAT(', ', ${sqlMultiTagExpr}, ', ') LIKE CONCAT('%, ', ?, ', %') OR ${sqlMultiTagExpr} = ?)`;
}
