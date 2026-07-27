// app/api/me/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { dbExecute } from "@/lib/db";
import { cacheGetOrSet, cacheDelete } from "@/lib/cache";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET() {
  // ✅ Await cookies() (important in App Router)
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const cacheKey = `user:${username}`;

    // 🎯 Use cache to avoid database query
    // TTL: 600 seconds (10 minutes) - user data doesn't change that often
    const userData = await cacheGetOrSet(
      cacheKey,
      async () => {
        // Fetch from database if not cached
        const rows = await dbExecute(
          `
          SELECT username, email, empId, userRole FROM emplist WHERE username = ?
          UNION
          SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
          `,
          [username, username]
        );

        if (rows.length === 0) {
          return null;
        }

        return rows[0];
      },
      600 // 10-minute cache
    );

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(userData);
  } catch (err) {
    console.error("JWT decode or DB error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

// Optional: Invalidate cache when user data changes
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    // Invalidate cache for this user
    const cacheKey = `user:${payload.username}`;
    cacheDelete(cacheKey);
    console.log(`🔄 Cache invalidated for user: ${payload.username}`);

    return NextResponse.json({ message: "Cache invalidated" });
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
