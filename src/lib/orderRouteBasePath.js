/**
 * Order sub-routes are shared under /user-dashboard/order via rewrites.
 * Use the browser pathname (or middleware request header) for list redirects.
 */

const DASHBOARD_ORDER_PREFIXES = [
  "/warehouse-incharge/order",
  "/director-dashboard/order",
  "/accounts-dashboard/order",
  "/sales-dashboard/order",
  "/hr-dashboard/order",
  "/service-head-dashboard/order",
  "/digital-marketing-dashboard/order",
  "/admin-dashboard/order",
];

export function resolveOrderBasePathFromPathname(pathname) {
  const p = String(pathname || "");
  for (const prefix of DASHBOARD_ORDER_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return "/user-dashboard/order";
}

export async function getServerOrderBasePath() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const fromHeader = h.get("x-order-base-path");
  if (fromHeader && fromHeader.startsWith("/")) {
    return fromHeader;
  }
  return "/user-dashboard/order";
}
