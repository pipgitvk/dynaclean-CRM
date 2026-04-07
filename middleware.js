import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

function getClientIp(request) {
  let ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  return ip;
}

async function checkIpAllowed(request, username) {
  try {
    const clientIp = getClientIp(request);
    const validateUrl = new URL("/api/validate-ip", request.nextUrl.origin);
    validateUrl.searchParams.set("username", username);
    validateUrl.searchParams.set("ip", clientIp);

    const res = await fetch(validateUrl.toString(), {
      headers: {
        "x-internal-secret": process.env.JWT_SECRET || "your-secret",
      },
    });

    if (!res.ok) return true; // fail open on HTTP error
    const data = await res.json();
    return data.allowed !== false;
  } catch {
    return true; // fail open on network error
  }
}

function buildLogoutResponse(request) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", "ip_blocked");
  const response = NextResponse.redirect(loginUrl);

  // Clear main token
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  // Clear impersonation token
  response.cookies.set("impersonation_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const impersonationToken = request.cookies.get("impersonation_token")?.value;
  const mainToken = request.cookies.get("token")?.value;
  const token = impersonationToken || mainToken;

  // Redirect root to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If already logged in and visiting /login, redirect to dashboard
  if (pathname === "/login" && token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;

      if (role === "SUPERADMIN") {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }
    } catch {
      return NextResponse.next();
    }
  }

  // Protected routes
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
      const username = payload.username;
      const isImpersonated = payload.impersonated;

      // Role-based routing
      if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }

      if (pathname.startsWith("/admin-dashboard/company-documents")) {
        if (!["SUPERADMIN", "ADMIN", "ACCOUNTANT"].includes(role)) {
          return NextResponse.redirect(new URL("/admin-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/empcrm/admin-dashboard")) {
        if (!["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(role)) {
          return NextResponse.redirect(new URL("/empcrm/user-dashboard", request.url));
        }
      }

      if (
        pathname.startsWith("/user-dashboard") &&
        role === "SUPERADMIN" &&
        !isImpersonated
      ) {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      }

      // --- IP Restriction check ---
      // Use the main token's username for IP check (not impersonated user)
      let ipCheckUsername = username;
      if (impersonationToken && mainToken) {
        // When impersonating, check the admin's IP (the real logged-in user)
        try {
          const { payload: mainPayload } = await jwtVerify(mainToken, secret);
          ipCheckUsername = mainPayload.username;
        } catch {
          ipCheckUsername = username;
        }
      }

      const allowed = await checkIpAllowed(request, ipCheckUsername);
      if (!allowed) {
        return buildLogoutResponse(request);
      }

      return NextResponse.next();
    } catch {
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
