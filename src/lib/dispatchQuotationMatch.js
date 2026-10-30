function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Match a dispatch row to a quotation line (code/name aliases). */
export function dispatchRowMatchesQuotationLine(dispatchRow, qiRow) {
  const dCode = norm(dispatchRow.item_code);
  const dName = norm(dispatchRow.item_name);
  const qCode = norm(qiRow.item_code);
  const qName = norm(qiRow.item_name);

  if (dCode && qCode && dCode === qCode) return true;
  if (dName && qName && dName === qName) return true;
  if (dCode && qName && (dCode === qName || qName.includes(dCode) || dCode.includes(qName))) {
    return true;
  }
  if (dName && qCode && (dName === qCode || dName.includes(qCode) || qCode.includes(dName))) {
    return true;
  }
  return false;
}

/**
 * Seeded dispatch rows default dispatch_active=1 before first prepare.
 * Do not treat them as allocated / open batch until prepare or dispatch starts.
 */
export function isLegacyUnpreparedDispatchState(dispatchRows) {
  const rows = dispatchRows || [];
  const undispatched = rows.filter((d) => !dispatchRowIsShipped(d));
  if (undispatched.length === 0) return false;
  const hasDeferred = undispatched.some((d) => Number(d.dispatch_active) === 0);
  const hasShipped = rows.some((d) => dispatchRowIsShipped(d));
  if (hasDeferred || hasShipped) return false;
  return undispatched.every((d) => Number(d.dispatch_active) === 1);
}

/** Row already left warehouse (saved serial / stock deducted). */
export function dispatchRowIsShipped(dispatchRow) {
  if (Number(dispatchRow?.stock_deducted) === 1) return true;
  const serial = String(dispatchRow?.serial_no ?? "").trim();
  return serial !== "";
}

/** @param {object} dispatchRow @param {object[]} dispatchRows */
export function dispatchRowAllocatesUnit(dispatchRow, dispatchRows) {
  if (dispatchRowIsShipped(dispatchRow)) return true;
  if (Number(dispatchRow.dispatch_active) !== 1) return false;
  return !isLegacyUnpreparedDispatchState(dispatchRows);
}

/**
 * @param {object[]} quotationItems
 * @param {object[]} dispatchRows
 */
export function computeDispatchPendingFromRows(quotationItems, dispatchRows) {
  let pendingUnits = 0;
  let openDispatchUnits = 0;
  let shippedUnits = 0;
  const rows = dispatchRows || [];
  const qiList = quotationItems || [];
  const legacyUnprepared = isLegacyUnpreparedDispatchState(rows);

  // Raw shipped count (even if quotation match fails) — drives View Dispatch / hide Dispatch
  let rawShipped = 0;
  for (const row of rows) {
    if (dispatchRowIsShipped(row)) rawShipped += 1;
  }

  if (!legacyUnprepared) {
    for (const row of rows) {
      if (dispatchRowIsShipped(row)) continue;
      if (Number(row.dispatch_active) !== 1) continue;
      const matchesOrderLine =
        qiList.length === 0 ||
        qiList.some((qi) => dispatchRowMatchesQuotationLine(row, qi));
      if (matchesOrderLine) openDispatchUnits += 1;
    }
  }

  if (qiList.length === 0) {
    return {
      pending_units: Math.max(0, rows.length - rawShipped),
      open_dispatch_units: openDispatchUnits,
      shipped_units: rawShipped,
    };
  }

  for (const qi of qiList) {
    const orderQty = Math.max(1, Number(qi.quantity) || 1);
    let allocated = 0;
    let deducted = 0;
    for (const d of rows) {
      if (!dispatchRowMatchesQuotationLine(d, qi)) continue;
      if (dispatchRowIsShipped(d)) deducted += 1;
      if (dispatchRowAllocatesUnit(d, rows)) allocated += 1;
    }
    shippedUnits += Math.min(orderQty, deducted);
    pendingUnits += Math.max(0, orderQty - deducted);
  }

  // Prefer quotation-matched shipped; fall back to raw if match missed
  if (shippedUnits <= 0 && rawShipped > 0) {
    shippedUnits = rawShipped;
  }

  return {
    pending_units: pendingUnits,
    open_dispatch_units: openDispatchUnits,
    shipped_units: shippedUnits,
  };
}
