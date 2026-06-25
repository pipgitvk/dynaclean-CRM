import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { normalizeRoleKey, isJwtAccountingRole } from "@/lib/roleKeyUtils";

/** Attendance rules: SUPERADMIN + ADMIN + HR roles. */
const ATTENDANCE_RULES_MIDDLEWARE_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "HR",
  "HR HEAD",
  "HR Executive",
];

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
      const roleNorm = String(role ?? "").trim().toUpperCase();

      if (role === "SUPERADMIN") {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      } else if (roleNorm === "DIRECTOR") {
        return NextResponse.redirect(new URL("/director-dashboard", request.url));
      } else if (roleNorm.includes("SALES")) {
        return NextResponse.redirect(new URL("/sales-dashboard", request.url));
      } else if (roleNorm.includes("SERVICE") && roleNorm.includes("HEAD")) {
        return NextResponse.redirect(new URL("/service-head-dashboard", request.url));
      } else if (roleNorm.includes("HR")) {
        return NextResponse.redirect(new URL("/hr-dashboard", request.url));
      } else if (roleNorm.includes("DIGITAL") || roleNorm.includes("MARKETER")) {
        return NextResponse.redirect(new URL("/digital-marketing-dashboard", request.url));
      } else if (roleNorm.includes("ACCOUNTANT")) {
        return NextResponse.redirect(new URL("/accounts-dashboard", request.url));
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
    pathname.startsWith("/director-dashboard") ||
    pathname.startsWith("/empcrm") ||
    pathname.startsWith("/sales-dashboard") ||
    pathname.startsWith("/service-head-dashboard") ||
    pathname.startsWith("/hr-dashboard") ||
    pathname.startsWith("/digital-marketing-dashboard") ||
    pathname.startsWith("/accounts-dashboard")
  ) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;
      const isImpersonated = payload.impersonated;
      const roleKey = normalizeRoleKey(role || "");
      const roleNorm = String(role ?? "").trim().toUpperCase();

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

      // Prospects module is used by SALES roles too.
      if (pathname.startsWith("/admin-dashboard/prospects")) {
        if (["SUPERADMIN", "ADMIN", "SALES", "SALES HEAD"].includes(role) || roleNorm === "DIRECTOR") {
          return NextResponse.next();
        }
      }

      // Allow accountants to access invoices module
      if (pathname.startsWith("/accounts-dashboard")) {
        if (isJwtAccountingRole(role)) {
          return NextResponse.next();
        }
      }

      // Allow accountant (+ variants e.g. Production Accountant) admin pages before global redirect.
      const ACCOUNTANT_ADMIN_PREFIXES = [
        "/admin-dashboard/client-expenses",
        "/admin-dashboard/statements",
        "/admin-dashboard/all-expenses",
        "/admin-dashboard/delivery-challan",
      ];
      if (ACCOUNTANT_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
        if (isJwtAccountingRole(role)) {
          return NextResponse.next();
        }
      }

      if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN" && roleNorm !== "DIRECTOR") {
        // Allow EA for employee-related admin routes
        const eaAllowedRoutes = [
          "/admin-dashboard/employees",
          "/admin-dashboard/create-employee",
          "/admin-dashboard/password",
          "/admin-dashboard/quick-edit",
          "/admin-dashboard/ip-restrictions"
        ];
        const isEaAllowed = eaAllowedRoutes.some(route => pathname.startsWith(route));
        if (roleNorm !== "EA" || !isEaAllowed) {
          const dest = new URL("/user-dashboard", request.url);
          dest.search = request.nextUrl.search;
          return NextResponse.redirect(dest);
        }
      }
      
      // Allow EA access to /ea-dashboard
      if (pathname.startsWith("/ea-dashboard")) {
        if (roleNorm !== "EA" && role !== "SUPERADMIN" && roleNorm !== "DIRECTOR") {
          const dest = new URL("/user-dashboard", request.url);
          dest.search = request.nextUrl.search;
          return NextResponse.redirect(dest);
        }
      }

      // SUPERADMIN-only modules (even if link is known)
      if (pathname.startsWith("/admin-dashboard/import-crm")) {
        if (role !== "SUPERADMIN" && roleNorm !== "DIRECTOR") {
          return NextResponse.redirect(new URL("/admin-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/admin-dashboard/hiring-process")) {
        if (role !== "SUPERADMIN" && roleNorm !== "DIRECTOR") {
          return NextResponse.redirect(new URL("/admin-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/admin-dashboard/gem-crm")) {
        if (role !== "SUPERADMIN" && roleNorm !== "DIRECTOR") {
          return NextResponse.redirect(new URL("/admin-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/empcrm/admin-dashboard/profile/approvals-admin")) {
        if (role !== "SUPERADMIN") {
          return NextResponse.redirect(new URL("/empcrm/user-dashboard", request.url));
        }
      }

      if (pathname.startsWith("/empcrm/admin-dashboard")) {
        const roleKey = normalizeRoleKey(role || "");
        const hrEmpCrmRoles = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive", "JUNIOR HR EXECUTIVE", "HR RECRUITER"];
        const isHrEmpCrm = hrEmpCrmRoles.some(
          (r) => normalizeRoleKey(r) === roleKey,
        );
        // Accountant: Salary management and salary slips (see getEmpCrmAdminSidebarMenuItems)
        const isAccountantSalaryAccess =
          roleKey === "ACCOUNTANT" &&
          (pathname.startsWith("/empcrm/admin-dashboard/salary") ||
           pathname.startsWith("/empcrm/admin-dashboard/salary-slips"));
        if (!isHrEmpCrm && !isAccountantSalaryAccess) {
          return NextResponse.redirect(new URL("/empcrm/user-dashboard", request.url));
        }
      }

      // Allow digital marketers to access my-leads with social_media campaign
      if (
        pathname.startsWith("/user-dashboard/my-leads") &&
        (roleNorm.includes("DIGITAL") || roleNorm.includes("MARKETER"))
      ) {
        return NextResponse.next();
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
    "/director-dashboard/:path*",
    "/login",
    "/admin-dashboard/:path*",
    "/user-dashboard/:path*",
    "/empcrm/:path*",
    "/sales-dashboard/:path*",
    "/service-head-dashboard/:path*",
    "/hr-dashboard/:path*",
    "/digital-marketing-dashboard/:path*",
    "/accounts-dashboard/:path*",
  ],
};
