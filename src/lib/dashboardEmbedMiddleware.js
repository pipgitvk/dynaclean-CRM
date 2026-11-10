import { NextResponse } from "next/server";
import { DASHBOARD_EMBED_COOKIE } from "@/lib/dashboardEmbed";

export function shouldUseDashboardEmbed(request) {
  if (request.nextUrl.searchParams.get("embed") === "1") return true;
  const cookie = request.cookies.get(DASHBOARD_EMBED_COOKIE)?.value === "1";
  const dest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
  return cookie && dest === "iframe";
}

function stampEmbedCookie(request, response) {
  if (request.nextUrl.searchParams.get("embed") === "1") {
    response.cookies.set(DASHBOARD_EMBED_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

/**
 * Continue with optional `x-dashboard-embed` + session cookie when popup iframe navigates
 * without `embed=1` on every link (e.g. View → Edit).
 */
export function nextWithDashboardEmbed(request, mutateRequestHeaders) {
  const requestHeaders = new Headers(request.headers);
  if (typeof mutateRequestHeaders === "function") {
    mutateRequestHeaders(requestHeaders);
  }
  if (shouldUseDashboardEmbed(request)) {
    requestHeaders.set("x-dashboard-embed", "1");
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return stampEmbedCookie(request, response);
}
