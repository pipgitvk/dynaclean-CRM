





// import { NextResponse } from "next/server";
// import { jwtVerify } from "jose";

// const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// export async function middleware(request) {
//   const { pathname } = request.nextUrl;
//   const token = request.cookies.get("token")?.value;

//   // 🚫 Redirect '/' to '/login'
//   if (pathname === "/") {
//     return NextResponse.redirect(new URL("/login", request.url));
//   }

//   // ✅ If user is on /login but already has a valid token, redirect based on role
//   if (pathname === "/login" && token) {
//     try {
//       const { payload } = await jwtVerify(token, secret);
//       const role = payload.role;

//       if (role === "SUPERADMIN") {
//         return NextResponse.redirect(new URL("/admin-dashboard", request.url));
//       } else {
//         return NextResponse.redirect(new URL("/user-dashboard", request.url));
//       }
//     } catch (err) {
//       // Invalid token, let them continue to /login
//       return NextResponse.next();
//     }
//   }

//   // ✅ Protect dashboard routes
//   if (pathname.startsWith("/admin-dashboard") || pathname.startsWith("/user-dashboard")) {
//     if (!token) {
//       return NextResponse.redirect(new URL("/login", request.url));
//     }

//     try {
//       const { payload } = await jwtVerify(token, secret);
//       const role = payload.role;

//       if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN") {
//         return NextResponse.redirect(new URL("/user-dashboard", request.url));
//       }

//       if (pathname.startsWith("/user-dashboard") && role === "SUPERADMIN") {
//         return NextResponse.redirect(new URL("/admin-dashboard", request.url));
//       }

//       return NextResponse.next();
//     } catch (err) {
//       return NextResponse.redirect(new URL("/login", request.url));
//     }
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/", "/login", "/admin-dashboard/:path*", "/user-dashboard/:path*"],
// };





// middleware.js (Updated)
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Use the impersonation token if it exists, otherwise use the regular token
  const token = request.cookies.get("impersonation_token")?.value || request.cookies.get("token")?.value;

  // 🚫 Redirect '/' to '/login'
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ✅ Login page handling
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
      // Token is invalid, proceed to login page
      return NextResponse.next();
    }
  }

  // ✅ Protect dashboard routes
  if (pathname.startsWith("/admin-dashboard") || pathname.startsWith("/user-dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role;
      const isImpersonated = payload.impersonated;

      // Super Admin protection
      if (pathname.startsWith("/admin-dashboard") && role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/user-dashboard", request.url));
      }

      // User dashboard protection (check for role and if not impersonated)
      if (pathname.startsWith("/user-dashboard") && role === "SUPERADMIN" && !isImpersonated) {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      }

      return NextResponse.next();
    } catch (err) {
      // Token expired or invalid, redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin-dashboard/:path*", "/user-dashboard/:path*"],
};