import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Must match `ATTENDANCE_RULES_ALLOWED_ROLES` in `@/lib/adminAttendanceRulesAuth`. */
const ATTENDANCE_RULES_MIDDLEWARE_ROLES = ["SUPERADMIN", "ADMIN", "HR"];

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

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
      const isImpersonated = payload.impersonated;
      const roleKey = normalizeRoleKey(role || "");

      // Same roles as getAdminSidebarMenuItems "Attendance rules" — must not block here,
      // otherwise ADMIN/HR see the link but middleware sends them to /user-dashboard.
      if (pathname.startsWith("/admin-dashboard/attendance-rules")) {
        const canAttendanceRules = ATTENDANCE_RULES_MIDDLEWARE_ROLES.some(
          (r) => normalizeRoleKey(r) === roleKey,
        );
        if (canAttendanceRules) {
          return NextResponse.next();
        }
      }

      if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }

      if (pathname.startsWith("/admin-dashboard/company-documents")) {
        if (!["SUPERADMIN", "ADMIN", "ACCOUNTANT"].includes(role)) {
          return NextResponse.redirect(new URL("/admin-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/empcrm/admin-dashboard")) {
        const roleKey = normalizeRoleKey(role || "");
        const hrEmpCrmRoles = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];
        const isHrEmpCrm = hrEmpCrmRoles.some(
          (r) => normalizeRoleKey(r) === roleKey,
        );
        // Accountant: Salary slips only (see getEmpCrmAdminSidebarMenuItems)
        const isAccountantSalarySlips =
          roleKey === "ACCOUNTANT" &&
          pathname.startsWith("/empcrm/admin-dashboard/salary-slips");
        if (!isHrEmpCrm && !isAccountantSalarySlips) {
          return NextResponse.redirect(new URL("/empcrm/user-dashboard", request.url));
        }
      }

      if (
        pathname.startsWith("/user-dashboard") &&
        role === "SUPERADMIN" &&
        !isImpersonated
      ) {
        // Allow 24h DM leads (admin sidebar links here; module is SUPERADMIN + Digital Marketer only)
        if (pathname.startsWith("/user-dashboard/digital-marketer-leads")) {
          return NextResponse.next();
        }
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
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
