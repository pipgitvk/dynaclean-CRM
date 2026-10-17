/** Where to go after creating an invoice from an order flow. */
export function resolveOrderListRedirectAfterInvoiceCreate({
  onSuccessRedirect,
  orderId,
  initialOrderId,
  buyersOrderNo,
  pathname = "",
}) {
  const explicit = String(onSuccessRedirect || "").trim();
  if (explicit) return explicit;

  let returnTo = "";
  if (typeof window !== "undefined") {
    returnTo = String(
      new URLSearchParams(window.location.search).get("return_to") || "",
    ).trim();
  }
  if (returnTo) return returnTo;

  const oid = String(
    orderId || initialOrderId || buyersOrderNo || "",
  ).trim();
  if (!oid) return null;

  const path =
    pathname ||
    (typeof window !== "undefined" ? window.location.pathname : "");
  if (path.includes("/admin-dashboard/")) return "/admin-dashboard/order";
  if (path.includes("/accounts-dashboard/")) return "/accounts-dashboard/order";
  return "/accounts-dashboard/order";
}

export function navigateAfterInvoiceCreate(router, url) {
  if (!url) return;
  try {
    router.replace(url);
  } catch (_) {
    /* fallback below */
  }
  if (typeof window !== "undefined") {
    window.location.assign(url);
  }
}
