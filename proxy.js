import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const token =
    request.cookies.get("impersonation_token")?.value ||
    request.cookies.get("token")?.value;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;

      if (role === "SUPERADMIN") {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }
    } catch (err) {
      return NextResponse.next();
    }
  }

  if (
    pathname.startsWith("/admin-dashboard") ||
    pathname.startsWith("/user-dashboard") ||
    pathname.startsWith("/empcrm")
  ) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;
      const isImpersonated = payload.impersonated;

      if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }

      if (pathname.startsWith("/admin-dashboard/company-documents")) {
        if (!["SUPERADMIN", "ADMIN", "ACCOUNTANT"].includes(role)) {
          return NextResponse.redirect(
            new URL("/admin-dashboard", request.url),
          );
        }
      }

      if (pathname.startsWith("/empcrm/admin-dashboard")) {
        if (!["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(role)) {
          return NextResponse.redirect(
            new URL("/empcrm/user-dashboard", request.url),
          );
        }
      }

      if (pathname.startsWith("/empcrm/user-dashboard")) {
        return NextResponse.next();
      }

      if (
        pathname.startsWith("/user-dashboard") &&
        role === "SUPERADMIN" &&
        !isImpersonated
      ) {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      }

      return NextResponse.next();
    } catch (err) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin-dashboard/:path*",
    "/user-dashboard/:path*",
    "/empcrm/:path*",
  ],
};

