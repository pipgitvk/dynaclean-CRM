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

export function isDealerPricePending(row) {
  return (
    isDealerPriceType(row?.price_type) &&
    String(row?.status || "").toLowerCase() === "pending" &&
    Number(row?.special_price || 0) === 0
  );
}
