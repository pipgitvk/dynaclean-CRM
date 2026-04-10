/** TL follow-up tag chips — shared by form and TL customers filter */

export const BASE_TL_TAG_OPTIONS = [
  "Demo",
  "Prime",
  "Repeat order",
  "Mail",
  "Truck FollowUp",
  "Payment Collection",
  "Strong FollowUp",
  "Service Issue",
  "Running Orders",
  "Clear",
  "order-recieved",
  "cancel order",
];

export function getTlTagOptions() {
  return [...BASE_TL_TAG_OPTIONS];
}

/** Tag filter order on TL customers list (`TLCustomersTable`) */
export const TL_CUSTOMERS_TABLE_BASE_TAGS = [
  "Demo",
  "Payment Collection",
  "Truck FollowUp",
  "Strong FollowUp",
  "Service Issue",
  "Prime",
  "Repeat order",
  "Mail",
  "Running Orders",
  "Clear",
  "order-recieved",
  "cancel order",
];

export function getTlCustomersTableTagOptions() {
  return [...TL_CUSTOMERS_TABLE_BASE_TAGS];
}
