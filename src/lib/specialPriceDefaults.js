export const SPECIAL_PRICE_TYPE_DEFAULT = "special price";
export const SPECIAL_PRICE_TERM_DEFAULT = "with delivery and warranty";
export const DEALER_PRICE_TYPE = "Dealer Price";

export const DEALER_PRICE_TERM_OPTIONS = [
  "with delivery and warranty",
  "without delivery and warranty",
];

export function isDealerPriceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dealer price" || normalized === "dealer";
}

export function resolveSpecialPriceType(value) {
  const trimmed = String(value || "").trim();
  return trimmed || SPECIAL_PRICE_TYPE_DEFAULT;
}

export function resolveSpecialPriceTerm(value) {
  const trimmed = String(value || "").trim();
  return trimmed || SPECIAL_PRICE_TERM_DEFAULT;
}

/** Rows the special-pricing table shows as pending (not approved/rejected). */
export const SPECIAL_PRICE_PENDING_CONDITION =
  "LOWER(TRIM(IFNULL(sp.status, ''))) NOT IN ('approved', 'rejected')";

export function isDealerPricePending(row) {
  return (
    isDealerPriceType(row?.price_type) &&
    String(row?.status || "").toLowerCase() === "pending" &&
    Number(row?.special_price || 0) === 0
  );
}

function normalizeDealerPriceTerm(priceTerm) {
  return String(priceTerm || "").trim().toLowerCase();
}

/** DP from product-stock: `dp` (with delivery & warranty) or `dp_no_warranty`. */
export function resolveDealerPriceFromProductStock(priceTerm, stockRow) {
  const term = normalizeDealerPriceTerm(priceTerm);
  if (term === DEALER_PRICE_TERM_OPTIONS[1].toLowerCase()) {
    const n = Number(stockRow?.dp_no_warranty ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (term === DEALER_PRICE_TERM_OPTIONS[0].toLowerCase()) {
    const n = Number(stockRow?.dp ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Standard approval remark for auto dealer-price approval. */
export function dealerApprovalNoteForTerm(priceTerm) {
  const term = normalizeDealerPriceTerm(priceTerm);
  if (term === DEALER_PRICE_TERM_OPTIONS[1].toLowerCase()) {
    return "DP with no delivery and warranty.";
  }
  if (term === DEALER_PRICE_TERM_OPTIONS[0].toLowerCase()) {
    return "DP price";
  }
  return "Dealer price approved.";
}

export function canAutoApproveDealerPrice(row) {
  if (!isDealerPricePending(row)) return false;
  const stock = {
    dp: row?.stock_dp ?? row?.dp,
    dp_no_warranty: row?.stock_dp_no_warranty ?? row?.dp_no_warranty,
  };
  return resolveDealerPriceFromProductStock(row?.price_term, stock) != null;
}
