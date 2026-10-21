// app/api/me/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { dbExecute } from "@/lib/db";
import { cacheGetOrSet, cacheDelete } from "@/lib/cache";
import { getRepListUserRole, rolesMatch } from "@/lib/repListUserRole";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const secret = new TextEncoder().encode(JWT_SECRET);

function tokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    const username = payload.username;
    const cacheKey = `user:${username}`;

    const userData = await cacheGetOrSet(
      cacheKey,
      async () => {
        const rows = await dbExecute(
          `
          SELECT username, email, empId, userRole FROM emplist WHERE username = ?
          UNION
          SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
          `,
          [username, username],
        );

        if (rows.length === 0) {
          return null;
        }

        return rows[0];
      },
      600,
    );

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const repRole = await getRepListUserRole(username);
    if (repRole) {
      if (userData.userRole !== repRole) {
        cacheDelete(cacheKey);
      }
      userData.userRole = repRole;
    }

    const jwtRole = payload.role ?? payload.userRole;
    const needsJwtRefresh =
      repRole && jwtRole && !rolesMatch(repRole, jwtRole);

    const res = NextResponse.json(userData);

    if (needsJwtRefresh) {
      const newToken = await new SignJWT({
        id: payload.id,
        username: payload.username,
        role: repRole,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);
      res.cookies.set("token", newToken, tokenCookieOptions());
    }

    return res;
  } catch (err) {
    console.error("JWT decode or DB error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secret);

    const cacheKey = `user:${payload.username}`;
    cacheDelete(cacheKey);

    return NextResponse.json({ message: "Cache invalidated" });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
