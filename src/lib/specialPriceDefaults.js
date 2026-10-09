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
